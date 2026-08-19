import{useMemo,useState}from'react'
import Card from'../components/Card'
import Field from'../components/Field'
import PageHeader from'../components/PageHeader'
import{useStore}from'../services/store'
import{createRemoteUser,removeRemoteMembership,updateRemoteMembershipStatus}from'../services/authAdminService.js'
import{addMembershipToActiveOrganization,identityAdministrationView,removeMembershipFromActiveOrganization,setMembershipStatus}from'../domain/identityAdministration.js'

const text=value=>String(value??'').trim()

export default function UsersPageSecure(){
 const{state,update}=useStore(),view=identityAdministrationView(state)
 const defaultRole=view.roles[0]?.id||''
 const[form,setForm]=useState({organizationId:view.organizationId,name:'',email:'',password:'',roleId:defaultRole,siteIds:[]})
 const[busy,setBusy]=useState(false),[notice,setNotice]=useState('')
 const roleById=useMemo(()=>new Map(view.roles.map(role=>[role.id,role])),[view.roles])
 function reset(){setForm({organizationId:view.organizationId,name:'',email:'',password:'',roleId:view.roles[0]?.id||'',siteIds:[]})}
 async function add(event){
  event.preventDefault();if(busy)return
  setBusy(true);setNotice('')
  try{
   if(form.organizationId!==view.organizationId)throw new Error('La empresa activa cambió. Revisa el formulario antes de continuar.')
   const remote=await createRemoteUser(form)
   let userId=text(remote?.user?.id)
   update(current=>{
    let next=current
    if(remote?.skipped){userId=crypto.randomUUID();next={...next,users:[...(next.users||[]),{id:userId,name:text(form.name)||text(form.email),email:text(form.email).toLowerCase(),active:true,remote:false,createdAt:new Date().toISOString()}]}}
    else if(userId&&!next.users.some(user=>user.id===userId))next={...next,users:[...(next.users||[]),{id:userId,remoteId:userId,name:text(remote?.user?.name)||text(form.name)||text(form.email),email:text(remote?.user?.email)||text(form.email).toLowerCase(),active:true,remote:true,createdAt:new Date().toISOString()}]}
    if(!userId)throw new Error('No fue posible determinar la identidad del usuario creado.')
    return addMembershipToActiveOrganization(next,{id:text(remote?.membership?.id),userId,organizationId:form.organizationId,roleId:form.roleId,siteIds:form.siteIds,createdAt:new Date().toISOString()})
   },{module:'Usuarios',action:'Membresía creada',detail:form.email})
   reset();setNotice('Usuario incorporado a la empresa activa.')
  }catch(error){setNotice(error instanceof Error?error.message:'No fue posible crear la membresía.')}
  finally{setBusy(false)}
 }
 async function toggle(member){
  if(busy)return
  setBusy(true);setNotice('')
  try{
   const nextStatus=member.membership.status==='active'?'inactive':'active'
   const remoteId=member.user.remoteId||member.user.authUserId||member.user.id
   await updateRemoteMembershipStatus(remoteId,{organizationId:view.organizationId,status:nextStatus})
   update(current=>setMembershipStatus(current,{userId:member.user.id,organizationId:view.organizationId,status:nextStatus}),{module:'Usuarios',action:nextStatus==='active'?'Membresía activada':'Membresía desactivada',detail:member.user.email})
  }catch(error){setNotice(error instanceof Error?error.message:'No fue posible cambiar el acceso.')}
  finally{setBusy(false)}
 }
 async function remove(member){
  if(busy)return
  if(!confirm(`¿Quitar a ${member.user.name||member.user.email} de esta empresa? Su identidad y accesos en otras empresas se conservarán.`))return
  setBusy(true);setNotice('')
  try{
   const remoteId=member.user.remoteId||member.user.authUserId||member.user.id
   await removeRemoteMembership(remoteId,{organizationId:view.organizationId})
   update(current=>removeMembershipFromActiveOrganization(current,{userId:member.user.id,organizationId:view.organizationId}),{module:'Usuarios',action:'Membresía eliminada',detail:member.user.email})
  }catch(error){setNotice(error instanceof Error?error.message:'No fue posible quitar la membresía.')}
  finally{setBusy(false)}
 }
 function toggleSite(siteId){setForm(current=>({...current,siteIds:current.siteIds.includes(siteId)?current.siteIds.filter(id=>id!==siteId):[...current.siteIds,siteId]}))}
 return <><PageHeader title="Usuarios" subtitle="Administra membresías, roles y sedes únicamente dentro de la empresa activa."/>
 <Card title="Agregar miembro"><form className="form-grid" onSubmit={add}>
  <Field label="Nombre"><input value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></Field>
  <Field label="Correo"><input type="email" required value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></Field>
  <Field label="Contraseña temporal"><input type="password" minLength="8" required value={form.password} onChange={e=>setForm({...form,password:e.target.value})}/></Field>
  <Field label="Rol"><select required value={form.roleId} onChange={e=>setForm({...form,roleId:e.target.value})}><option value="">Seleccionar</option>{view.roles.map(role=><option key={role.id} value={role.id}>{role.name||role.code||role.id}</option>)}</select></Field>
  <Field label="Sedes autorizadas"><div className="checkbox-grid">{view.sites.map(site=><label key={`${site.organizationId||view.organizationId}:${site.id}`}><input type="checkbox" checked={form.siteIds.includes(site.id)} onChange={()=>toggleSite(site.id)}/>{site.name||site.id}</label>)}{view.sites.length===0&&<small>No hay sedes asignables en esta empresa.</small>}</div></Field>
  {notice&&<p className="auth-status span-all" role="status">{notice}</p>}
  <button className="button primary" disabled={busy||!form.roleId}>{busy?'Guardando…':'Agregar miembro'}</button>
 </form></Card>
 <Card title="Miembros de la empresa"><div className="table-scroll"><table><thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Sedes</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{view.members.map(member=><tr key={`${view.organizationId}:${member.membership.id||member.user.id}`}><td>{member.user.name||'—'}</td><td>{member.user.email||'—'}</td><td>{roleById.get(member.membership.roleId)?.name||member.membership.roleId||'—'}</td><td>{member.membership.siteIds?.length?member.membership.siteIds.map(id=>view.sites.find(site=>site.id===id)?.name||id).join(', '):'Todas las sedes de la empresa'}</td><td>{member.membership.status==='active'?'Activa':'Inactiva'}</td><td><div className="button-row"><button className="button secondary" disabled={busy} onClick={()=>toggle(member)}>{member.membership.status==='active'?'Desactivar':'Activar'}</button><button className="button danger" disabled={busy} onClick={()=>remove(member)}>Quitar acceso</button></div></td></tr>)}{view.members.length===0&&<tr><td colSpan="6">No hay miembros en la empresa activa.</td></tr>}</tbody></table></div></Card></>
}
