import{useState}from'react'
import{useLocation,useNavigate}from'react-router-dom'
import Card from'../components/Card'
import Field from'../components/Field'
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
 const[notice,setNotice]=useState(null)
 const[busy,setBusy]=useState(false)
 const status=syncStatus(state)
 const activeCompany=state.companies.find(company=>company.id===state.currentContext?.companyId)?.name||'Sin seleccionar'
 const lastSync=status.lastSyncedAt?new Date(status.lastSyncedAt).toLocaleString():'Sin sincronización previa'
 const setError=error=>setNotice({type:'error',text:error instanceof Error?error.message:'No fue posible completar la operación'})
 const setSuccess=text=>setNotice({type:'success',text})

 async function login(e){
  e.preventDefault();setBusy(true);setNotice(null)
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
   setSuccess('Identidad validada. Entrando al Centro de Operaciones…')
   navigate(location.state?.from||'/dashboard',{replace:true})
  }catch(error){setError(error)}
  finally{setBusy(false)}
 }

 async function resetPassword(){
  const email=form.email.trim()
  if(!email){setNotice({type:'error',text:'Escribe primero el correo de la cuenta.'});return}
  setBusy(true);setNotice(null)
  try{await requestPasswordReset(email);setSuccess('Enviamos el enlace de recuperación al correo registrado.')}
  catch(error){setError(error)}
  finally{setBusy(false)}
 }

 async function sync(){
  setBusy(true);setNotice(null)
  try{
   const result=await runIncrementalSync(state)
   update(result.state,{action:'Sincronización incremental',module:'Sistema',detail:`${result.pushed} enviados, ${result.pulled} recibidos`,sync:false})
   setSuccess(`Sincronización completada: ${result.pushed} enviados y ${result.pulled} recibidos.`)
  }catch(error){setError(error)}
  finally{setBusy(false)}
 }

 async function logout(){
  setBusy(true);setNotice(null)
  try{
   await signOut()
   update(prev=>({...prev,users:(prev.users||[]).map(user=>({...user,activeSession:false}))}),{action:'Cierre de sesión',module:'Seguridad',sync:false})
   setSuccess('Sesión cerrada correctamente.')
  }catch(error){setError(error)}
  finally{setBusy(false)}
 }

 return <div className="auth-layout">
  <section className="auth-intro" aria-labelledby="auth-title">
   <h2 id="auth-title">Nexora One</h2>
   <p>Inteligencia operativa para conectar procesos, anticipar riesgos y dirigir el futuro de tu empresa.</p>
   <div className="auth-principles">
    <div className="auth-principle"><strong>Una sola operación</strong><span>Empresas, sedes, cultivo, inventario y decisiones conectadas.</span></div>
    <div className="auth-principle"><strong>Datos confiables</strong><span>Trazabilidad, sincronización y control por organización.</span></div>
    <div className="auth-principle"><strong>Decisiones oportunas</strong><span>Prioridades claras para actuar antes de que aparezca el problema.</span></div>
   </div>
  </section>
  <Card className="auth-card" title={supabaseEnabled?'Acceso empresarial':'Configuración requerida'} subtitle={supabaseEnabled?'Ingresa con la identidad asignada a tu organización.':'Configura las variables de Supabase antes de habilitar el acceso remoto.'}>
   <form className="form-grid" onSubmit={login} aria-busy={busy}>
    <Field label="Correo" required help="Usa el correo vinculado a tu membresía empresarial."><input type="email" required autoComplete="email" inputMode="email" placeholder="nombre@empresa.com" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></Field>
    <Field label="Contraseña" required><input type="password" required autoComplete="current-password" placeholder="Ingresa tu contraseña" value={form.password} onChange={e=>setForm({...form,password:e.target.value})}/></Field>
    <div className="form-actions"><button type="submit" className="button primary" disabled={busy||!supabaseEnabled} aria-busy={busy}>{busy?'Validando identidad…':'Iniciar sesión'}</button><button type="button" className="button secondary" disabled={busy||!supabaseEnabled} onClick={resetPassword}>Recuperar contraseña</button></div>
   </form>
   <div className="auth-secondary-actions" aria-label="Acciones técnicas de sesión"><button type="button" className="button secondary" disabled={busy||!supabaseEnabled} onClick={sync}>Sincronizar ahora</button><button type="button" className="button secondary" disabled={busy} onClick={logout}>Cerrar sesión actual</button></div>
   <div className="auth-context" aria-label="Estado de la operación"><div><span>Empresa activa</span><strong>{activeCompany}</strong></div><div><span>Última sincronización</span><strong>{lastSync}</strong></div><div><span>Trabajo pendiente</span><strong>{status.pending} pendientes · {status.failed} fallidos</strong></div><div><span>Conflictos</span><strong>{status.conflicts}</strong></div></div>
   {notice&&<p className={`auth-status ${notice.type}`} role={notice.type==='error'?'alert':'status'} aria-live="polite">{notice.text}</p>}
  </Card>
 </div>
}
