import{useMemo,useState}from'react'
import Card from'../components/Card'
import Field from'../components/Field'
import PageHeader from'../components/PageHeader'
import{compareWaterAnalyses,effectiveWaterAnalysisStatus,waterAnalysisResults,WATER_ANALYTES,WATER_ANALYTE_KEYS,WATER_ANALYSIS_STATUSES}from'../domain/waterAnalysis'
import{IRRIGATION_MIRFE_OPERATIONS,useIrrigationMirfeCommandStore}from'../services/irrigationMirfeCommandStore'

const emptyValues=()=>Object.fromEntries(WATER_ANALYTE_KEYS.map(key=>[key,'']))
const blankForm=state=>({siteId:state.currentContext?.siteId||state.sites[0]?.id||'',date:'',laboratoryId:'',laboratoryName:'',sampleId:'',samplePoint:'',sampleType:'SOURCE_WATER',sampledAt:'',analyticalMethodId:'',expectedAnalytes:WATER_ANALYTE_KEYS,status:WATER_ANALYSIS_STATUSES.PENDING,analysisKey:'',supersedesWaterAnalysisId:'',responsible:'',notes:'',values:emptyValues()})

export default function WaterAnalysisPage(){
 const{state,execute}=useIrrigationMirfeCommandStore()
 const[form,setForm]=useState(()=>blankForm(state)),[selection,setSelection]=useState({beforeId:'',afterId:''})
 const history=[...state.waterAnalyses].sort((left,right)=>Date.parse(right.reportedAt||right.date||0)-Date.parse(left.reportedAt||left.date||0)||Number(right.version||1)-Number(left.version||1))
 const enteredCount=form.expectedAnalytes.filter(key=>form.values[key]!==''&&form.values[key]!==null).length
 const comparison=useMemo(()=>{
  if(!selection.beforeId||!selection.afterId)return{result:null,error:''}
  const before=state.waterAnalyses.find(item=>item.id===selection.beforeId),after=state.waterAnalyses.find(item=>item.id===selection.afterId)
  try{return{result:compareWaterAnalyses(before,after),error:''}}catch(error){return{result:null,error:error.message}}
 },[selection,state.waterAnalyses])

 async function save(event){
  event.preventDefault()
  const results=form.expectedAnalytes.filter(key=>form.values[key]!==''&&form.values[key]!==null).map(key=>({analyte:key,value:Number(form.values[key]),methodId:form.analyticalMethodId}))
  const{values,...input}=form
  try{await execute({operation:IRRIGATION_MIRFE_OPERATIONS.RECORD_WATER_ANALYSIS,input:{...input,results}});setForm(blankForm(state))}
  catch(error){alert(error.message)}
 }

 function versionFrom(record){
  const values=emptyValues()
  for(const result of waterAnalysisResults(record))values[result.analyte]=String(result.value)
  setForm({
   siteId:record.siteId,date:record.date||'',laboratoryId:record.laboratoryId||'',laboratoryName:record.laboratoryName||record.laboratory||'',
   sampleId:record.sampleId||'',samplePoint:record.samplePoint||'',sampleType:record.sampleType||'SOURCE_WATER',sampledAt:String(record.sampledAt||'').slice(0,16),
   analyticalMethodId:record.analyticalMethodId||waterAnalysisResults(record)[0]?.methodId||'',expectedAnalytes:record.expectedAnalytes||WATER_ANALYTE_KEYS,status:WATER_ANALYSIS_STATUSES.PENDING,
   analysisKey:record.analysisKey||record.id,supersedesWaterAnalysisId:record.id,responsible:record.responsible||'',notes:'',values
  })
 }

 return <><PageHeader title="Análisis de agua" subtitle="Laboratorio, muestra, método, resultados parciales y versiones append-only alimentan formulación e historial comparable."/>
 <Card title={form.supersedesWaterAnalysisId?'Nueva versión del análisis':'Nuevo análisis'}>
  <form className="form-grid" onSubmit={save}>
   <Field label="Sede"><select required value={form.siteId} onChange={event=>setForm({...form,siteId:event.target.value})}>{state.sites.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
   <Field label="Fecha de informe"><input type="date" value={form.date} onChange={event=>setForm({...form,date:event.target.value})}/></Field>
   <Field label="ID laboratorio"><input required value={form.laboratoryId} onChange={event=>setForm({...form,laboratoryId:event.target.value})}/></Field>
   <Field label="Laboratorio"><input required value={form.laboratoryName} onChange={event=>setForm({...form,laboratoryName:event.target.value})}/></Field>
   <Field label="ID muestra"><input required value={form.sampleId} onChange={event=>setForm({...form,sampleId:event.target.value})}/></Field>
   <Field label="Punto de muestreo"><input required value={form.samplePoint} onChange={event=>setForm({...form,samplePoint:event.target.value})}/></Field>
   <Field label="Tipo de muestra"><select value={form.sampleType} onChange={event=>setForm({...form,sampleType:event.target.value})}><option value="SOURCE_WATER">Agua de fuente</option><option value="IRRIGATION_INPUT">Entrada de riego</option><option value="DRAINAGE">Drenaje</option></select></Field>
   <Field label="Muestreada en"><input required type="datetime-local" value={form.sampledAt} onChange={event=>setForm({...form,sampledAt:event.target.value})}/></Field>
   <Field label="Método/panel"><input required value={form.analyticalMethodId} onChange={event=>setForm({...form,analyticalMethodId:event.target.value})}/></Field>
   <Field label="Estado"><select value={form.status} onChange={event=>setForm({...form,status:event.target.value})}>{Object.values(WATER_ANALYSIS_STATUSES).map(status=><option key={status}>{status}</option>)}</select></Field>
   {WATER_ANALYTE_KEYS.map(key=><Field key={key} label={`${WATER_ANALYTES[key].label} (${WATER_ANALYTES[key].unit})`}><input type="number" min="0" max={key==='ph'?14:undefined} step=".01" value={form.values[key]} onChange={event=>setForm({...form,values:{...form.values,[key]:event.target.value}})}/></Field>)}
   <Field label="Responsable"><input value={form.responsible} onChange={event=>setForm({...form,responsible:event.target.value})}/></Field>
   <Field label="Observaciones"><textarea value={form.notes} onChange={event=>setForm({...form,notes:event.target.value})}/></Field>
   <div className="form-actions"><button className="button primary">Guardar versión</button>{form.supersedesWaterAnalysisId&&<button type="button" className="button secondary" onClick={()=>setForm(blankForm(state))}>Cancelar versión</button>}<span>{enteredCount}/{form.expectedAnalytes.length} resultados</span></div>
  </form>
 </Card>
 <Card title="Historial append-only"><div className="table-scroll"><table><thead><tr><th>Fecha</th><th>Lineage</th><th>Versión</th><th>Sede</th><th>Laboratorio</th><th>Muestra</th><th>Resultados</th><th>Estado efectivo</th><th></th></tr></thead><tbody>{history.map(item=><tr key={item.id}><td>{String(item.reportedAt||item.date||'').slice(0,10)}</td><td>{String(item.analysisKey||item.id).slice(0,8)}</td><td>v{Number(item.version||1)}</td><td>{state.sites.find(site=>site.id===item.siteId)?.name}</td><td>{item.laboratoryName||item.laboratory||'—'}</td><td>{item.sampleId||'Legacy'}</td><td>{item.completeness?`${item.completeness.resultCount}/${item.completeness.expectedCount}`:'Legacy'}</td><td>{effectiveWaterAnalysisStatus(item,state.waterAnalyses)}</td><td><button type="button" className="button secondary" onClick={()=>versionFrom(item)}>Nueva versión</button></td></tr>)}</tbody></table></div></Card>
 <Card title="Comparación histórica compatible"><div className="form-grid"><Field label="Base"><select value={selection.beforeId} onChange={event=>setSelection({...selection,beforeId:event.target.value})}><option value="">Selecciona</option>{history.map(item=><option key={item.id} value={item.id}>{item.sampleId||item.id} · v{Number(item.version||1)}</option>)}</select></Field><Field label="Comparar con"><select value={selection.afterId} onChange={event=>setSelection({...selection,afterId:event.target.value})}><option value="">Selecciona</option>{history.map(item=><option key={item.id} value={item.id}>{item.sampleId||item.id} · v{Number(item.version||1)}</option>)}</select></Field></div>
  {comparison.error&&<p className="validation-warnings">{comparison.error}</p>}
  {comparison.result&&<div className="table-scroll"><table><thead><tr><th>Analito</th><th>Base</th><th>Actual</th><th>Δ</th><th>Método</th></tr></thead><tbody>{comparison.result.rows.map(row=><tr key={row.analyte}><td>{row.label}</td><td>{row.before} {row.unit}</td><td>{row.after} {row.unit}</td><td>{row.delta}</td><td>{row.methodId}</td></tr>)}</tbody></table>{comparison.result.incompatible.length>0&&<p>{comparison.result.incompatible.length} resultado(s) excluidos por método, unidad o base incompatible.</p>}</div>}
 </Card></>
}
