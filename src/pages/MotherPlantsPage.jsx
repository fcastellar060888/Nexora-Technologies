import{useState}from'react'
import Card from'../components/Card'
import Field from'../components/Field'
import PageHeader from'../components/PageHeader'
import AttachmentUploader from'../components/AttachmentUploader'
import MaterialPlantUnitExplorer from'../components/MaterialPlantUnitExplorer'
import{useStore}from'../services/store'
import{renewalTiming,dateOnly,survivalMetrics}from'../domain/lifecycle'
import{MATERIAL_PLANT_TYPES}from'../domain/materialPlantIdentity.js'

export default function MotherPlantsPage(){
 const{state,update}=useStore(),today=dateOnly()
 const empty={grandmotherPlantId:state.grandmotherPlants[0]?.id||'',siteId:state.sites[0]?.id||'',geneticId:state.genetics[0]?.id||'',lotCode:'',quantity:1,cycleStartedAt:today,renewalDays:180,alertDays:30,status:'Activa',healthStatus:'Sana',notes:''}
 const[form,setForm]=useState(empty),[selected,setSelected]=useState(null)
 function save(e){
  e.preventDefault()
  if(!form.grandmotherPlantId)return alert('Selecciona el lote de abuelas de origen.')
  const code=form.lotCode.trim()
  if(!code)return alert('Escribe el lote de madres.')
  if(state.motherPlants.some(x=>x.lotCode.trim().toLowerCase()===code.toLowerCase()))return alert('Ese lote ya existe.')
  update(s=>({...s,motherPlants:[...s.motherPlants,{id:crypto.randomUUID(),createdAt:new Date().toISOString(),...form,lotCode:code}]}),{module:'Material vegetal',action:'Lote de madres creado',detail:code})
  setForm({...empty,grandmotherPlantId:form.grandmotherPlantId,siteId:form.siteId,geneticId:form.geneticId})
 }
 return <>
  <PageHeader title="Lotes de madres" subtitle="Cada lote nace de un lote de abuelas y produce los lotes productivos de esquejes."/>
  <div className="kpi-grid">{[
   ['Lotes activos',state.motherPlants.filter(x=>x.status==='Activa').length],
   ['Madres activas',state.motherPlants.filter(x=>x.status==='Activa').reduce((s,x)=>s+Number(x.quantity||0),0)],
   ['Próximos',state.motherPlants.filter(x=>renewalTiming(x).remaining<=Number(x.alertDays||30)).length],
   ['Lotes productivos',state.propagationBatches.length]
  ].map(([l,v])=><Card className="kpi-card" key={l}><span>{l}</span><strong>{v}</strong></Card>)}</div>
  <Card title="Generar lote de madres"><form className="form-grid" onSubmit={save}>
   <Field label="Lote de abuelas de origen"><select value={form.grandmotherPlantId} onChange={e=>{const g=state.grandmotherPlants.find(x=>x.id===e.target.value);setForm({...form,grandmotherPlantId:e.target.value,geneticId:g?.geneticId||form.geneticId,siteId:g?.siteId||form.siteId})}}><option value="">Seleccionar</option>{state.grandmotherPlants.filter(x=>x.status!=='Retirada').map(x=><option key={x.id} value={x.id}>{x.lotCode} · {state.genetics.find(g=>g.id===x.geneticId)?.name}</option>)}</select></Field>
   <Field label="Lote de madres"><input value={form.lotCode} placeholder="LM-CAN1-2026-001" onChange={e=>setForm({...form,lotCode:e.target.value})}/></Field>
   <Field label="Sede"><select value={form.siteId} onChange={e=>setForm({...form,siteId:e.target.value})}>{state.sites.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
   <Field label="Genética"><select value={form.geneticId} onChange={e=>setForm({...form,geneticId:e.target.value})}>{state.genetics.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
   <Field label="Cantidad"><input type="number" min="1" value={form.quantity} onChange={e=>setForm({...form,quantity:Number(e.target.value)})}/></Field>
   <Field label="Inicio del ciclo"><input type="date" value={form.cycleStartedAt} onChange={e=>setForm({...form,cycleStartedAt:e.target.value})}/></Field>
   <Field label="Duración objetivo (días)"><input type="number" min="1" value={form.renewalDays} onChange={e=>setForm({...form,renewalDays:Number(e.target.value)})}/></Field>
   <Field label="Avisar antes"><input type="number" min="0" value={form.alertDays} onChange={e=>setForm({...form,alertDays:Number(e.target.value)})}/></Field>
   <Field label="Sanidad"><select value={form.healthStatus} onChange={e=>setForm({...form,healthStatus:e.target.value})}><option>Sana</option><option>En seguimiento</option><option>No apta</option></select></Field>
   <Field label="Observaciones"><textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></Field>
   <button className="button primary">Crear lote</button>
  </form></Card>
  <Card title="Plantas individuales"><MaterialPlantUnitExplorer state={state} lots={state.motherPlants} plantType={MATERIAL_PLANT_TYPES.MOTHER} title="Madres individuales"/></Card>
  <Card title="Lotes registrados"><div className="table-scroll"><table><thead><tr><th>Lote madres</th><th>Origen abuelas</th><th>Genética</th><th>Cantidad</th><th>Semana</th><th>Restantes</th><th>Esquejes cortados</th><th>Enraizamiento</th><th></th></tr></thead><tbody>{state.motherPlants.map(x=>{const batches=state.propagationBatches.filter(b=>b.motherPlantId===x.id),units=state.propagationUnits.filter(u=>batches.some(b=>b.id===u.batchId)),m=survivalMetrics(units),t=renewalTiming(x);return <tr key={x.id} className={t.remaining<0?'row-overdue':''}><td><strong>{x.lotCode}</strong></td><td>{state.grandmotherPlants.find(g=>g.id===x.grandmotherPlantId)?.lotCode||'—'}</td><td>{state.genetics.find(g=>g.id===x.geneticId)?.name}</td><td>{x.quantity||1}</td><td>{t.week}</td><td>{t.remaining}</td><td>{units.length}</td><td>{m.rootingPct}%</td><td><button onClick={()=>setSelected(x)}>Ver lote</button></td></tr>})}</tbody></table></div></Card>
  {selected&&<Card title={`Trazabilidad · ${selected.lotCode}`}><div className="detail-grid"><div><span>Lote de abuelas</span><strong>{state.grandmotherPlants.find(g=>g.id===selected.grandmotherPlantId)?.lotCode||'—'}</strong></div><div><span>Lotes productivos</span><strong>{state.propagationBatches.filter(x=>x.motherPlantId===selected.id).length}</strong></div><div><span>Renovación prevista</span><strong>{renewalTiming(selected).dueDate}</strong></div><div><span>Estado</span><strong>{renewalTiming(selected).status}</strong></div></div><AttachmentUploader entityType="motherLot" entityId={selected.id}/></Card>}
 </>
}
