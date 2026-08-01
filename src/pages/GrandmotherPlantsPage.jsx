import{useState}from'react'
import Card from'../components/Card'
import Field from'../components/Field'
import PageHeader from'../components/PageHeader'
import MaterialPlantUnitExplorer from'../components/MaterialPlantUnitExplorer'
import{useStore}from'../services/store'
import{renewalTiming,dateOnly}from'../domain/lifecycle'
import{MATERIAL_PLANT_TYPES}from'../domain/materialPlantIdentity.js'

export default function GrandmotherPlantsPage(){
 const{state,update}=useStore(),today=dateOnly()
 const empty={siteId:state.sites[0]?.id||'',geneticId:state.genetics[0]?.id||'',lotCode:'',quantity:1,startDate:today,cycleStartedAt:today,renewalDays:365,alertDays:30,status:'Activa',healthStatus:'Sana',source:'',notes:''}
 const[form,setForm]=useState(empty)
 function save(e){
  e.preventDefault()
  const code=form.lotCode.trim()
  if(!code)return alert('Escribe el lote de abuelas.')
  if(state.grandmotherPlants.some(x=>x.lotCode.trim().toLowerCase()===code.toLowerCase()))return alert('Ese lote ya existe.')
  update(s=>({...s,grandmotherPlants:[...s.grandmotherPlants,{id:crypto.randomUUID(),createdAt:new Date().toISOString(),...form,lotCode:code}]}),{module:'Material vegetal',action:'Lote de abuelas creado',detail:code})
  setForm({...empty,siteId:form.siteId,geneticId:form.geneticId})
 }
 return <>
  <PageHeader title="Lotes de abuelas" subtitle="Las abuelas producen lotes de madres y se controlan por ciclo, renovación y desempeño."/>
  <div className="kpi-grid">{[
   ['Lotes activos',state.grandmotherPlants.filter(x=>x.status==='Activa').length],
   ['Unidades activas',state.grandmotherPlants.filter(x=>x.status==='Activa').reduce((s,x)=>s+Number(x.quantity||0),0)],
   ['Próximos',state.grandmotherPlants.filter(x=>{const t=renewalTiming(x);return t.remaining>=0&&t.remaining<=Number(x.alertDays||30)}).length],
   ['Madres generadas',state.motherPlants.reduce((s,x)=>s+Number(x.quantity||0),0)]
  ].map(([l,v])=><Card className="kpi-card" key={l}><span>{l}</span><strong>{v}</strong></Card>)}</div>
  <Card title="Crear lote de abuelas"><form className="form-grid" onSubmit={save}>
   <Field label="Lote"><input value={form.lotCode} placeholder="LAB-CAN1-2026-001" onChange={e=>setForm({...form,lotCode:e.target.value})}/></Field>
   <Field label="Sede"><select value={form.siteId} onChange={e=>setForm({...form,siteId:e.target.value})}>{state.sites.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
   <Field label="Genética"><select value={form.geneticId} onChange={e=>setForm({...form,geneticId:e.target.value})}>{state.genetics.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
   <Field label="Cantidad"><input type="number" min="1" value={form.quantity} onChange={e=>setForm({...form,quantity:Number(e.target.value)})}/></Field>
   <Field label="Inicio del ciclo"><input type="date" value={form.cycleStartedAt} onChange={e=>setForm({...form,cycleStartedAt:e.target.value})}/></Field>
   <Field label="Duración objetivo (días)"><input type="number" min="1" value={form.renewalDays} onChange={e=>setForm({...form,renewalDays:Number(e.target.value)})}/></Field>
   <Field label="Avisar antes (días)"><input type="number" min="0" value={form.alertDays} onChange={e=>setForm({...form,alertDays:Number(e.target.value)})}/></Field>
   <Field label="Fuente / origen"><input value={form.source} onChange={e=>setForm({...form,source:e.target.value})}/></Field>
   <Field label="Sanidad"><select value={form.healthStatus} onChange={e=>setForm({...form,healthStatus:e.target.value})}><option>Sana</option><option>En seguimiento</option><option>No apta</option></select></Field>
   <Field label="Observaciones"><textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></Field>
   <button className="button primary">Crear lote</button>
  </form></Card>
  <Card title="Plantas individuales"><MaterialPlantUnitExplorer state={state} lots={state.grandmotherPlants} plantType={MATERIAL_PLANT_TYPES.GRANDMOTHER} title="Abuelas individuales"/></Card>
  <Card title="Lotes registrados"><div className="table-scroll"><table><thead><tr><th>Lote</th><th>Genética</th><th>Cantidad</th><th>Semana</th><th>Restantes</th><th>Renovación</th><th>Madres originadas</th><th>Estado</th></tr></thead><tbody>{state.grandmotherPlants.map(x=>{const t=renewalTiming(x),m=state.motherPlants.filter(y=>y.grandmotherPlantId===x.id);return <tr key={x.id} className={t.remaining<0?'row-overdue':''}><td><strong>{x.lotCode}</strong></td><td>{state.genetics.find(g=>g.id===x.geneticId)?.name}</td><td>{x.quantity||1}</td><td>{t.week}</td><td>{t.remaining}</td><td>{t.dueDate}</td><td>{m.reduce((s,y)=>s+Number(y.quantity||0),0)} en {m.length} lotes</td><td><span className={`tag ${t.remaining<0?'danger-tag':t.remaining<=Number(x.alertDays||30)?'warning':'success'}`}>{t.status}</span></td></tr>})}</tbody></table></div></Card>
 </>
}
