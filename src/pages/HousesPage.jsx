import{useState}from'react'
import Card from'../components/Card'
import CrudActions from'../components/CrudActions'
import FacilityAreaManager from'../components/FacilityAreaManager.jsx'
import PropagationBankManager from'../components/PropagationBankManager.jsx'
import Field from'../components/Field'
import PageHeader from'../components/PageHeader'
import{DomainEvents,publishDomainEvent}from'../core/events/index.js'
import{generatePlantPositions}from'../domain/map'
import{areaSquareMeters,formatArea,formatDensity,plantDensity}from'../domain/spaceMetrics'
import{useStore}from'../services/store'

const MEDIUMS=['Coco','Turba','Tierra','Mezcla','Otro']

export default function HousesPage(){
 const{state,update}=useStore()
 const activeSites=state.sites.filter(site=>site.active!==false)
 const defaultSite=activeSites.some(site=>site.id===state.currentContext.siteId)?state.currentContext.siteId:activeSites[0]?.id||''
 const nextName=siteId=>`Nave ${state.houses.filter(x=>x.siteId===siteId&&x.active!==false).length+1}`
 const h0={siteId:defaultSite,areaId:'',name:nextName(defaultSite),notes:'',dimensionUnit:'m',length:0,width:0,height:0}
 const b0={name:'Cama 1',rows:2,plantsPerRow:25,activePlants:50,geneticId:state.genetics[0]?.id||'',side:'Centro',order:1,containerType:'Matera',containerVolumeLiters:10,plantsPerContainer:1,growingMedium:'Coco'}
 const[house,setHouse]=useState(h0),[bed,setBed]=useState(b0),[editingId,setEditingId]=useState(null)
 const availableAreas=(state.facilityAreas||[]).filter(area=>area.siteId===house.siteId&&area.active!==false)
 const organizationIdForSite=siteId=>state.sites.find(site=>site.id===siteId)?.companyId||''

 function save(e){
  e.preventDefault()
  const site=activeSites.find(item=>item.id===house.siteId),name=house.name.trim()
  if(!site)return alert('Selecciona una sede activa para la nave.')
  if(!name)return alert('Escribe el nombre de la nave.')
  if(state.houses.some(x=>x.id!==editingId&&x.siteId===house.siteId&&x.active!==false&&x.name.trim().toLowerCase()===name.toLowerCase()))return alert('Ya existe una nave activa con ese nombre en la sede.')
  if(house.areaId&&!availableAreas.some(area=>area.id===house.areaId))return alert('Selecciona un área física activa de la misma sede.')
  const dimensions={dimensionUnit:house.dimensionUnit||'m',length:Math.max(0,Number(house.length)||0),width:Math.max(0,Number(house.width)||0),height:Math.max(0,Number(house.height)||0)}
  if(editingId){
   const previous=state.houses.find(item=>item.id===editingId),after={...previous,...house,...dimensions,name}
   update(s=>({...s,houses:s.houses.map(x=>x.id===editingId?after:x)}),{module:'Infraestructura',action:'Nave actualizada',detail:name})
   void publishDomainEvent(state,{name:DomainEvents.FACILITY_HOUSE_UPDATED,aggregateType:'facility.house',aggregateId:editingId,organizationId:organizationIdForSite(house.siteId),siteId:house.siteId,payload:{label:name,before:previous,after},metadata:{collections:['houses']}})
  }else{
   const hid=crypto.randomUUID(),bid=crypto.randomUUID()
   const profile={containerType:bed.containerType||'Matera',containerVolumeLiters:Math.max(0,Number(bed.containerVolumeLiters)||10),plantsPerContainer:Math.max(1,Number(bed.plantsPerContainer)||1),growingMedium:bed.growingMedium||'Coco'}
   const positions=generatePlantPositions(bid,Number(bed.rows),Number(bed.plantsPerRow),Number(bed.activePlants),bed.geneticId).map(position=>({...position,...profile}))
   const created={id:hid,...house,...dimensions,name,layout:'Visual',active:true,createdAt:new Date().toISOString()}
   update(s=>({...s,houses:[...s.houses,created],beds:[...s.beds,{id:bid,houseId:hid,active:true,...bed,...profile,containerProfileId:`${profile.containerType.toLowerCase()}-${profile.containerVolumeLiters}l`}],plantPositions:[...s.plantPositions,...positions]}),{module:'Infraestructura',action:'Nave creada',detail:name})
   void publishDomainEvent(state,{name:DomainEvents.FACILITY_HOUSE_CREATED,aggregateType:'facility.house',aggregateId:hid,organizationId:organizationIdForSite(house.siteId),siteId:house.siteId,payload:{label:name,house:created},metadata:{collections:['houses']}})
  }
  setEditingId(null)
  setHouse({...h0,siteId:house.siteId,areaId:house.areaId,name:nextName(house.siteId)})
  setBed({...b0,geneticId:state.genetics[0]?.id||''})
 }

 function archive(houseRecord){
  const activeBeds=state.beds.filter(b=>b.houseId===houseRecord.id&&b.active!==false)
  const bedIds=activeBeds.map(b=>b.id)
  const activePositions=state.plantPositions.filter(p=>bedIds.includes(p.bedId)&&p.active!==false).length
  if(activeBeds.length||activePositions)return alert(`No se puede archivar ${houseRecord.name}: conserva ${activeBeds.length} cama${activeBeds.length===1?'':'s'} activa${activeBeds.length===1?'':'s'} y ${activePositions} posición${activePositions===1?'':'es'} activa${activePositions===1?'':'s'}. Archiva primero sus dependencias.`)
  if(!confirm(`¿Archivar la nave ${houseRecord.name}? Su identidad, camas históricas y hallazgos se conservarán.`))return
  const archivedAt=new Date().toISOString(),previous=houseRecord,after={...houseRecord,active:false,archivedAt}
  update(s=>({...s,houses:s.houses.map(item=>item.id===houseRecord.id?after:item)}),{module:'Infraestructura',action:'Nave archivada',detail:houseRecord.name})
  void publishDomainEvent(state,{name:DomainEvents.FACILITY_HOUSE_ARCHIVED,aggregateType:'facility.house',aggregateId:houseRecord.id,organizationId:organizationIdForSite(houseRecord.siteId),siteId:houseRecord.siteId,payload:{label:houseRecord.name,before:previous,after},metadata:{collections:['houses']}})
  if(editingId===houseRecord.id){setEditingId(null);setHouse(h0)}
 }

 const previewArea=areaSquareMeters(house.length,house.width,house.dimensionUnit)
 const previewPlants=editingId?state.plantPositions.filter(p=>state.beds.some(b=>b.houseId===editingId&&b.id===p.bedId)&&p.active).length:Number(bed.activePlants)||0
 const substrateLiters=previewPlants*(Number(bed.containerVolumeLiters)||0)

 return <>
  <PageHeader title="Infraestructura, naves, camas y bancos" subtitle="Configura la estructura física del cultivo. El mapa unificado la representa como resumen operativo, sin crear ni mover infraestructura."/>
  <FacilityAreaManager state={state} update={update}/>
  {!activeSites.length?<Card title="Primero crea una sede activa"><div className="empty-state"><strong>No es posible registrar naves todavía</strong><p>Una nave debe pertenecer a una sede activa.</p></div></Card>:<Card title={editingId?'Editar nave':'Nueva nave'}>
   <form className="form-grid compact-form" onSubmit={save}>
    <Field label="Sede"><select value={house.siteId} onChange={e=>{const siteId=e.target.value;setHouse({...house,siteId,areaId:'',name:editingId?house.name:nextName(siteId)})}}>{activeSites.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
    <Field label="Área física" help="Opcional para datos históricos; recomendado para nuevas naves."><select value={house.areaId} onChange={e=>setHouse({...house,areaId:e.target.value})}><option value="">Sin área asignada</option>{availableAreas.map(area=><option key={area.id} value={area.id}>{area.name} · {(area.capabilities||[]).join(', ')}</option>)}</select></Field>
    <Field label="Nombre nave"><input value={house.name} onChange={e=>setHouse({...house,name:e.target.value})}/></Field>
    <Field label="Unidad de medida"><select value={house.dimensionUnit} onChange={e=>setHouse({...house,dimensionUnit:e.target.value})}><option value="m">Metros</option><option value="cm">Centímetros</option></select></Field>
    <Field label="Largo"><input type="number" min="0" step="0.01" value={house.length} onChange={e=>setHouse({...house,length:e.target.value})}/></Field>
    <Field label="Ancho"><input type="number" min="0" step="0.01" value={house.width} onChange={e=>setHouse({...house,width:e.target.value})}/></Field>
    <Field label="Alto"><input type="number" min="0" step="0.01" value={house.height} onChange={e=>setHouse({...house,height:e.target.value})}/></Field>
    <Field label="Observaciones"><input value={house.notes} onChange={e=>setHouse({...house,notes:e.target.value})}/></Field>
    {!editingId&&<>
     <Field label="Nombre cama inicial"><input value={bed.name} onChange={e=>setBed({...bed,name:e.target.value})}/></Field>
     <Field label="Genética"><select value={bed.geneticId} onChange={e=>setBed({...bed,geneticId:e.target.value})}>{state.genetics.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select></Field>
     <Field label="Filas"><input type="number" min="1" value={bed.rows} onChange={e=>setBed({...bed,rows:Number(e.target.value)})}/></Field>
     <Field label="Plantas por fila"><input type="number" min="1" value={bed.plantsPerRow} onChange={e=>setBed({...bed,plantsPerRow:Number(e.target.value)})}/></Field>
     <Field label="Plantas activas"><input type="number" min="0" max={bed.rows*bed.plantsPerRow} value={bed.activePlants} onChange={e=>setBed({...bed,activePlants:Number(e.target.value)})}/></Field>
     <Field label="Tipo de contenedor"><select value={bed.containerType} onChange={e=>setBed({...bed,containerType:e.target.value})}><option>Matera</option><option>Bolsa</option><option>Cama viva</option><option>Otro</option></select></Field>
     <Field label="Volumen por contenedor (L)"><input type="number" min="0" step="0.1" value={bed.containerVolumeLiters} onChange={e=>setBed({...bed,containerVolumeLiters:Number(e.target.value)})}/></Field>
     <Field label="Plantas por contenedor"><input type="number" min="1" value={bed.plantsPerContainer} onChange={e=>setBed({...bed,plantsPerContainer:Number(e.target.value)})}/></Field>
     <Field label="Medio de cultivo"><select value={bed.growingMedium} onChange={e=>setBed({...bed,growingMedium:e.target.value})}>{MEDIUMS.map(x=><option key={x}>{x}</option>)}</select></Field>
    </>}
    <div className="management-summary"><div><span>Área de piso</span><strong>{formatArea(previewArea)}</strong></div><div><span>Densidad estimada</span><strong>{formatDensity(plantDensity(previewPlants,previewArea))}</strong></div>{!editingId&&<div><span>Capacidad de medio</span><strong>{substrateLiters.toLocaleString('es-CO')} L</strong></div>}</div>
    <div className="form-actions"><button className="button primary">{editingId?'Guardar':'Crear nave'}</button>{editingId&&<button type="button" className="button secondary" onClick={()=>{setEditingId(null);setHouse(h0)}}>Cancelar</button>}</div>
   </form>
  </Card>}
  <Card title="Naves por sede">{state.sites.map(site=>{const houses=state.houses.filter(h=>h.siteId===site.id);if(!houses.length)return null;return <div className="site-group" key={site.id}><div className="site-group-head"><h4>{site.name}</h4><span>{houses.length} naves</span></div><div className="house-list">{houses.map(h=>{const beds=state.beds.filter(b=>b.houseId===h.id),plants=state.plantPositions.filter(p=>beds.some(b=>b.id===p.bedId)),activePlants=plants.filter(p=>p.active).length,open=state.findings.filter(f=>plants.some(p=>p.id===f.plantPositionId)&&!['Resuelto','Falso positivo'].includes(f.status)).length,area=areaSquareMeters(h.length,h.width,h.dimensionUnit),profiles=[...new Set(beds.map(b=>`${b.containerType||'Matera'} ${b.containerVolumeLiters||10} L · ${b.growingMedium||'Sin medio'}`))],facilityArea=(state.facilityAreas||[]).find(item=>item.id===h.areaId);return <div className="house-list-card" key={h.id}><div><strong>{h.name}</strong><small>{facilityArea?.name||'Sin área asignada'} · {beds.length} camas · {activePlants} plantas · {formatArea(area)} · {formatDensity(plantDensity(activePlants,area))}</small><small>{profiles.join(' | ')}</small></div><span className={`tag ${h.active===false?'':open?'danger-tag':'success'}`}>{h.active===false?'Archivada':`${open} hallazgos`}</span><CrudActions onEdit={h.active===false?undefined:()=>{setEditingId(h.id);setHouse({siteId:h.siteId,areaId:h.areaId||'',name:h.name,notes:h.notes||'',dimensionUnit:h.dimensionUnit||'m',length:h.length||0,width:h.width||0,height:h.height||0})}} onDelete={h.active===false?undefined:()=>archive(h)}/></div>})}</div></div>})}</Card>
  <PropagationBankManager state={state} update={update}/>
 </>
}
