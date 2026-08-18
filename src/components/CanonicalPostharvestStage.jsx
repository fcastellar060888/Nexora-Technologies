import{useEffect,useMemo,useState}from'react'
import Card from'./Card'
import Field from'./Field'
import PageHeader from'./PageHeader'
import{useStore}from'../services/store'
import{advanceProductionLot,canonicalPostharvestHistory,canonicalPostharvestLotsForPhase,phaseOutput,postharvestViewForActiveOrganization}from'../domain/production.js'

const SOURCE={Cosecha:'Floración',Secado:'Cosecha',Manicura:'Secado',Selección:'Manicura',Empaque:'Selección'}
const today=()=>new Date().toISOString().slice(0,10)
const initialForm=(organizationId,lot)=>({organizationId,siteId:lot?.siteId||'',lotId:lot?.id||'',eventId:crypto.randomUUID(),date:today(),quantity:lot?.activeQuantity??lot?.quantity??0,discarded:0,inputWeight:'',outputWeight:'',responsible:'',notes:'',days:0,hours:0,workers:0,gradeA:0,gradeB:0,bags:0,bagSize:0})

export default function CanonicalPostharvestStage({targetPhase,title,subtitle}){
 const{state,update}=useStore()
 const view=postharvestViewForActiveOrganization(state)
 const eligible=canonicalPostharvestLotsForPhase(state,targetPhase)
 const history=canonicalPostharvestHistory(state,targetPhase)
 const[form,setForm]=useState(()=>initialForm(view.organizationId,eligible[0]))
 const selected=useMemo(()=>eligible.find(lot=>lot.id===form.lotId)||null,[eligible,form.lotId])
 useEffect(()=>setForm(initialForm(view.organizationId,eligible[0])),[view.organizationId,targetPhase])
 function selectLot(lotId){const lot=eligible.find(item=>item.id===lotId);setForm(current=>({...current,siteId:lot?.siteId||'',lotId,eventId:crypto.randomUUID(),quantity:lot?.activeQuantity??lot?.quantity??0,discarded:0,inputWeight:'',outputWeight:''}))}
 function details(){
  if(targetPhase==='Secado')return{days:Number(form.days||0)}
  if(targetPhase==='Manicura')return{hours:Number(form.hours||0),workers:Number(form.workers||0)}
  if(targetPhase==='Selección')return{gradeA:Number(form.gradeA||0),gradeB:Number(form.gradeB||0)}
  if(targetPhase==='Empaque')return{bags:Number(form.bags||0),bagSize:Number(form.bagSize||0)}
  return{}
 }
 function save(event){
  event.preventDefault()
  if(!selected)return alert('Selecciona un lote canónico disponible para esta etapa.')
  try{
   update(store=>advanceProductionLot(store,{organizationId:form.organizationId,siteId:form.siteId,lotId:form.lotId,eventId:form.eventId,phase:targetPhase,date:form.date,quantity:form.quantity,discarded:form.discarded,inputWeight:targetPhase==='Cosecha'?form.inputWeight:undefined,outputWeight:form.outputWeight,responsible:form.responsible,notes:form.notes,details:details()}),{module:'Postcosecha',action:`Avance canónico a ${targetPhase}`,detail:selected.code||selected.id})
   const remaining=eligible.filter(lot=>lot.id!==selected.id)
   setForm(initialForm(view.organizationId,remaining[0]))
  }catch(error){alert(error.message)}
 }
 const sourcePhase=SOURCE[targetPhase]
 const sourceWeight=selected&&sourcePhase&&sourcePhase!=='Floración'?phaseOutput(selected,sourcePhase):0
 return <>
  <PageHeader title={title} subtitle={subtitle}/>
  <Card title={`Avanzar lote a ${targetPhase}`}>
   <form className="form-grid" onSubmit={save}>
    <Field label="Lote canónico"><select required value={form.lotId} onChange={event=>selectLot(event.target.value)}><option value="">Seleccionar</option>{eligible.map(lot=><option key={`${lot.organizationId}:${lot.id}`} value={lot.id}>{lot.code||lot.id} · {lot.phase} · {lot.activeQuantity??lot.quantity??0} unidades</option>)}</select></Field>
    <Field label="Fecha"><input required type="date" value={form.date} onChange={event=>setForm({...form,date:event.target.value})}/></Field>
    <Field label="Cantidad que avanza"><input required type="number" min="0" value={form.quantity} onChange={event=>setForm({...form,quantity:Number(event.target.value)})}/></Field>
    <Field label="Descartes"><input type="number" min="0" value={form.discarded} onChange={event=>setForm({...form,discarded:Number(event.target.value)})}/></Field>
    {targetPhase==='Cosecha'&&<Field label="Peso húmedo cosechado (g)"><input required type="number" min="0.01" step=".01" value={form.inputWeight} onChange={event=>setForm({...form,inputWeight:event.target.value})}/></Field>}
    {sourceWeight>0&&<Field label={`Entrada desde ${sourcePhase}`}><input readOnly value={`${sourceWeight} g`}/></Field>}
    <Field label={targetPhase==='Cosecha'?'Peso recibido a secado (g)':'Peso de salida (g)'}><input required type="number" min="0.01" step=".01" value={form.outputWeight} onChange={event=>setForm({...form,outputWeight:event.target.value})}/></Field>
    {targetPhase==='Secado'&&<Field label="Días de secado"><input type="number" min="0" step=".01" value={form.days} onChange={event=>setForm({...form,days:Number(event.target.value)})}/></Field>}
    {targetPhase==='Manicura'&&<><Field label="Horas"><input type="number" min="0" step=".01" value={form.hours} onChange={event=>setForm({...form,hours:Number(event.target.value)})}/></Field><Field label="Operarios"><input type="number" min="0" step="1" value={form.workers} onChange={event=>setForm({...form,workers:Number(event.target.value)})}/></Field></>}
    {targetPhase==='Selección'&&<><Field label="Grado A (g)"><input type="number" min="0" step=".01" value={form.gradeA} onChange={event=>setForm({...form,gradeA:Number(event.target.value)})}/></Field><Field label="Grado B (g)"><input type="number" min="0" step=".01" value={form.gradeB} onChange={event=>setForm({...form,gradeB:Number(event.target.value)})}/></Field></>}
    {targetPhase==='Empaque'&&<><Field label="Bolsas"><input type="number" min="0" step="1" value={form.bags} onChange={event=>setForm({...form,bags:Number(event.target.value)})}/></Field><Field label="Gramos por bolsa"><input type="number" min="0" step=".01" value={form.bagSize} onChange={event=>setForm({...form,bagSize:Number(event.target.value)})}/></Field></>}
    <Field label="Responsable"><input value={form.responsible} onChange={event=>setForm({...form,responsible:event.target.value})}/></Field>
    <Field label="Observaciones"><textarea value={form.notes} onChange={event=>setForm({...form,notes:event.target.value})}/></Field>
    <button className="button primary" disabled={!eligible.length}>Confirmar transición canónica</button>
   </form>
   {!eligible.length&&<p className="auth-status">No hay lotes de la empresa activa listos para avanzar a {targetPhase}.</p>}
  </Card>
  <Card title="Historial canónico"><div className="table-scroll"><table><thead><tr><th>Fecha</th><th>Lote</th><th>Origen</th><th>Entrada</th><th>Salida</th><th>Merma</th><th>Rendimiento</th><th>Responsable</th></tr></thead><tbody>{[...history].reverse().map(item=><tr key={`${item.organizationId}:${item.id}`}><td>{item.date||'—'}</td><td>{item.lotId}</td><td>{item.fromPhase||'—'}</td><td>{Number(item.inputWeight||0).toLocaleString('es-US')} g</td><td>{Number(item.outputWeight||0).toLocaleString('es-US')} g</td><td>{Number(item.lossWeight||0).toLocaleString('es-US')} g</td><td>{Number(item.yieldPct||0)}%</td><td>{item.responsible||'—'}</td></tr>)}</tbody></table></div></Card>
 </>
}
