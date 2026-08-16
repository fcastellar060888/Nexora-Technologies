import{useState}from'react'
import Card from'../components/Card'
import Field from'../components/Field'
import PageHeader from'../components/PageHeader'
import PermissionButton from'../components/PermissionButton'
import{IRRIGATION_MIRFE_OPERATIONS,useIrrigationMirfeCommandStore}from'../services/irrigationMirfeCommandStore'
import{netTargets,solveFertigationFormula,validateFormula}from'../domain/formulation'

export default function FormulationPage(){
 const{state,execute}=useIrrigationMirfeCommandStore();const c=state.currentContext
 const[form,setForm]=useState({siteId:c.siteId||state.sites[0]?.id||'',geneticId:c.geneticId||state.genetics[0]?.id||'',stage:c.stage||'Vegetativo fuerte',volumeL:1000})
 const[result,setResult]=useState([]);const[validation,setValidation]=useState(null)
 function calculate(){
  const water=[...state.waterAnalyses].reverse().find(x=>x.siteId===form.siteId&&x.status==='Vigente')
  const objective=state.nutrientObjectives.find(x=>x.geneticId===form.geneticId&&x.stage===form.stage&&x.status==='Aprobada')
  if(!objective)return alert('Falta objetivo nutricional aprobado para esta genética y etapa.')
  if(!water)return alert('Falta análisis de agua vigente para esta sede.')
  const targets=netTargets(objective,water),formula=solveFertigationFormula(state.nutrientProducts,targets,form.volumeL)
  setResult(formula);setValidation(validateFormula(state.nutrientProducts,formula,targets,form.volumeL))
 }
 async function save(status='Borrador'){
  if(!result.length)return alert('Primero calcula la propuesta.')
  if(status==='Aprobada'&&validation?.valid!==true)return alert('La fórmula no puede aprobarse mientras existan advertencias de composición, unidades, solubilidad, compatibilidad o desviación.')
  try{await execute({operation:status==='Aprobada'?IRRIGATION_MIRFE_OPERATIONS.APPROVE_FORMULATION:IRRIGATION_MIRFE_OPERATIONS.CREATE_FORMULATION,input:{...form,items:result,validation}})}catch(error){alert(error.message)}
 }
 return <><PageHeader title="Formulación de fertirriego" subtitle="Resuelve la matriz producto–nutriente, descuenta el agua y valida composición, unidades, desviaciones, solubilidad y compatibilidad."/>
 <Card title="Parámetros"><div className="form-grid"><Field label="Sede"><select value={form.siteId} onChange={e=>setForm({...form,siteId:e.target.value})}>{state.sites.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></Field><Field label="Genética"><select value={form.geneticId} onChange={e=>setForm({...form,geneticId:e.target.value})}>{state.genetics.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></Field><Field label="Etapa"><input value={form.stage} onChange={e=>setForm({...form,stage:e.target.value})}/></Field><Field label="Volumen final L"><input type="number" value={form.volumeL} onChange={e=>setForm({...form,volumeL:Number(e.target.value)})}/></Field><div className="form-actions"><button className="button primary" onClick={calculate}>Calcular y validar</button><button className="button secondary" onClick={()=>save('Borrador')}>Guardar borrador</button><PermissionButton permission="approve_formulas" className="button warning" disabled={!validation?.valid} title={validation?.valid?'':'Resuelve todas las advertencias antes de aprobar'} onClick={()=>save('Aprobada')}>Aprobar fórmula</PermissionButton></div></div></Card>
 <Card title="Propuesta por producto"><div className="table-scroll"><table><thead><tr><th>Producto</th><th>Tanque</th><th>Gramos</th><th>Costo estimado</th></tr></thead><tbody>{result.map(x=>{const p=state.nutrientProducts.find(p=>p.id===x.productId);return <tr key={x.productId}><td>{p?.name}</td><td>{x.tank}</td><td>{x.grams}</td><td>${x.estimatedCost.toLocaleString('es-US')}</td></tr>})}</tbody></table></div></Card>
 {validation&&<Card title="Validación"><div className="detail-grid">{Object.entries(validation.totals).map(([k,v])=><div key={k}><span>{k.toUpperCase()} calculado</span><strong>{v.toFixed(1)} ppm</strong></div>)}</div>{validation.warnings.length?<div className="validation-warnings">{validation.warnings.map(x=><p key={x}>⚠ {x}</p>)}</div>:<p className="ok">Sin advertencias automáticas. Requiere revisión técnica final.</p>}</Card>}
 <Card title="Fórmulas guardadas"><div className="table-scroll"><table><thead><tr><th>Fecha</th><th>Lineage</th><th>Versión</th><th>Sede</th><th>Genética</th><th>Etapa</th><th>Volumen</th><th>Validación</th><th>Estado</th><th>Aprobó</th></tr></thead><tbody>{[...state.formulations].reverse().map(x=><tr key={x.id}><td>{String(x.createdAt||x.date).slice(0,10)}</td><td>{String(x.formulaKey||x.id).slice(0,8)}</td><td>v{Number(x.version||1)}</td><td>{state.sites.find(s=>s.id===x.siteId)?.name}</td><td>{state.genetics.find(g=>g.id===x.geneticId)?.name}</td><td>{x.stage}</td><td>{x.volumeLiters??x.volumeL} L</td><td>{x.validation?.valid?'Válida':'Con advertencias'}</td><td>{x.status}</td><td>{x.approvedBy||'—'}</td></tr>)}</tbody></table></div></Card></>
}
