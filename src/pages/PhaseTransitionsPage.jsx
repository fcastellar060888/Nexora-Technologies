import{useState}from'react'
import Card from'../components/Card'
import Field from'../components/Field'
import PageHeader from'../components/PageHeader'
import{projectMipeOperationalRestrictions}from'../domain/mipeOperationalRestrictions.js'
import{activeOrganizationId}from'../domain/organizationOwnership.js'
import{cultivationPhases,tracePlant}from'../domain/propagation'
import{executePlantPhaseTransitionCommand}from'../services/plantPhaseTransitionCommand.js'
import{useStore}from'../services/store'

function restrictionTag(state,plantId){
 try{
  const restriction=projectMipeOperationalRestrictions(state,{targetType:'POSITION',targetId:plantId,organizationId:activeOrganizationId(state)})
  if(restriction.reentryBlocked&&restriction.harvestBlocked)return' · REENTRADA + CARENCIA'
  if(restriction.reentryBlocked)return' · REENTRADA ACTIVA'
  if(restriction.harvestBlocked)return' · CARENCIA ACTIVA'
  return''
 }catch{return' · MIPE POR VERIFICAR'}
}

export default function PhaseTransitionsPage(){
 const{state,update}=useStore(),c=state.currentContext
 const[form,setForm]=useState({plantId:c.plantId||'',fromPhase:'Propagación',toPhase:'Vegetativo',date:new Date().toISOString().slice(0,10),siteId:c.siteId||'',houseId:c.houseId||'',bedId:c.bedId||'',responsible:'',notes:''})
 const[busy,setBusy]=useState(false),[notice,setNotice]=useState('')
 async function save(e){
  e.preventDefault();if(busy)return
  if(!form.plantId){setNotice('Selecciona una planta.');return}
  setBusy(true);setNotice('')
  try{
   const occurredAt=`${form.date}T12:00:00.000Z`
   await executePlantPhaseTransitionCommand(state,{...form,commandId:crypto.randomUUID(),occurredAt},{commit:(recipe,meta)=>update(recipe,meta)})
   setNotice(`Cambio ${form.fromPhase} → ${form.toPhase} registrado.`)
   setForm(current=>({...current,fromPhase:current.toPhase,notes:''}))
  }catch(error){setNotice(error instanceof Error?error.message:'No fue posible cambiar la fase.')}
  finally{setBusy(false)}
 }
 return <><PageHeader title="Cambios de fase" subtitle="Conserva la fecha y ubicación de cada paso desde propagación hasta floración y cosecha."/>
 <Card title="Registrar cambio"><form className="form-grid" onSubmit={save}>
  <Field label="Planta"><select value={form.plantId} onChange={e=>setForm({...form,plantId:e.target.value})}><option value="">Seleccionar</option>{state.plantPositions.map(p=><option key={`${p.organizationId||p.companyId||'legacy'}:${p.id}`} value={p.id}>{state.beds.find(b=>b.id===p.bedId)?.name} · F{p.row} P{p.position}{restrictionTag(state,p.id)}</option>)}</select></Field>
  <Field label="Fase anterior"><select value={form.fromPhase} onChange={e=>setForm({...form,fromPhase:e.target.value})}>{cultivationPhases.map(x=><option key={x}>{x}</option>)}</select></Field>
  <Field label="Nueva fase"><select value={form.toPhase} onChange={e=>setForm({...form,toPhase:e.target.value})}>{cultivationPhases.map(x=><option key={x}>{x}</option>)}</select></Field>
  <Field label="Fecha"><input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></Field>
  <Field label="Sede"><select value={form.siteId} onChange={e=>setForm({...form,siteId:e.target.value})}><option value="">Sin cambio</option>{state.sites.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
  <Field label="Nave"><select value={form.houseId} onChange={e=>setForm({...form,houseId:e.target.value})}><option value="">Sin cambio</option>{state.houses.filter(x=>!form.siteId||x.siteId===form.siteId).map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
  <Field label="Cama"><select value={form.bedId} onChange={e=>setForm({...form,bedId:e.target.value})}><option value="">Sin cambio</option>{state.beds.filter(x=>!form.houseId||x.houseId===form.houseId).map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
  <Field label="Responsable"><input value={form.responsible} onChange={e=>setForm({...form,responsible:e.target.value})}/></Field>
  <Field label="Observaciones"><textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></Field>
  {notice&&<p className="auth-status span-all" role="status">{notice}</p>}
  <button className="button primary" disabled={busy}>{busy?'Guardando…':'Guardar cambio'}</button>
 </form></Card>
 <Card title="Historial de cambios"><div className="table-scroll"><table><thead><tr><th>Fecha</th><th>Planta</th><th>Origen</th><th>Cambio</th><th>Ubicación</th><th>Responsable</th></tr></thead><tbody>{[...state.phaseTransitions].reverse().map(x=>{const t=tracePlant(state,x.entityId);return <tr key={`${x.organizationId||'legacy'}:${x.id}`}><td>{x.date}</td><td>{t.unit?.code||x.entityId.slice(0,8)}</td><td>{t.mother?.lotCode||'Sin lote madres'} · {t.batch?.code||'Sin lote productivo'}</td><td>{x.fromPhase} → {x.toPhase}</td><td>{state.sites.find(s=>s.id===x.siteId)?.name||'—'} · {state.houses.find(h=>h.id===x.houseId)?.name||'—'}</td><td>{x.responsible||'—'}</td></tr>})}</tbody></table></div></Card>
 </>}
