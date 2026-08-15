import{useMemo,useState}from'react'
import Card from'./Card'
import CrudActions from'./CrudActions'
import Field from'./Field'
import{DomainEvents,publishDomainEvent}from'../core/events/index.js'
import{createProductionPositions}from'../domain/facilityEngine.js'
import{archiveBed}from'../domain/facilityLifecycle.js'
import{executeCoreOperationCommand}from'../services/coreOperationCommand.js'

const emptyBed=houseId=>({houseId:houseId||'',name:'',rows:2,plantsPerRow:25,activePlants:0,geneticId:'',side:'Centro',order:1,containerType:'Matera',containerVolumeLiters:10,plantsPerContainer:1})

export default function BedManager({state,update}){
 const activeHouses=state.houses.filter(h=>h.active!==false)
 const[form,setForm]=useState(()=>emptyBed(activeHouses[0]?.id)),[editingId,setEditingId]=useState(null)
 const houseById=useMemo(()=>Object.fromEntries(state.houses.map(h=>[h.id,h])),[state.houses])
 function reset(houseId=form.houseId){setEditingId(null);setForm(emptyBed(houseId))}
 async function execute(spec){return executeCoreOperationCommand(spec,{publishEvent:event=>publishDomainEvent(state,event),commit:update})}
 async function save(e){
  e.preventDefault()
  const house=houseById[form.houseId],name=form.name.trim()
  if(!house||house.active===false)return alert('Selecciona una nave activa.')
  if(!name)return alert('Escribe el nombre de la cama.')
  if(state.beds.some(b=>b.id!==editingId&&b.houseId===form.houseId&&b.active!==false&&String(b.name||'').trim().toLowerCase()===name.toLowerCase()))return alert('Ya existe una cama activa con ese nombre dentro de la nave.')
  const rows=Math.max(1,Number(form.rows)||1),plantsPerRow=Math.max(1,Number(form.plantsPerRow)||1),capacity=rows*plantsPerRow
  const activePlants=Math.max(0,Math.min(capacity,Number(form.activePlants)||0))
  const profile={containerType:form.containerType||'Matera',containerVolumeLiters:Math.max(0,Number(form.containerVolumeLiters)||10),plantsPerContainer:Math.max(1,Number(form.plantsPerContainer)||1)}
  const site=state.sites.find(s=>s.id===house.siteId),organizationId=site?.companyId||house.organizationId||''
  if(!organizationId)return alert('No se puede demostrar la empresa propietaria de la cama.')
  try{
   if(editingId){
    const previous=state.beds.find(b=>b.id===editingId)
    const positions=state.plantPositions.filter(p=>p.bedId===editingId)
    if(positions.length&&(rows!==Number(previous.rows)||plantsPerRow!==Number(previous.plantsPerRow)))return alert('No puedes cambiar filas o posiciones de una cama que ya tiene posiciones creadas. Crea una nueva cama si necesitas otra distribución.')
    const after={...previous,...form,name,...profile,rows,plantsPerRow,order:Number(form.order)||1,organizationId,siteId:house.siteId}
    await execute({commandId:crypto.randomUUID(),organizationId,siteId:house.siteId,aggregateType:'facility.bed',aggregateId:editingId,completedEventName:DomainEvents.FACILITY_BED_UPDATED,payload:{label:name,before:previous,after},metadata:{collections:['beds']},apply:store=>({...store,beds:store.beds.map(b=>b.id===editingId?after:b)})})
   }else{
    const id=crypto.randomUUID(),createdAt=new Date().toISOString(),bed={id,organizationId,siteId:house.siteId,active:true,createdAt,...form,name,...profile,rows,plantsPerRow,activePlants,order:Number(form.order)||1,containerProfileId:`${profile.containerType.toLowerCase()}-${profile.containerVolumeLiters}l`,growingMediumAssignmentId:''}
    const positions=createProductionPositions({organizationId,siteId:house.siteId,bedId:id,rows,plantsPerRow,activePlants,geneticId:form.geneticId,containerProfileId:bed.containerProfileId,containerType:profile.containerType,volumeLiters:profile.containerVolumeLiters,plantsPerContainer:profile.plantsPerContainer}).map(position=>({...position,containerVolumeLiters:profile.containerVolumeLiters}))
    await execute({commandId:crypto.randomUUID(),organizationId,siteId:house.siteId,aggregateType:'facility.bed',aggregateId:id,completedEventName:DomainEvents.FACILITY_BED_CREATED,payload:{label:name,bed},metadata:{collections:['beds','plantPositions']},apply:store=>store.beds.some(item=>item.id===id)?store:{...store,beds:[...store.beds,bed],plantPositions:[...store.plantPositions,...positions]}})
   }
   reset(form.houseId)
  }catch(error){alert(error.message||'No fue posible guardar la cama.')}
 }
 function edit(b){setEditingId(b.id);setForm({...emptyBed(b.houseId),...b,activePlants:state.plantPositions.filter(p=>p.bedId===b.id&&p.active!==false&&p.status!=='Vacía').length})}
 async function archive(b){
  if(!confirm(`¿Archivar la cama ${b.name}? Sus posiciones e historial se conservarán.`))return
  try{
   const preview=archiveBed(state,b.id),house=houseById[b.houseId],site=state.sites.find(s=>s.id===house?.siteId),organizationId=site?.companyId||b.organizationId||'',after=preview.beds.find(x=>x.id===b.id)
   if(!organizationId)throw new Error('No se puede demostrar la empresa propietaria de la cama.')
   await execute({commandId:crypto.randomUUID(),organizationId,siteId:house?.siteId||b.siteId||'',aggregateType:'facility.bed',aggregateId:b.id,completedEventName:DomainEvents.FACILITY_BED_ARCHIVED,payload:{label:b.name,before:b,after},metadata:{collections:['beds']},apply:current=>archiveBed(current,b.id)})
   if(editingId===b.id)reset(b.houseId)
  }catch(error){alert(error.message)}
 }
 return <>
  <Card title={editingId?'Editar cama':'Agregar cama a una nave'} subtitle="La cama define geometría y contenedor. El medio de cultivo se asigna desde Medios de cultivo con lote, costo y política de reutilización.">
   {!activeHouses.length?<div className="empty-state"><strong>No hay naves activas</strong><p>Crea una nave antes de agregar camas.</p></div>:<form className="form-grid compact-form" onSubmit={save}>
    <Field label="Nave" required><select value={form.houseId} onChange={e=>setForm({...form,houseId:e.target.value})}>{activeHouses.map(h=><option key={h.id} value={h.id}>{state.sites.find(s=>s.id===h.siteId)?.name||'Sede'} · {h.name}</option>)}</select></Field>
    <Field label="Nombre de cama" required><input value={form.name} placeholder="Ej. Cama 2" onChange={e=>setForm({...form,name:e.target.value})}/></Field>
    <Field label="Orden"><input type="number" min="1" value={form.order} onChange={e=>setForm({...form,order:Number(e.target.value)})}/></Field>
    <Field label="Genética"><select value={form.geneticId} onChange={e=>setForm({...form,geneticId:e.target.value})}><option value="">Sin asignar</option>{state.genetics.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select></Field>
    <Field label="Filas"><input type="number" min="1" disabled={Boolean(editingId)} value={form.rows} onChange={e=>setForm({...form,rows:Number(e.target.value)})}/></Field>
    <Field label="Plantas por fila"><input type="number" min="1" disabled={Boolean(editingId)} value={form.plantsPerRow} onChange={e=>setForm({...form,plantsPerRow:Number(e.target.value)})}/></Field>
    {!editingId&&<Field label="Plantas activas iniciales"><input type="number" min="0" max={form.rows*form.plantsPerRow} value={form.activePlants} onChange={e=>setForm({...form,activePlants:Number(e.target.value)})}/></Field>}
    <Field label="Tipo de contenedor"><select value={form.containerType} onChange={e=>setForm({...form,containerType:e.target.value})}><option>Matera</option><option>Bolsa</option><option>Cama viva</option><option>Otro</option></select></Field>
    <Field label="Volumen (L)"><input type="number" min="0" step="0.1" value={form.containerVolumeLiters} onChange={e=>setForm({...form,containerVolumeLiters:Number(e.target.value)})}/></Field>
    <div className="form-actions"><button className="button primary">{editingId?'Guardar cama':'Agregar cama'}</button>{editingId&&<button type="button" className="button secondary" onClick={()=>reset()}>Cancelar</button>}</div>
   </form>}
  </Card>
  <Card title="Camas por nave" flush>{activeHouses.map(h=>{const beds=state.beds.filter(b=>b.houseId===h.id);if(!beds.length)return null;return <section className="management-group" key={h.id}><header><div><strong>{h.name}</strong><span>{beds.filter(b=>b.active!==false).length} activas · {beds.length} históricas</span></div></header><div className="table-scroll"><table><thead><tr><th>Cama</th><th>Distribución</th><th>Plantas activas</th><th>Medio</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{beds.sort((a,b)=>(a.order||0)-(b.order||0)).map(b=>{const active=state.plantPositions.filter(p=>p.bedId===b.id&&p.active!==false&&p.status!=='Vacía').length;return <tr key={b.id}><td><strong>{b.name}</strong></td><td>{b.rows} × {b.plantsPerRow}</td><td>{active}</td><td>{b.growingMediumAssignmentId?'Asignado':'Sin asignar'}</td><td><span className={`tag ${b.active===false?'':'success'}`}>{b.active===false?'Archivada':'Activa'}</span></td><td><CrudActions onEdit={b.active===false?undefined:()=>edit(b)} onDelete={b.active===false?undefined:()=>archive(b)}/></td></tr>})}</tbody></table></div></section>})}</Card>
 </>
}