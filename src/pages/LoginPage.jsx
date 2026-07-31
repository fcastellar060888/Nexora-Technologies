import{useState}from'react'
import{useLocation,useNavigate}from'react-router-dom'
import Card from'../components/Card'
import Field from'../components/Field'
import PageHeader from'../components/PageHeader'
import{chooseInitialContext,mergeRemoteIdentity}from'../domain/authBootstrap'
import{loadRemoteIdentity,requestPasswordReset,signIn,signOut,supabaseEnabled}from'../services/supabase'
import{runIncrementalSync}from'../services/syncTransport'
import{syncStatus}from'../services/syncEngine'
import{useStore}from'../services/store'

export default function LoginPage(){
 const{state,update}=useStore()
 const navigate=useNavigate()
 const location=useLocation()
 const[form,setForm]=useState({email:'',password:''})
 const[msg,setMsg]=useState('')
 const[busy,setBusy]=useState(false)
 const status=syncStatus(state)

 async function login(e){
  e.preventDefault();setBusy(true);setMsg('')
  try{
   const{error}=await signIn(form.email,form.password)
   if(error)throw error
   const identity=await loadRemoteIdentity()
   if(!identity.memberships.length){await signOut();throw new Error('La cuenta no tiene una membresía activa en ninguna empresa.')}
   update(prev=>{
    const merged=mergeRemoteIdentity(prev,identity)
    const context=chooseInitialContext({memberships:merged.memberships,companies:merged.companies,sites:merged.sites,preferredCompanyId:prev.currentContext?.companyId,preferredSiteId:prev.currentContext?.siteId})
    return{...merged,currentContext:{...merged.currentContext,...context}}
   },{action:'Inicio de sesión remoto',module:'Seguridad',detail:`Usuario ${identity.user.email}`,sync:false})
   setMsg('Sesión iniciada')
   navigate(location.state?.from||'/dashboard',{replace:true})
  }catch(error){setMsg(error instanceof Error?error.message:'No fue posible iniciar sesión')}
  finally{setBusy(false)}
 }

 async function resetPassword(){
  const email=form.email.trim()
  if(!email){setMsg('Escribe primero el correo de la cuenta.');return}
  setBusy(true)
  try{await requestPasswordReset(email);setMsg('Enviamos el enlace de recuperación al correo.')}
  catch(error){setMsg(error instanceof Error?error.message:'No fue posible enviar la recuperación')}
  finally{setBusy(false)}
 }

 async function sync(){
  setBusy(true)
  try{
   const result=await runIncrementalSync(state)
   update(result.state,{action:'Sincronización incremental',module:'Sistema',detail:`${result.pushed} enviados, ${result.pulled} recibidos`,sync:false})
   setMsg(`Sincronización completada: ${result.pushed} enviados y ${result.pulled} recibidos.`)
  }catch(error){setMsg(error instanceof Error?error.message:'No fue posible sincronizar')}
  finally{setBusy(false)}
 }

 async function logout(){setBusy(true);try{await signOut();update(prev=>({...prev,users:(prev.users||[]).map(user=>({...user,activeSession:false}))}),{action:'Cierre de sesión',module:'Seguridad',sync:false});setMsg('Sesión cerrada')}finally{setBusy(false)}}

 return <><PageHeader title="Nexora One" subtitle="by Nexora Technologies · Acceso seguro a la operación de tu empresa."/><Card title={supabaseEnabled?'Acceso empresarial':'Falta configurar variables de entorno'}><form className="form-grid" onSubmit={login}><Field label="Correo"><input type="email" required autoComplete="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></Field><Field label="Contraseña"><input type="password" required autoComplete="current-password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})}/></Field><div className="form-actions"><button className="button primary" disabled={busy||!supabaseEnabled}>{busy?'Procesando...':'Iniciar sesión'}</button><button type="button" className="button secondary" disabled={busy||!supabaseEnabled} onClick={resetPassword}>Recuperar contraseña</button><button type="button" className="button secondary" disabled={busy||!supabaseEnabled} onClick={sync}>Sincronizar ahora</button><button type="button" className="button secondary" disabled={busy} onClick={logout}>Cerrar sesión</button></div></form><p className="muted">Empresa activa: {state.companies.find(company=>company.id===state.currentContext?.companyId)?.name||'Sin seleccionar'} · Pendientes: {status.pending} · Fallidos: {status.failed} · Conflictos: {status.conflicts}{status.lastSyncedAt?` · Última sincronización: ${new Date(status.lastSyncedAt).toLocaleString()}`:''}</p>{msg&&<p role="status">{msg}</p>}</Card></>
}
