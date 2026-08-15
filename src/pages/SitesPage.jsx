import{useMemo,useState}from'react'
import Card from'../components/Card'
import CrudActions from'../components/CrudActions'
import Field from'../components/Field'
import PageHeader from'../components/PageHeader'
import{DomainEvents,publishDomainEvent}from'../core/events/index.js'
import{TimelineFeed}from'../core/timeline/ui.js'
import{executeCoreOperationCommand}from'../services/coreOperationCommand.js'
import{useStore}from'../services/store'

const normalize=value=>value.trim().replace(/\s+/g,' ')
const createEmpty=companies=>({companyId:companies[0]?.id||'',name:'',location:'',manager:''})

export default function SitesPage(){
 const{state,update}=useStore()
 const[form,setForm]=useState(()=>createEmpty(state.companies.filter(company=>company.active!==false)))
 const[editingId,setEditingId]=useState(null)
 const[message,setMessage]=useState(null)
 const houseCountBySite=useMemo(()=>state.houses.filter(house=>house.active!==false).reduce((counts,house)=>({...counts,[house.siteId]:(counts[house.siteId]||0)+1}),{}),[state.houses])
 const companyById=useMemo(()=>Object.fromEntries(state.companies.map(company=>[company.id,company])),[state.companies])
 function resetForm(){setEditingId(null);setForm(createEmpty(state.companies.filter(company=>company.active!==false)));setMessage(null)}
 async function execute(spec){return executeCoreOperationCommand(spec,{publishEvent:event=>publishDomainEvent(state,event),commit:update})}
 async function save(event){
  event.preventDefault()
  const company=companyById[form.companyId],name=normalize(form.name),location=normalize(form.location),manager=normalize(form.manager)
  if(!company||company.active===false){setMessage({tone:'error',text:'Selecciona una empresa activa y válida para la sede.'});return}
  if(!name){setMessage({tone:'error',text:'Escribe el nombre de la sede.'});return}
  if(state.sites.some(site=>site.id!==editingId&&site.companyId===form.companyId&&site.active!==false&&normalize(site.name).toLocaleLowerCase('es')===name.toLocaleLowerCase('es'))){setMessage({tone:'error',text:`Ya existe una sede activa llamada ${name} dentro de ${company.name}.`});return}
  const payload={companyId:form.companyId,name,location,manager}
  try{
   if(editingId){
    const previous=state.sites.find(site=>site.id===editingId),after={...previous,...payload}
    await execute({commandId:crypto.randomUUID(),organizationId:form.companyId,siteId:editingId,aggregateType:'site',aggregateId:editingId,completedEventName:DomainEvents.SITE_UPDATED,payload:{label:`${company.name} · ${name}`,before:previous,after},metadata:{collections:['sites']},audit:{module:'Sedes',action:'Sede actualizada',detail:name},apply:store=>({...store,sites:store.sites.map(site=>site.id===editingId?after:site)})})
    setMessage({tone:'success',text:'Sede actualizada correctamente.'})
   }else{
    const id=crypto.randomUUID(),site={id,active:true,...payload}
    await execute({commandId:crypto.randomUUID(),organizationId:form.companyId,siteId:id,aggregateType:'site',aggregateId:id,completedEventName:DomainEvents.SITE_CREATED,payload:{label:`${company.name} · ${name}`,site},metadata:{collections:['sites']},audit:{module:'Sedes',action:'Sede creada',detail:name},apply:store=>store.sites.some(item=>item.id===id)?store:{...store,sites:[...store.sites,site]}})
    setMessage({tone:'success',text:'Sede creada correctamente.'})
   }
   setEditingId(null);setForm(createEmpty(state.companies.filter(company=>company.active!==false)))
  }catch(error){setMessage({tone:'error',text:error.message||'No fue posible confirmar la operación.'})}
 }
 function edit(site){setEditingId(site.id);setForm({companyId:site.companyId||'',name:site.name,location:site.location||'',manager:site.manager||''});setMessage(null);window.scrollTo({top:0,behavior:'smooth'})}
 async function archive(site){
  const houseCount=houseCountBySite[site.id]||0
  if(houseCount){setMessage({tone:'error',text:`No se puede archivar ${site.name}: tiene ${houseCount} nave${houseCount===1?'':'s'} activa${houseCount===1?'':'s'}. Archiva primero sus espacios dependientes activos.`});return}
  if(!confirm(`¿Archivar la sede ${site.name}? Su identidad e historial se conservarán.`))return
  const archivedAt=new Date().toISOString(),after={...site,active:false,archivedAt}
  try{
   await execute({commandId:crypto.randomUUID(),organizationId:site.companyId,siteId:site.id,aggregateType:'site',aggregateId:site.id,completedEventName:DomainEvents.SITE_ARCHIVED,occurredAt:archivedAt,payload:{label:site.name,before:site,after},metadata:{collections:['sites']},audit:{module:'Sedes',action:'Sede archivada',detail:site.name},apply:store=>({...store,sites:store.sites.map(item=>item.id===site.id?after:item)})})
   if(editingId===site.id)resetForm()
   setMessage({tone:'success',text:'Sede archivada. Su historial fue preservado.'})
  }catch(error){setMessage({tone:'error',text:error.message||'No fue posible archivar la sede.'})}
 }
 const activeCompanies=state.companies.filter(company=>company.active!==false)
 const groupedSites=state.companies.map(company=>({company,sites:state.sites.filter(site=>site.companyId===company.id)})).filter(group=>group.sites.length)
 return <>
  <PageHeader eyebrow="Estructura organizacional" title="Sedes" subtitle="Cada sede representa una finca, planta o centro productivo perteneciente a una empresa."/>
  <div className="management-summary" aria-label="Resumen de sedes"><div><span>Sedes registradas</span><strong>{state.sites.length}</strong></div><div><span>Empresas con sedes</span><strong>{new Set(state.sites.map(site=>site.companyId)).size}</strong></div><div><span>Naves asociadas</span><strong>{state.houses.length}</strong></div></div>
  {!activeCompanies.length?<Card title="Primero crea una empresa activa"><div className="empty-state"><strong>No es posible registrar sedes todavía</strong><p>Una sede siempre debe pertenecer a una empresa activa. Crea o habilita la organización antes de continuar.</p></div></Card>:<Card title={editingId?'Editar sede':'Nueva sede'} subtitle="El nombre de la sede debe ser único dentro de la empresa seleccionada."><form className="form-grid management-form" onSubmit={save} noValidate><Field label="Empresa" required help="Organización propietaria o responsable de esta sede."><select value={form.companyId} required onChange={event=>{setForm({...form,companyId:event.target.value});setMessage(null)}}><option value="">Selecciona una empresa</option>{activeCompanies.map(company=><option key={company.id} value={company.id}>{company.name}</option>)}</select></Field><Field label="Nombre de la sede" required help="Nombre con el que se reconocerá la finca o centro productivo."><input value={form.name} required placeholder="Ej. Villeta" onChange={event=>{setForm({...form,name:event.target.value});setMessage(null)}}/></Field><Field label="Ubicación" help="Municipio, dirección o referencia geográfica."><input value={form.location} autoComplete="street-address" placeholder="Ej. Villeta, Cundinamarca" onChange={event=>setForm({...form,location:event.target.value})}/></Field><Field label="Responsable" help="Persona encargada de coordinar la operación de la sede."><input value={form.manager} autoComplete="name" placeholder="Nombre del responsable" onChange={event=>setForm({...form,manager:event.target.value})}/></Field><div className="form-actions"><button className="button primary">{editingId?'Guardar cambios':'Crear sede'}</button>{editingId&&<button type="button" className="button secondary" onClick={resetForm}>Cancelar edición</button>}</div></form>{message&&<p className={`validation-message ${message.tone}`} role={message.tone==='error'?'alert':'status'}>{message.text}</p>}</Card>}
  <Card title="Sedes registradas" subtitle="La información se agrupa por empresa para hacer visible la relación organizacional." flush>{state.sites.length?<div className="management-groups">{groupedSites.map(({company,sites})=><section className="management-group" key={company.id}><header><div><strong>{company.name}</strong><span>{sites.length} sede{sites.length===1?'':'s'}</span></div></header><div className="table-scroll"><table><thead><tr><th scope="col">Sede</th><th scope="col">Ubicación</th><th scope="col">Responsable</th><th scope="col">Naves activas</th><th scope="col">Estado</th><th scope="col">Acciones</th></tr></thead><tbody>{sites.map(site=><tr key={site.id}><td><strong>{site.name}</strong></td><td>{site.location||'Sin registrar'}</td><td>{site.manager||'Sin asignar'}</td><td>{houseCountBySite[site.id]||0}</td><td><span className={`tag ${site.active===false?'':'success'}`}>{site.active===false?'Archivada':'Activa'}</span></td><td><CrudActions onEdit={()=>edit(site)} onDelete={site.active===false?undefined:()=>archive(site)}/></td></tr>)}</tbody></table></div></section>)}</div>:<div className="empty-state"><strong>Aún no hay sedes</strong><p>Registra la primera finca o centro productivo para comenzar a estructurar la operación.</p></div>}</Card>
  <TimelineFeed aggregateType="site" title="Historia de sedes" subtitle="Actividad organizacional de fincas, plantas y centros productivos." emptyText="La actividad de sedes aparecerá después de crear o modificar una sede."/>
 </>
}