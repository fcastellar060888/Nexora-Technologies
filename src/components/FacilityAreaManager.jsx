import{useMemo,useState}from'react'
import Card from'./Card'
import CrudActions from'./CrudActions'
import Field from'./Field'
import{DomainEvents,publishDomainEvent}from'../core/events/index.js'
import{executeCoreOperationCommand}from'../services/coreOperationCommand.js'

export const SPACE_CAPABILITIES=['Material vegetal','Producción','Recepción','Secado','Destalle','Manicura','Selección','Empaque','Almacenamiento','Cuarentena','Compostaje','Destrucción','Extracción','Laboratorio','Limpieza']
const emptyArea=siteId=>({siteId:siteId||'',name:'',type:'Área operativa',capabilities:[],shared:false,dimensionUnit:'m',length:0,width:0,height:0,notes:''})

export default function FacilityAreaManager({state,update}){
 const areas=state.facilityAreas||[],activeSites=(state.sites||[]).filter(site=>site.active!==false),defaultSite=state.currentContext?.siteId&&activeSites.some(site=>site.id===state.currentContext.siteId)?state.currentContext.siteId:activeSites[0]?.id||''
 const[form,setForm]=useState(()=>emptyArea(defaultSite)),[editingId,setEditingId]=useState(null)
 const grouped=useMemo(()=>state.sites.map(site=>({site,areas:areas.filter(area=>area.siteId===site.id)})).filter(group=>group.areas.length),[state.sites,areas])
 function organizationIdForSite(siteId){return state.sites.find(site=>site.id===siteId)?.companyId||''}
 async function execute(spec){return executeCoreOperationCommand(spec,{publishEvent:event=>publishDomainEvent(state,event),commit:update})}
 function toggleCapability(value){setForm(current=>({...current,capabilities:current.capabilities.includes(value)?current.capabilities.filter(item=>item!==value):[...current.capabilities,value]}))}
 async function save(event){
  event.preventDefault()
  const name=form.name.trim(),site=activeSites.find(item=>item.id===form.siteId)
  if(!name)return alert('Escribe el nombre del área.')
  if(!site)return alert('Selecciona una sede activa.')
  if(!form.capabilities.length)return alert('Selecciona al menos una capacidad operativa.')
  if(areas.some(item=>item.id!==editingId&&item.siteId===form.siteId&&item.active!==false&&item.name.trim().toLowerCase()===name.toLowerCase()))return alert('Ya existe un área activa con ese nombre en la sede.')
  const organizationId=organizationIdForSite(form.siteId)
  if(!organizationId)return alert('No se puede demostrar la empresa propietaria del área.')
  const payload={...form,organizationId,name,shared:form.capabilities.length>1||Boolean(form.shared),length:Math.max(0,Number(form.length)||0),width:Math.max(0,Number(form.width)||0),height:Math.max(0,Number(form.height)||0)}
  try{
   if(editingId){
    const previous=areas.find(item=>item.id===editingId),after={...previous,...payload}
    await execute({commandId:crypto.randomUUID(),organizationId,siteId:form.siteId,aggregateType:'facility.area',aggregateId:editingId,completedEventName:DomainEvents.FACILITY_AREA_UPDATED,payload:{label:name,before:previous,after},metadata:{collections:['facilityAreas']},apply:store=>({...store,facilityAreas:(store.facilityAreas||[]).map(item=>item.id===editingId?after:item)})})
   }else{
    const id=crypto.randomUUID(),createdAt=new Date().toISOString(),area={id,createdAt,active:true,...payload}
    await execute({commandId:crypto.randomUUID(),organizationId,siteId:form.siteId,aggregateType:'facility.area',aggregateId:id,completedEventName:DomainEvents.FACILITY_AREA_CREATED,payload:{label:name,area},metadata:{collections:['facilityAreas']},apply:store=>(store.facilityAreas||[]).some(item=>item.id===id)?store:{...store,facilityAreas:[...(store.facilityAreas||[]),area]}})
   }
   setEditingId(null);setForm(emptyArea(form.siteId))
  }catch(error){alert(error.message||'No fue posible guardar el área.')}
 }
 function edit(area){setEditingId(area.id);setForm({...emptyArea(area.siteId),...area,capabilities:[...(area.capabilities||[])]})}
 async function archive(area){
  const linked=(state.houses||[]).filter(item=>item.areaId===area.id&&item.active!==false).length+(state.propagationBanks||[]).filter(item=>item.areaId===area.id&&item.active!==false).length
  if(linked)return alert(`No puedes archivar el área porque tiene ${linked} espacios activos vinculados.`)
  if(!confirm(`¿Archivar el área ${area.name}? Su identidad e historial se conservarán.`))return
  const organizationId=organizationIdForSite(area.siteId)||area.organizationId||''
  if(!organizationId)return alert('No se puede demostrar la empresa propietaria del área.')
  const archivedAt=new Date().toISOString(),after={...area,organizationId,active:false,archivedAt}
  try{
   await execute({commandId:crypto.randomUUID(),organizationId,siteId:area.siteId,aggregateType:'facility.area',aggregateId:area.id,completedEventName:DomainEvents.FACILITY_AREA_ARCHIVED,occurredAt:archivedAt,payload:{label:area.name,before:area,after},metadata:{collections:['facilityAreas']},apply:store=>({...store,facilityAreas:(store.facilityAreas||[]).map(item=>item.id===area.id?after:item)})})
   if(editingId===area.id){setEditingId(null);setForm(emptyArea(defaultSite))}
  }catch(error){alert(error.message||'No fue posible archivar el área.')}
 }
 return <>
  <Card title={editingId?'Editar área física':'Nueva área física'} subtitle="El espacio es único; sus capacidades pueden ser exclusivas, compartidas o cambiar por programación.">
   <form className="form-grid" onSubmit={save}>
    <Field label="Sede" required><select value={form.siteId} onChange={event=>setForm({...form,siteId:event.target.value})}><option value="">Seleccionar</option>{activeSites.map(site=><option key={site.id} value={site.id}>{site.name}</option>)}</select></Field>
    <Field label="Nombre" required><input value={form.name} onChange={event=>setForm({...form,name:event.target.value})} placeholder="Sala de procesamiento"/></Field>
    <Field label="Tipo de espacio"><select value={form.type} onChange={event=>setForm({...form,type:event.target.value})}><option>Área operativa</option><option>Nave</option><option>Sala</option><option>Cuarto</option><option>Almacén</option><option>Zona exterior</option><option>Laboratorio</option><option>Otro</option></select></Field>
    <Field label="Unidad"><select value={form.dimensionUnit} onChange={event=>setForm({...form,dimensionUnit:event.target.value})}><option value="m">Metros</option><option value="cm">Centímetros</option></select></Field>
    <Field label="Largo"><input type="number" min="0" step="0.01" value={form.length} onChange={event=>setForm({...form,length:event.target.value})}/></Field>
    <Field label="Ancho"><input type="number" min="0" step="0.01" value={form.width} onChange={event=>setForm({...form,width:event.target.value})}/></Field>
    <Field label="Alto"><input type="number" min="0" step="0.01" value={form.height} onChange={event=>setForm({...form,height:event.target.value})}/></Field>
    <Field label="Observaciones"><textarea value={form.notes} onChange={event=>setForm({...form,notes:event.target.value})}/></Field>
    <div className="span-all"><strong>Capacidades operativas</strong><div className="selection-toolbar">{SPACE_CAPABILITIES.map(value=><label className="selection-chip" key={value}><input type="checkbox" checked={form.capabilities.includes(value)} onChange={()=>toggleCapability(value)}/><span>{value}</span></label>)}</div></div>
    <div className="management-summary span-all"><div><span>Modalidad</span><strong>{form.capabilities.length>1?'Área compartida':'Uso exclusivo'}</strong></div><div><span>Capacidades</span><strong>{form.capabilities.length}</strong></div></div>
    <div className="form-actions"><button className="button primary">{editingId?'Guardar área':'Crear área'}</button>{editingId&&<button type="button" className="button secondary" onClick={()=>{setEditingId(null);setForm(emptyArea(defaultSite))}}>Cancelar</button>}</div>
   </form>
  </Card>
  <Card title="Áreas configuradas">{grouped.length?grouped.map(({site,areas:siteAreas})=><div className="site-group" key={site.id}><div className="site-group-head"><h4>{site.name}</h4><span>{siteAreas.length} áreas</span></div><div className="house-list">{siteAreas.map(area=><div className="house-list-card" key={area.id}><div><strong>{area.name}</strong><small>{area.type} · {(area.capabilities||[]).join(' · ')}</small></div><span className={`tag ${area.active===false?'':'success'}`}>{area.active===false?'Archivada':area.shared||area.capabilities?.length>1?'Compartida':'Exclusiva'}</span><CrudActions onEdit={area.active===false?undefined:()=>edit(area)} onDelete={area.active===false?undefined:()=>archive(area)}/></div>)}</div></div>):<div className="empty-state"><strong>No hay áreas físicas configuradas</strong><p>Crea áreas para reflejar cultivo, postcosecha, almacenamiento y espacios compartidos.</p></div>}</Card>
 </>
}
