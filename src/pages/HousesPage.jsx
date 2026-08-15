import{useState}from'react'
import Card from'../components/Card'
import CrudActions from'../components/CrudActions'
import FacilityAreaManager from'../components/FacilityAreaManager.jsx'
import BedManager from'../components/BedManager.jsx'
import PropagationBankManager from'../components/PropagationBankManager.jsx'
import Field from'../components/Field'
import PageHeader from'../components/PageHeader'
import{DomainEvents,publishDomainEvent}from'../core/events/index.js'
import{areaSquareMeters,formatArea,formatDensity,plantDensity}from'../domain/spaceMetrics'
import{executeCoreOperationCommand}from'../services/coreOperationCommand.js'
import{useStore}from'../services/store'

export default function HousesPage(){
 const{state,update}=useStore()
 const activeSites=state.sites.filter(site=>site.active!==false)
 const defaultSite=activeSites.some(site=>site.id===state.currentContext.siteId)?state.currentContext.siteId:activeSites[0]?.id||''
 const nextName=siteId=>`Nave ${state.houses.filter(x=>x.siteId===siteId&&x.active!==false).length+1}`
 const empty=siteId=>({siteId:siteId||'',areaId:'',name:nextName(siteId),notes:'',dimensionUnit:'m',length:0,width:0,height:0})
 const[house,setHouse]=useState(()=>empty(defaultSite)),[editingId,setEditingId]=useState(null)
 const availableAreas=(state.facilityAreas||[]).filter(area=>area.siteId===house.siteId&&area.active!==false)
 const organizationIdForSite=siteId=>state.sites.find(site=>site.id===siteId)?.companyId||''
 function reset(siteId=house.siteId){setEditingId(null);setHouse(empty(siteId))}
 async function execute(spec){return executeCoreOperationCommand(spec,{publishEvent:event=>publishDomainEvent(state,event),commit:update})}
 async function save(e){
  e.preventDefault()
  const site=activeSites.find(item=>item.id===house.siteId),name=house.name.trim()
  if(!site)return alert('Selecciona una sede activa para la nave.')
  if(!name)return alert('Escribe el nombre de la nave.')
  if(state.houses.some(x=>x.id!==editingId&&x.siteId===house.siteId&&x.active!==false&&String(x.name||'').trim().toLowerCase()===name.toLowerCase()))return alert('Ya existe una nave activa con ese nombre en la sede.')
  if(house.areaId&&!availableAreas.some(area=>area.id===house.areaId))return alert('Selecciona un área física activa de la misma sede.')
  const organizationId=organizationIdForSite(house.siteId)
  if(!organizationId)return alert('No se puede demostrar la empresa propietaria de la nave.')
  const dimensions={dimensionUnit:house.dimensionUnit||'m',length:Math.max(0,Number(house.length)||0),width:Math.max(0,Number(house.width)||0),height:Math.max(0,Number(house.height)||0)}
  try{
   if(editingId){
    const previous=state.houses.find(item=>item.id===editingId),after={...previous,...house,...dimensions,organizationId,siteId:house.siteId,name}
    await execute({commandId:crypto.randomUUID(),organizationId,siteId:house.siteId,aggregateType:'facility.house',aggregateId:editingId,completedEventName:DomainEvents.FACILITY_HOUSE_UPDATED,payload:{label:name,before:previous,after},metadata:{collections:['houses']},apply:store=>({...store,houses:store.houses.map(x=>x.id===editingId?after:x)})})
   }else{
    const id=crypto.randomUUID(),created={id,...house,...dimensions,organizationId,siteId:house.siteId,name,layout:'Visual',active:true,createdAt:new Date().toISOString()}
    await execute({commandId:crypto.randomUUID(),organizationId,siteId:house.siteId,aggregateType:'facility.house',aggregateId:id,completedEventName:DomainEvents.FACILITY_HOUSE_CREATED,payload:{label:name,house:created},metadata:{collections:['houses']},apply:store=>store.houses.some(item=>item.id===id)?store:{...store,houses:[...store.houses,created]}})
   }
   reset(house.siteId)
  }catch(error){alert(error.message||'No fue posible guardar la nave.')}
 }
 function edit(h){setEditingId(h.id);setHouse({siteId:h.siteId,areaId:h.areaId||'',name:h.name,notes:h.notes||'',dimensionUnit:h.dimensionUnit||'m',length:h.length||0,width:h.width||0,height:h.height||0})}
 async function archive(h){
  const activeBeds=state.beds.filter(b=>b.houseId===h.id&&b.active!==false)
  if(activeBeds.length)return alert(`No se puede archivar ${h.name}: tiene ${activeBeds.length} cama${activeBeds.length===1?'':'s'} activa${activeBeds.length===1?'':'s'}. Archiva primero sus camas.`)
  if(!confirm(`¿Archivar la nave ${h.name}? Su identidad e historial se conservarán.`))return
  const organizationId=organizationIdForSite(h.siteId)||h.organizationId||''
  if(!organizationId)return alert('No se puede demostrar la empresa propietaria de la nave.')
  const archivedAt=new Date().toISOString(),after={...h,organizationId,active:false,archivedAt}
  try{
   await execute({commandId:crypto.randomUUID(),organizationId,siteId:h.siteId,aggregateType:'facility.house',aggregateId:h.id,completedEventName:DomainEvents.FACILITY_HOUSE_ARCHIVED,occurredAt:archivedAt,payload:{label:h.name,before:h,after},metadata:{collections:['houses']},apply:store=>({...store,houses:store.houses.map(x=>x.id===h.id?after:x)})})
   if(editingId===h.id)reset(h.siteId)
  }catch(error){alert(error.message||'No fue posible archivar la nave.')}
 }
 const previewArea=areaSquareMeters(house.length,house.width,house.dimensionUnit)
 return <>
  <PageHeader title="Infraestructura de la sede" subtitle="Configura áreas físicas, naves, camas y bancos. Puedes crear tantas naves y tantas camas por nave como necesites; el mapa solo las representa."/>
  <FacilityAreaManager state={state} update={update}/>
  {!activeSites.length?<Card title="Primero crea una sede activa"><div className="empty-state"><strong>No es posible registrar naves todavía</strong><p>Una nave debe pertenecer a una sede activa.</p></div></Card>:<Card title={editingId?'Editar nave':'Nueva nave'} subtitle="La nave se crea como contenedor físico. Las camas se agregan después de forma independiente.">
   <form className="form-grid compact-form" onSubmit={save}>
    <Field label="Sede" required><select value={house.siteId} onChange={e=>{const siteId=e.target.value;setHouse({...house,siteId,areaId:'',name:editingId?house.name:nextName(siteId)})}}>{activeSites.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
    <Field label="Área física"><select value={house.areaId} onChange={e=>setHouse({...house,areaId:e.target.value})}><option value="">Sin área asignada</option>{availableAreas.map(area=><option key={area.id} value={area.id}>{area.name} · {(area.capabilities||[]).join(', ')}</option>)}</select></Field>
    <Field label="Nombre nave" required><input value={house.name} onChange={e=>setHouse({...house,name:e.target.value})}/></Field>
    <Field label="Unidad"><select value={house.dimensionUnit} onChange={e=>setHouse({...house,dimensionUnit:e.target.value})}><option value="m">Metros</option><option value="cm">Centímetros</option></select></Field>
    <Field label="Largo"><input type="number" min="0" step="0.01" value={house.length} onChange={e=>setHouse({...house,length:e.target.value})}/></Field>
    <Field label="Ancho"><input type="number" min="0" step="0.01" value={house.width} onChange={e=>setHouse({...house,width:e.target.value})}/></Field>
    <Field label="Alto"><input type="number" min="0" step="0.01" value={house.height} onChange={e=>setHouse({...house,height:e.target.value})}/></Field>
    <Field label="Observaciones"><input value={house.notes} onChange={e=>setHouse({...house,notes:e.target.value})}/></Field>
    <div className="management-summary span-all"><div><span>Área de piso</span><strong>{formatArea(previewArea)}</strong></div><div><span>Camas</span><strong>{editingId?state.beds.filter(b=>b.houseId===editingId&&b.active!==false).length:0}</strong></div></div>
    <div className="form-actions"><button className="button primary">{editingId?'Guardar nave':'Crear nave'}</button>{editingId&&<button type="button" className="button secondary" onClick={()=>reset()}>Cancelar</button>}</div>
   </form>
  </Card>}
  <Card title="Naves por sede" flush>{state.sites.map(site=>{const houses=state.houses.filter(h=>h.siteId===site.id);if(!houses.length)return null;return <section className="management-group" key={site.id}><header><div><strong>{site.name}</strong><span>{houses.filter(h=>h.active!==false).length} activas · {houses.length} históricas</span></div></header><div className="house-list">{houses.map(h=>{const beds=state.beds.filter(b=>b.houseId===h.id),activeBeds=beds.filter(b=>b.active!==false),plants=state.plantPositions.filter(p=>activeBeds.some(b=>b.id===p.bedId)),activePlants=plants.filter(p=>p.active!==false&&p.status!=='Vacía').length,open=state.findings.filter(f=>plants.some(p=>p.id===f.plantPositionId)&&!['Resuelto','Falso positivo'].includes(f.status)).length,area=areaSquareMeters(h.length,h.width,h.dimensionUnit),facilityArea=(state.facilityAreas||[]).find(item=>item.id===h.areaId);return <div className="house-list-card" key={h.id}><div><strong>{h.name}</strong><small>{facilityArea?.name||'Sin área asignada'} · {activeBeds.length} camas activas · {activePlants} plantas · {formatArea(area)} · {formatDensity(plantDensity(activePlants,area))}</small></div><span className={`tag ${h.active===false?'':open?'danger-tag':'success'}`}>{h.active===false?'Archivada':open?`${open} hallazgos`:'Sin alertas'}</span><CrudActions onEdit={h.active===false?undefined:()=>edit(h)} onDelete={h.active===false?undefined:()=>archive(h)}/></div>})}</div></section>})}</Card>
  <BedManager state={state} update={update}/>
  <PropagationBankManager state={state} update={update}/>
 </>
}
