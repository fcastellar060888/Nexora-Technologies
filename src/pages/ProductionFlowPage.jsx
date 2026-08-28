import{useEffect,useMemo,useState}from'react'
import Card from'../components/Card'
import Field from'../components/Field'
import PageHeader from'../components/PageHeader'
import{LOT_PHASES,nextPhase}from'../domain/lifecycle.js'
import{advanceProductionLot,phaseOutput,postharvestViewForActiveOrganization}from'../domain/production.js'
import{useStore}from'../services/store'

const postharvestStart=LOT_PHASES.indexOf('Cosecha')
const today=()=>new Date().toISOString().slice(0,10)
const commandFor=(organizationId,lot)=>({organizationId,siteId:lot?.siteId||'',lotId:lot?.id||'',eventId:crypto.randomUUID(),date:today(),quantity:lot?.activeQuantity??lot?.quantity??0,discarded:0,inputWeight:'',outputWeight:'',responsible:'',notes:''})

export default function ProductionFlowPage(){
 const{state,update}=useStore(),view=postharvestViewForActiveOrganization(state)
 const lots=useMemo(()=>view.propagationBatches.filter(lot=>LOT_PHASES.indexOf(lot.phase)>=postharvestStart),[view.propagationBatches])
 const[selectedId,setSelectedId]=useState(lots[0]?.id||'')
 const selected=lots.find(lot=>lot.id===selectedId)||null
 const[form,setForm]=useState(()=>commandFor(view.organizationId,selected))
 useEffect(()=>{const first=lots[0]||null;setSelectedId(first?.id||'');setForm(commandFor(view.organizationId,first))},[view.organizationId])
 function choose(id){const lot=lots.find(item=>item.id===id)||null;setSelectedId(id);setForm(commandFor(view.organizationId,lot))}
 function advance(event){
  event.preventDefault();if(!selected||selected.phase==='Finalizado')return
  const target=nextPhase(selected.phase)
  try{
   update(store=>advanceProductionLot(store,{...form,phase:target,inputWeight:target==='Cosecha'?form.inputWeight:undefined}),{module:'Producción',action:`Flujo canónico ${selected.phase} → ${target}`,detail:selected.code||selected.id})
   setForm(commandFor(view.organizationId,{...selected,phase:target}))
  }catch(error){alert(error.message)}
 }
 const target=selected&&selected.phase!=='Finalizado'?nextPhase(selected.phase):''
 const sourceWeight=selected&&selected.phase!=='Floración'&&selected.phase!=='Finalizado'?phaseOutput(selected,selected.phase):0
 return <>
  <PageHeader title="Flujo productivo integrado" subtitle="Una sola autoridad de lote desde cosecha hasta producto terminado, con conservación de masa por etapa."/>
  <Card title="Lotes postcosecha canónicos">
   <div className="table-scroll"><table><thead><tr><th>Lote</th><th>Fase</th><th>Unidades</th><th>Cosecha</th><th>Secado</th><th>Manicura</th><th>Selección</th><th>Empaque</th><th></th></tr></thead><tbody>{lots.map(lot=><tr key={`${lot.organizationId}:${lot.id}`}><td>{lot.code||lot.id}</td><td>{lot.phase}</td><td>{lot.activeQuantity??lot.quantity??0}</td><td>{phaseOutput(lot,'Cosecha').toLocaleString('es-US')} g</td><td>{phaseOutput(lot,'Secado').toLocaleString('es-US')} g</td><td>{phaseOutput(lot,'Manicura').toLocaleString('es-US')} g</td><td>{phaseOutput(lot,'Selección').toLocaleString('es-US')} g</td><td>{phaseOutput(lot,'Empaque').toLocaleString('es-US')} g</td><td><button type="button" className="button secondary" onClick={()=>choose(lot.id)}>{lot.phase==='Finalizado'?'Ver':'Avanzar'}</button></td></tr>)}</tbody></table></div>
  </Card>
  {selected&&<Card title={selected.phase==='Finalizado'?`${selected.code||selected.id} · Finalizado`:`Avanzar ${selected.code||selected.id}: ${selected.phase} → ${target}`}>
   {selected.phase==='Finalizado'?<p className="auth-status">El lote está en fase terminal. No admite nuevas transiciones.</p>:<form className="form-grid" onSubmit={advance}>
    <Field label="Fecha"><input type="date" required value={form.date} onChange={event=>setForm({...form,date:event.target.value})}/></Field>
    <Field label="Cantidad que avanza"><input type="number" min="0" required value={form.quantity} onChange={event=>setForm({...form,quantity:Number(event.target.value)})}/></Field>
    <Field label="Descartes"><input type="number" min="0" value={form.discarded} onChange={event=>setForm({...form,discarded:Number(event.target.value)})}/></Field>
    {target==='Cosecha'&&<Field label="Peso húmedo cosechado (g)"><input type="number" min="0.01" step=".01" required value={form.inputWeight} onChange={event=>setForm({...form,inputWeight:event.target.value})}/></Field>}
    {sourceWeight>0&&<Field label={`Peso disponible desde ${selected.phase}`}><input readOnly value={`${sourceWeight.toLocaleString('es-US')} g`}/></Field>}
    <Field label="Peso de salida (g)"><input type="number" min="0.01" step=".01" required value={form.outputWeight} onChange={event=>setForm({...form,outputWeight:event.target.value})}/></Field>
    <Field label="Responsable"><input value={form.responsible} onChange={event=>setForm({...form,responsible:event.target.value})}/></Field>
    <Field label="Observaciones"><textarea value={form.notes} onChange={event=>setForm({...form,notes:event.target.value})}/></Field>
    <button className="button primary">Confirmar avance canónico</button>
   </form>}
  </Card>}
 </>
}
