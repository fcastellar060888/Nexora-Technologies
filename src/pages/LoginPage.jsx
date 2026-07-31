import{useState}from'react'
import{useLocation,useNavigate}from'react-router-dom'
import Card from'../components/Card'
import Field from'../components/Field'
import PageHeader from'../components/PageHeader'
import{signIn,signOut,supabaseEnabled,syncSnapshot}from'../services/supabase'
import{useStore}from'../services/store'

export default function LoginPage(){
 const{state,update}=useStore()
 const navigate=useNavigate()
 const location=useLocation()
 const[form,setForm]=useState({email:'',password:''})
 const[msg,setMsg]=useState('')
 const[busy,setBusy]=useState(false)

 async function login(e){
  e.preventDefault()
  setBusy(true)
  setMsg('')
  try{
   const{data,error}=await signIn(form.email,form.password)
   if(error)throw error
   const email=String(data?.user?.email||form.email).trim().toLowerCase()
   const matching=(state.users||[]).find(user=>String(user.email||'').trim().toLowerCase()===email)
   if((state.users||[]).length>0&&!matching){
    await signOut()
    throw new Error('La cuenta inició sesión en Supabase, pero no está registrada como usuario activo del ERP.')
   }
   if(matching&&!matching.active) {
    await signOut()
    throw new Error('El usuario del ERP está inactivo.')
   }
   if(matching){
    update(prev=>({...prev,users:(prev.users||[]).map(user=>({...user,activeSession:user.id===matching.id}))}),{
     action:'Inicio de sesión',module:'Seguridad',detail:`Usuario ${matching.name||matching.email}`
    })
   }
   setMsg('Sesión iniciada')
   navigate(location.state?.from||'/dashboard',{replace:true})
  }catch(error){
   setMsg(error instanceof Error?error.message:'No fue posible iniciar sesión')
  }finally{
   setBusy(false)
  }
 }

 async function sync(){
  setBusy(true)
  try{await syncSnapshot(state);setMsg('Sincronización completada')}
  catch(error){setMsg(error instanceof Error?error.message:'No fue posible sincronizar')}
  finally{setBusy(false)}
 }

 async function logout(){
  setBusy(true)
  try{
   await signOut()
   update(prev=>({...prev,users:(prev.users||[]).map(user=>({...user,activeSession:false}))}),{
    action:'Cierre de sesión',module:'Seguridad'
   })
   setMsg('Sesión cerrada')
  }finally{
   setBusy(false)
  }
 }

 return <>
  <PageHeader title="Supabase y sincronización" subtitle="Conecta varios dispositivos, usuarios y respaldos centrales."/>
  <Card title={supabaseEnabled?'Supabase configurado':'Falta configurar .env'}>
   <form className="form-grid" onSubmit={login}>
    <Field label="Correo"><input type="email" required autoComplete="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></Field>
    <Field label="Contraseña"><input type="password" required autoComplete="current-password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})}/></Field>
    <div className="form-actions">
     <button className="button primary" disabled={busy||!supabaseEnabled}>{busy?'Procesando...':'Iniciar sesión'}</button>
     <button type="button" className="button secondary" disabled={busy||!supabaseEnabled} onClick={sync}>Sincronizar ahora</button>
     <button type="button" className="button secondary" disabled={busy} onClick={logout}>Cerrar sesión</button>
    </div>
   </form>
   {msg&&<p role="status">{msg}</p>}
  </Card>
 </>
}
