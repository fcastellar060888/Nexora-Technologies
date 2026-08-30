import{useMemo,useState}from'react'
import Card from'../components/Card'
import Field from'../components/Field'
import PageHeader from'../components/PageHeader'
import{DomainEvents,publishDomainEvent}from'../core/events/index.js'
import{TimelineFeed}from'../core/timeline/ui.js'
import{identityAdministrationView,removeMembershipFromActiveOrganization,setMembershipStatus}from'../domain/identityAdministration.js'
import{removeRemoteMembership,updateRemoteMembershipStatus}from'../services/authAdminService.js'
import{executeCoreOperationCommand}from'../services/coreOperationCommand.js'
import{useStore}from'../services/store'

const roles=['Administrador','Gerente','Agrónomo','Supervisor','Encargado de riego','Encargado MIPE','Operario','Inventario']
const emptyForm=siteId=>({name:'',email:'',role:'Operario',siteId:siteId||'',active:true})
const normalize=value=>value.trim().replace(/\s+/g,' ')
const list=value=>Array.isArray(value)?value:[]
const enterpriseIdentityState=state=>list(state?.memberships).length>0||list(state?.users).some(user=>user?.remote)
const text=value=>String(value??'').trim()

export default function UsersPage(){
 const{state,update}=useStore()
 const[form,setForm]=useState(()=>emptyForm(state.sites[0]?.id))
 const[message,setMessage]=useState({type:'',text:''})
 const enterpriseMode=enterpriseIdentityState(state)
 const enterpriseView=useMemo(()=>enterpriseMode?identityAdministrationView(state):null,[enterpriseMode,state])
 const localActiveUser=useMemo(()=>state.users.find(user=>user.activeSession&&user.active!==false),[state.users])
 const enterpriseRows=enterpriseView?.members||[]
 const visibleUsers=enterpriseMode?enterpriseRows.map(item=>item.user):state.users
 const activeCount=enterpriseMode?enterpriseRows.filter(item=>item.membership.status!=='inactive').length:state.users.filter(user=>user.active!==false).length
 const activeUser=enterpriseMode?visibleUsers.find(user=>user.activeSession):localActiveUser
 const roleName=roleId=>state.roles.find(role=>text(role.id)===text(roleId))?.name||roleId||'Sin rol'
 const siteNames=siteIds=>list(siteIds).map(id=>state.sites.find(site=>site.id===id&&text(site.companyId||site.organizationId)===enterpriseView?.organizationId)?.name).filter(Boolean).join(', ')||'Todas las sedes autorizadas'
 const organizationForSite=siteId=>{
  const site=state.sites.find(item=>item.id===siteId)
  const organizationId=site?.companyId||state.currentContext?.companyId||state.companies[0]?.id||''
  if(organizationId)return organizationId
  if(!enterpriseMode&&state.companies.length===0)return'local-installation'
  throw new Error('No se puede demostrar la organización del perfil.')
 }
 const run=async spec=>executeCoreOperationCommand(spec,{publishEvent:event=>publishDomainEvent(state,event),commit:update})

 async function save(e){
  e.preventDefault()
  if(enterpriseMode){setMessage({type:'error',text:'La identidad empresarial se administra mediante memberships de la empresa activa.'});return}
  const name=normalize(form.name),email=form.email.trim().toLowerCase()
  if(!name){setMessage({type:'error',text:'Escribe el nombre del usuario.'});return}
  if(email&&state.users.some(user=>(user.email||'').trim().toLowerCase()===email)){setMessage({type:'error',text:'Ya existe un usuario con ese correo.'});return}
  if(form.siteId&&!state.sites.some(site=>site.id===form.siteId)){setMessage({type:'error',text:'La sede seleccionada ya no está disponible.'});return}
  try{
   const user={id:crypto.randomUUID(),activeSession:state.users.length===0,name,email,role:form.role,siteId:form.siteId,active:true}
   const organizationId=organizationForSite(user.siteId),commandId=crypto.randomUUID()
   await run({commandId,organizationId,siteId:user.siteId||null,aggregateType:'user',aggregateId:user.id,completedEventName:DomainEvents.USER_CREATED,payload:{label:`${name} · ${form.role}`,user},metadata:{collections:['users'],source:'m1.2-local-installation'},apply:current=>({...current,users:[...current.users,user]})})
   setForm(emptyForm(state.sites[0]?.id));setMessage({type:'success',text:`Usuario ${name} creado correctamente.`})
  }catch(error){setMessage({type:'error',text:error.message||'No fue posible crear el perfil.'})}
 }

 async function session(id){
  if(enterpriseMode){setMessage({type:'error',text:'La sesión activa proviene de la identidad empresarial y no puede seleccionarse localmente.'});return}
  const selected=state.users.find(user=>user.id===id)
  if(!selected||selected.active===false){setMessage({type:'error',text:'Solo puedes iniciar una sesión local con un usuario activo.'});return}
  try{
   await run({commandId:crypto.randomUUID(),organizationId:organizationForSite(selected.siteId),siteId:selected.siteId||null,aggregateType:'user',aggregateId:selected.id,completedEventName:DomainEvents.USER_SESSION_SELECTED,payload:{label:selected.name,userId:selected.id},metadata:{collections:['users'],source:'m1.2-local-installation'},apply:current=>({...current,users:current.users.map(user=>({...user,activeSession:user.id===id}))})})
   setMessage({type:'success',text:`Ahora estás usando el perfil local de ${selected.name}.`})
  }catch(error){setMessage({type:'error',text:error.message||'No fue posible cambiar el perfil local.'})}
 }

 async function toggleActive(id){
  if(enterpriseMode){setMessage({type:'error',text:'El estado empresarial se modifica sobre la membresía de la empresa activa.'});return}
  const selected=state.users.find(user=>user.id===id);if(!selected)return
  if(selected.activeSession&&selected.active!==false){setMessage({type:'error',text:'No puedes desactivar el usuario que tiene la sesión local activa.'});return}
  const nextActive=selected.active===false
  try{
   await run({commandId:crypto.randomUUID(),organizationId:organizationForSite(selected.siteId),siteId:selected.siteId||null,aggregateType:'user',aggregateId:selected.id,completedEventName:nextActive?DomainEvents.USER_ACTIVATED:DomainEvents.USER_DEACTIVATED,payload:{label:selected.name,userId:selected.id,active:nextActive},metadata:{collections:['users'],source:'m1.2-local-installation'},apply:current=>({...current,users:current.users.map(user=>user.id===id?{...user,active:nextActive}:user)})})
   setMessage({type:'success',text:`Usuario ${nextActive?'activado':'desactivado'} correctamente.`})
  }catch(error){setMessage({type:'error',text:error.message||'No fue posible actualizar el perfil.'})}
 }

 async function archive(id){
  if(enterpriseMode){setMessage({type:'error',text:'La identidad global no se elimina desde Nexora; sólo puede retirarse su membresía de la empresa activa.'});return}
  const selected=state.users.find(user=>user.id===id);if(!selected)return
  if(selected.activeSession){setMessage({type:'error',text:'No puedes archivar el usuario que tiene la sesión local activa.'});return}
  if(selected.active===false){setMessage({type:'success',text:'El perfil local ya está archivado.'});return}
  try{
   await run({commandId:crypto.randomUUID(),organizationId:organizationForSite(selected.siteId),siteId:selected.siteId||null,aggregateType:'user',aggregateId:selected.id,completedEventName:DomainEvents.USER_DEACTIVATED,payload:{label:selected.name,userId:selected.id,active:false,archived:true},metadata:{collections:['users'],source:'m1.2-local-installation'},apply:current=>({...current,users:current.users.map(user=>user.id===id?{...user,active:false,archivedAt:new Date().toISOString()}:user)})})
   setMessage({type:'success',text:'Perfil local archivado sin eliminar su historial.'})
  }catch(error){setMessage({type:'error',text:error.message||'No fue posible archivar el perfil.'})}
 }

 async function setEnterpriseStatus(userId,status){
  const organizationId=enterpriseView?.organizationId
  if(!organizationId){setMessage({type:'error',text:'No existe una empresa activa inequívoca.'});return}
  try{
   await updateRemoteMembershipStatus(userId,{organizationId,status})
   update(current=>setMembershipStatus(current,{organizationId,userId,status}),{action:'Actualizar acceso empresarial',module:'Identidad',detail:`Membresía ${status} en ${organizationId}`})
   setMessage({type:'success',text:`Membresía ${status==='active'?'activada':'desactivada'} únicamente en la empresa activa.`})
  }catch(error){setMessage({type:'error',text:error.message||'No fue posible actualizar la membresía.'})}
 }

 async function removeEnterpriseAccess(userId){
  const organizationId=enterpriseView?.organizationId
  if(!organizationId){setMessage({type:'error',text:'No existe una empresa activa inequívoca.'});return}
  try{
   await removeRemoteMembership(userId,{organizationId})
   update(current=>removeMembershipFromActiveOrganization(current,{organizationId,userId}),{action:'Retirar acceso empresarial',module:'Identidad',detail:`Membresía retirada de ${organizationId}; identidad global preservada`})
   setMessage({type:'success',text:'Acceso retirado sólo de la empresa activa; la identidad global fue preservada.'})
  }catch(error){setMessage({type:'error',text:error.message||'No fue posible retirar la membresía.'})}
 }

 return <>
  <PageHeader eyebrow="Administración" title="Usuarios y acceso" subtitle={enterpriseMode?'La identidad empresarial y sus memberships son la única autoridad de sesión y autorización.':'Perfiles locales disponibles únicamente para instalación standalone.'}/>
  <div className="summary-strip admin-summary"><div><span>Usuarios</span><strong>{visibleUsers.length}</strong></div><div><span>Activos</span><strong>{activeCount}</strong></div><div><span>Roles utilizados</span><strong>{new Set(enterpriseMode?enterpriseRows.map(item=>item.membership.roleId).filter(Boolean):state.users.map(user=>user.role).filter(Boolean)).size}</strong></div><div><span>Identidad activa</span><strong className="summary-text">{activeUser?.name||'Sin sesión'}</strong></div></div>
  {enterpriseMode?<Card title="Identidad empresarial" subtitle={`Administración limitada a la empresa activa: ${enterpriseView?.organizationId||'sin contexto'}.`}><p className="validation-message success" role="status">Las acciones cambian únicamente memberships. La identidad global nunca se elimina desde esta pantalla.</p></Card>:<Card title="Nuevo perfil local" subtitle="Solo para instalación standalone; no sustituye identidad empresarial."><form className="form-grid" onSubmit={save}><Field label="Nombre" required><input value={form.name} autoComplete="name" onChange={e=>setForm({...form,name:e.target.value})}/></Field><Field label="Correo"><input type="email" value={form.email} autoComplete="email" onChange={e=>setForm({...form,email:e.target.value})}/></Field><Field label="Rol" required><select value={form.role} onChange={e=>setForm({...form,role:e.target.value})}>{roles.map(role=><option key={role}>{role}</option>)}</select></Field><Field label="Alcance por sede"><select value={form.siteId} onChange={e=>setForm({...form,siteId:e.target.value})}><option value="">Todas las sedes</option>{state.sites.map(site=><option key={site.id} value={site.id}>{site.name}</option>)}</select></Field><div className="form-actions"><button className="button primary">Guardar perfil</button></div></form></Card>}
  {message.text&&<p className={`validation-message ${message.type}`} role={message.type==='error'?'alert':'status'}>{message.text}</p>}
  <Card title={enterpriseMode?'Usuarios de la empresa activa':'Perfiles locales'} flush>{visibleUsers.length===0?<div className="empty-state"><strong>No hay usuarios</strong><span>{enterpriseMode?'No hay memberships visibles para la empresa activa.':'Crea el primer perfil local para la instalación standalone.'}</span></div>:<div className="table-scroll"><table><thead><tr><th>Usuario</th><th>Rol</th><th>Alcance</th><th>Estado</th><th>Sesión</th><th>Acciones</th></tr></thead><tbody>{enterpriseMode?enterpriseRows.map(({user,membership})=><tr key={membership.id}><td><strong>{user.name}</strong><small>{user.email||'Sin correo'}</small></td><td>{roleName(membership.roleId)}</td><td>{siteNames(membership.siteIds)}</td><td><span className={`tag ${membership.status==='inactive'?'':'success'}`}>{membership.status==='inactive'?'Inactivo':'Activo'}</span></td><td>{user.activeSession?<span className="tag success">Autenticado</span>:<span className="tag">Sin sesión</span>}</td><td><div className="row-actions"><button onClick={()=>setEnterpriseStatus(user.id,membership.status==='inactive'?'active':'inactive')}>{membership.status==='inactive'?'Activar':'Desactivar'}</button><button className="danger-link" disabled={user.activeSession} onClick={()=>removeEnterpriseAccess(user.id)}>Retirar acceso</button></div></td></tr>):state.users.map(user=>{const site=state.sites.find(item=>item.id===user.siteId);return <tr key={user.id}><td><strong>{user.name}</strong><small>{user.email||'Sin correo'}</small></td><td>{user.role||'Sin rol'}</td><td>{site?.name||'Todas las sedes'}</td><td><span className={`tag ${user.active===false?'':'success'}`}>{user.active===false?'Inactivo':'Activo'}</span></td><td>{user.activeSession?<span className="tag success">Autenticado</span>:<button className="button secondary compact" disabled={user.active===false} onClick={()=>session(user.id)}>Usar perfil</button>}</td><td><div className="row-actions"><button onClick={()=>toggleActive(user.id)}>{user.active===false?'Activar':'Desactivar'}</button><button className="danger-link" disabled={user.activeSession||user.active===false} onClick={()=>archive(user.id)}>Archivar</button></div></td></tr>})}</tbody></table></div>}</Card>
  <TimelineFeed aggregateType="user" category="Identidad" title="Historia de usuarios" subtitle="Actividad de identidad y perfiles sin borrado destructivo." emptyText="La actividad de usuarios aparecerá al administrar perfiles o sincronizar identidad."/>
 </>
}
