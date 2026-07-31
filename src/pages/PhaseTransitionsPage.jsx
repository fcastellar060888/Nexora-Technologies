import{useState}from'react'
import Card from'../components/Card'
import Field from'../components/Field'
import PageHeader from'../components/PageHeader'
import{useStore}from'../services/store'
import{cultivationPhases,tracePlant}from'../domain/propagation'

export default function PhaseTransitionsPage(){
 const{state,update}=useStore();const c=state.currentContext
 const[form,setForm]=useState({plantId:c.plantId||'',fromPhase:'Propagación',toPhase:'Vegetativo',date:new Date().toISOString().slice(0,10),siteId:c.siteId||'',houseId:c.houseId||'',bedId:c.bedId||'',responsible:'',notes:''})
 function save(e){e.preventDefault();if(!form.plantId)return alert('Selecciona una planta.');update(s=>({...s,phaseTransitions:[...s.phaseTransitions,{id:crypto.randomUUID(),entityType:'plant',entityId:form.plantId,createdAt:new Date().toISOString(),...form}],plantPositions:s.plantPositions.map(p=>p.id===form.plantId?{...p,currentPhase:form.toPhase,phaseStartDate:form.date}:p)}),{module:'Cultivo',action:`Cambio ${form.fromPhase} → ${form.toPhase}`,detail:form.plantId})}
 return <><PageHeader title="Cambios de fase" subtitle="Conserva la fecha y ubicación de cada paso desde propagación hasta floración y cosecha."/>
 <Card title="Registrar cambio"><form className="form-grid" onSubmit={save}>
  <Field label="Planta"><select value={form.plantId} onChange={e=>setForm({...form,plantId:e.target.value})}><option value="">Seleccionar</option>{state.plantPositions.map(p=><option key={p.id} value={p.id}>{state.beds.find(b=>b.id===p.bedId)?.name} · F{p.row} P{p.position}</option>)}</select></Field>
  <Field label="Fase anterior"><select value={form.fromPhase} onChange={e=>setForm({...form,fromPhase:e.target.value})}>{cultivationPhases.map(x=><option key={x}>{x}</option>)}</select></Field>
  <Field label="Nueva fase"><select value={form.toPhase} onChange={e=>setForm({...form,toPhase:e.target.value})}>{cultivationPhases.map(x=><option key={x}>{x}</option>)}</select></Field>
  <Field label="Fecha"><input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></Field>
  <Field label="Sede"><select value={form.siteId} onChange={e=>setForm({...form,siteId:e.target.value})}><option value="">Sin cambio</option>{state.sites.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
  <Field label="Nave"><select value={form.houseId} onChange={e=>setForm({...form,houseId:e.target.value})}><option value="">Sin cambio</option>{state.houses.filter(x=>!form.siteId||x.siteId===form.siteId).map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
  <Field label="Cama"><select value={form.bedId} onChange={e=>setForm({...form,bedId:e.target.value})}><option value="">Sin cambio</option>{state.beds.filter(x=>!form.houseId||x.houseId===form.houseId).map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
  <Field label="Responsable"><input value={form.responsible} onChange={e=>setForm({...form,responsible:e.target.value})}/></Field>
  <Field label="Observaciones"><textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></Field>
  <button className="button primary">Guardar cambio</button>
 </form></Card>
 <Card title="Historial de cambios"><div className="table-scroll"><table><thead><tr><th>Fecha</th><th>Planta</th><th>Origen</th><th>Cambio</th><th>Ubicación</th><th>Responsable</th></tr></thead><tbody>{[...state.phaseTransitions].reverse().map(x=>{const t=tracePlant(state,x.entityId);return <tr key={x.id}><td>{x.date}</td><td>{t.unit?.code||x.entityId.slice(0,8)}</td><td>{t.mother?.lotCode||'Sin lote madres'} · {t.batch?.code||'Sin lote productivo'}</td><td>{x.fromPhase} → {x.toPhase}</td><td>{state.sites.find(s=>s.id===x.siteId)?.name||'—'} · {state.houses.find(h=>h.id===x.houseId)?.name||'—'}</td><td>{x.responsible||'—'}</td></tr>})}</tbody></table></div></Card>
 </>}
