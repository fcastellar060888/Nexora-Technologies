import{useMemo,useState}from'react'
import Card from'../components/Card'
import Field from'../components/Field'
import PageHeader from'../components/PageHeader'
import PermissionButton from'../components/PermissionButton'
import{FormActions,ValidationMessage}from'../components/forms/FormKit.jsx'
import{useStore}from'../services/store'
import{netTargets,calculateSimpleFormula,validateFormula}from'../domain/formulation'
import{activeUser,hasPermission}from'../services/permissions'

export default function FormulationPage(){
 const{state,update}=useStore();const c=state.currentContext
 const[form,setForm]=useState({siteId:c.siteId||state.sites[0]?.id||'',geneticId:c.geneticId||state.genetics[0]?.id||'',stage:c.stage||'Vegetativo fuerte',volumeL:1000})
 const[result,setResult]=useState([])
 const[validation,setValidation]=useState(null)
 const[msg,setMsg]=useState('')
 const currentWater=useMemo(()=>[...state.waterAnalyses].reverse().find(x=>x.siteId===form.siteId&&x.status==='Vigente'),[state.waterAnalyses,form.siteId])
 const currentObjective=useMemo(()=>state.nutrientObjectives.find(x=>x.geneticId===form.geneticId&&x.stage===form.stage&&x.status==='Aprobada'),[state.nutrientObjectives,form.geneticId,form.stage])
 function calculate(e){
  e?.preventDefault()
  if(!form.siteId||!form.geneticId)return setMsg('Selecciona la sede y la genética.')
  if(Number(form.volumeL)<=0)return setMsg('El volumen final debe ser mayor que cero.')
  if(!currentObjective)return setMsg('Falta un objetivo nutricional aprobado para esta genética y etapa.')
  if(!currentWater)return setMsg('Falta un análisis de agua vigente para esta sede.')
  const targets=netTargets(currentObjective,currentWater)
  const formula=calculateSimpleFormula(state.nutrientProducts,targets,form.volumeL)
  if(!formula.length)return setMsg('No fue posible calcular la propuesta con los productos nutricionales disponibles.')
  setResult(formula)
  setValidation(validateFormula(state.nutrientProducts,formula,targets,form.volumeL))
  setMsg('Propuesta calculada. Revisa las advertencias antes de guardar o aprobar.')
 }
 function save(status='Borrador'){
  if(!result.length)return setMsg('Primero calcula la propuesta.')
  if(status==='Aprobada'&&!hasPermission(state,'approve_formulas'))return setMsg('Tu rol no puede aprobar fórmulas.')
  const user=activeUser(state)
  const record={id:crypto.randomUUID(),date:new Date().toISOString(),...form,items:result,status,validation,approvedBy:status==='Aprobada'?(user?.name||'Usuario local'):'',approvedAt:status==='Aprobada'?new Date().toISOString():''}
  update(s=>({...s,formulations:[...s.formulations,record]}),{module:'Fertirriego',action:`Fórmula ${status}`,detail:record.id})
  setMsg(status==='Aprobada'?'Fórmula aprobada y disponible para preparación.':'Borrador guardado correctamente.')
 }
 return <>
  <PageHeader title="Formulación de fertirriego" subtitle="Descuenta el aporte del agua, calcula productos y valida desviaciones, solubilidad y compatibilidad."/>
  <Card title="Parámetros de formulación">
   <form id="fertigation-formulation" data-module="Formulación de fertirriego" data-record-id="new-formulation" className="form-grid" onSubmit={calculate}>
    {msg&&<ValidationMessage type={msg.includes('aprobada')||msg.includes('guardado')?'success':msg.includes('Falta')||msg.includes('no puede')||msg.includes('Primero')||msg.includes('No fue')?'error':'info'}>{msg}</ValidationMessage>}
    <Field label="Sede"><select required value={form.siteId} onChange={e=>{setForm({...form,siteId:e.target.value});setResult([]);setValidation(null)}}><option value="">Selecciona una sede</option>{state.sites.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
    <Field label="Genética"><select required value={form.geneticId} onChange={e=>{setForm({...form,geneticId:e.target.value});setResult([]);setValidation(null)}}><option value="">Selecciona una genética</option>{state.genetics.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
    <Field label="Etapa"><input required value={form.stage} onChange={e=>{setForm({...form,stage:e.target.value});setResult([]);setValidation(null)}}/></Field>
    <Field label="Volumen final (L)"><input min="1" required type="number" value={form.volumeL} onChange={e=>{setForm({...form,volumeL:Number(e.target.value)});setResult([]);setValidation(null)}}/></Field>
    <ValidationMessage type={currentWater&&currentObjective?'success':'info'}>{currentWater?'Análisis de agua vigente encontrado.':'Sin análisis de agua vigente.'} {currentObjective?'Objetivo nutricional aprobado encontrado.':'Sin objetivo nutricional aprobado para la selección actual.'}</ValidationMessage>
    <FormActions><button type="submit" className="button primary">Calcular y validar</button><button type="button" className="button secondary" onClick={()=>save('Borrador')} disabled={!result.length}>Guardar borrador</button><PermissionButton type="button" permission="approve_formulas" className="button warning" onClick={()=>save('Aprobada')} disabled={!result.length}>Aprobar fórmula</PermissionButton></FormActions>
   </form>
  </Card>
  <Card title="Propuesta por producto"><div className="table-scroll"><table><thead><tr><th>Producto</th><th>Tanque</th><th>Cantidad</th><th>Costo estimado</th></tr></thead><tbody>{result.length?result.map(x=>{const p=state.nutrientProducts.find(p=>p.id===x.productId);return <tr key={x.productId}><td>{p?.name||'Producto no disponible'}</td><td>{x.tank}</td><td>{x.grams} g</td><td>${Number(x.estimatedCost||0).toLocaleString('es-CO')}</td></tr>}):<tr><td colSpan="4">Calcula una propuesta para ver los productos requeridos.</td></tr>}</tbody></table></div></Card>
  {validation&&<Card title="Validación técnica"><div className="detail-grid">{Object.entries(validation.totals).map(([k,v])=><div key={k}><span>{k.toUpperCase()} calculado</span><strong>{v.toFixed(1)} ppm</strong></div>)}</div>{validation.warnings.length?<div className="validation-warnings">{validation.warnings.map(x=><p key={x}>⚠ {x}</p>)}</div>:<p className="ok">Sin advertencias automáticas. Requiere revisión técnica final.</p>}</Card>}
  <Card title="Fórmulas guardadas"><div className="table-scroll"><table><thead><tr><th>Fecha</th><th>Sede</th><th>Genética</th><th>Etapa</th><th>Volumen</th><th>Estado</th><th>Aprobó</th></tr></thead><tbody>{[...state.formulations].reverse().map(x=><tr key={x.id}><td>{String(x.date).slice(0,10)}</td><td>{state.sites.find(s=>s.id===x.siteId)?.name||'—'}</td><td>{state.genetics.find(g=>g.id===x.geneticId)?.name||'—'}</td><td>{x.stage}</td><td>{x.volumeL} L</td><td>{x.status}</td><td>{x.approvedBy||'—'}</td></tr>)}</tbody></table></div></Card>
 </>
}
