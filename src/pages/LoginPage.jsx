import{useState}from'react'
import Card from'../components/Card'
import Field from'../components/Field'
import PageHeader from'../components/PageHeader'
import{signIn,signOut,supabaseEnabled,syncSnapshot}from'../services/supabase'
import{useStore}from'../services/store'

export default function LoginPage(){
 const{state}=useStore()
 const[form,setForm]=useState({email:'',password:''})
 const[msg,setMsg]=useState('')
 async function login(e){e.preventDefault();try{const{error}=await signIn(form.email,form.password);if(error)throw error;setMsg('Sesión iniciada')}catch(e){setMsg(e.message)}}
 async function sync(){try{await syncSnapshot(state);setMsg('Sincronización completada')}catch(e){setMsg(e.message)}}
 return <>
  <PageHeader title="Supabase y sincronización" subtitle="Conecta varios dispositivos, usuarios y respaldos centrales."/>
  <Card title={supabaseEnabled?'Supabase configurado':'Falta configurar .env'}>
   <form className="form-grid" onSubmit={login}><Field label="Correo"><input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></Field><Field label="Contraseña"><input type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})}/></Field><div className="form-actions"><button className="button primary">Iniciar sesión</button><button type="button" className="button secondary" onClick={sync}>Sincronizar ahora</button><button type="button" className="button secondary" onClick={()=>signOut()}>Cerrar sesión</button></div></form>
   {msg&&<p>{msg}</p>}
  </Card>
 </>}
