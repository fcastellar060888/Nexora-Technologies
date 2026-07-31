import{useMemo,useState}from'react'
import Card from'../components/Card'
import Field from'../components/Field'
import PageHeader from'../components/PageHeader'
import{useStore}from'../services/store'

const roles=['Administrador','Gerente','Agrónomo','Supervisor','Encargado de riego','Encargado MIPE','Operario','Inventario']
const emptyForm=siteId=>({name:'',email:'',role:'Operario',siteId:siteId||'',active:true})
const normalize=value=>value.trim().replace(/\s+/g,' ')

export default function UsersPage(){
 const{state,update}=useStore()
 const[form,setForm]=useState(()=>emptyForm(state.sites[0]?.id))
 const[message,setMessage]=useState({type:'',text:''})
 const activeUser=useMemo(()=>state.users.find(user=>user.activeSession),[state.users])
 const activeCount=state.users.filter(user=>user.active!==false).length

 function save(e){
  e.preventDefault()
  const name=normalize(form.name)
  const email=form.email.trim().toLowerCase()
  if(!name){setMessage({type:'error',text:'Escribe el nombre del usuario.'});return}
  if(email&&state.users.some(user=>(user.email||'').trim().toLowerCase()===email)){
   setMessage({type:'error',text:'Ya existe un usuario con ese correo.'});return
  }
  if(form.siteId&&!state.sites.some(site=>site.id===form.siteId)){
   setMessage({type:'error',text:'La sede seleccionada ya no está disponible.'});return
  }
  const user={id:crypto.randomUUID(),activeSession:state.users.length===0,name,email,role:form.role,siteId:form.siteId,active:form.active!==false}
  update(s=>({...s,users:[...s.users,user]}),{module:'Usuarios',action:'Usuario creado',detail:`${name} · ${form.role}`})
  setForm(emptyForm(state.sites[0]?.id))
  setMessage({type:'success',text:`Usuario ${name} creado correctamente.`})
 }

 function session(id){
  const selected=state.users.find(user=>user.id===id)
  if(!selected||selected.active===false){setMessage({type:'error',text:'Solo puedes iniciar una sesión local con un usuario activo.'});return}
  update(s=>({...s,users:s.users.map(user=>({...user,activeSession:user.id===id}))}),{module:'Usuarios',action:'Sesión local cambiada',detail:selected.name})
  setMessage({type:'success',text:`Ahora estás usando el perfil local de ${selected.name}.`})
 }

 function toggleActive(id){
  const selected=state.users.find(user=>user.id===id)
  if(!selected)return
  if(selected.activeSession&&selected.active!==false){setMessage({type:'error',text:'No puedes desactivar el usuario que tiene la sesión local activa.'});return}
  const nextActive=selected.active===false
  update(s=>({...s,users:s.users.map(user=>user.id===id?{...user,active:nextActive}:user)}),{module:'Usuarios',action:nextActive?'Usuario activado':'Usuario desactivado',detail:selected.name})
  setMessage({type:'success',text:`Usuario ${nextActive?'activado':'desactivado'} correctamente.`})
 }

 function remove(id){
  const selected=state.users.find(user=>user.id===id)
  if(!selected)return
  if(selected.activeSession){setMessage({type:'error',text:'No puedes eliminar el usuario que tiene la sesión local activa.'});return}
  if(confirm(`¿Eliminar el usuario local ${selected.name}?`)){
   update(s=>({...s,users:s.users.filter(user=>user.id!==id)}),{module:'Usuarios',action:'Usuario eliminado',detail:selected.name})
   setMessage({type:'success',text:'Usuario eliminado correctamente.'})
  }
 }

 return <>
  <PageHeader eyebrow="Administración" title="Usuarios y roles" subtitle="Administra perfiles locales, roles y alcance por sede mientras la identidad empresarial se gestiona con Supabase."/>
  <div className="summary-strip admin-summary">
   <div><span>Usuarios</span><strong>{state.users.length}</strong></div>
   <div><span>Activos</span><strong>{activeCount}</strong></div>
   <div><span>Roles utilizados</span><strong>{new Set(state.users.map(user=>user.role)).size}</strong></div>
   <div><span>Sesión local</span><strong className="summary-text">{activeUser?.name||'Sin seleccionar'}</strong></div>
  </div>
  <Card title="Nuevo usuario" subtitle="El correo debe ser único. La sede limita el contexto operativo del perfil local.">
   <form className="form-grid" onSubmit={save}>
    <Field label="Nombre" required help="Nombre visible en tareas, auditoría y actividad."><input value={form.name} autoComplete="name" placeholder="Ej. Laura Martínez" onChange={e=>setForm({...form,name:e.target.value})}/></Field>
    <Field label="Correo" help="Se normaliza en minúsculas y no puede repetirse."><input type="email" value={form.email} autoComplete="email" placeholder="usuario@empresa.com" onChange={e=>setForm({...form,email:e.target.value})}/></Field>
    <Field label="Rol" required><select value={form.role} onChange={e=>setForm({...form,role:e.target.value})}>{roles.map(role=><option key={role}>{role}</option>)}</select></Field>
    <Field label="Alcance por sede" help="Selecciona Todas para un perfil con acceso transversal."><select value={form.siteId} onChange={e=>setForm({...form,siteId:e.target.value})}><option value="">Todas las sedes</option>{state.sites.map(site=><option key={site.id} value={site.id}>{site.name}</option>)}</select></Field>
    <div className="form-actions"><button className="button primary">Guardar usuario</button></div>
   </form>
   {message.text&&<p className={`validation-message ${message.type}`} role={message.type==='error'?'alert':'status'}>{message.text}</p>}
  </Card>
  <Card title="Usuarios locales" subtitle="Estos perfiles sirven para probar permisos y operación local; la autenticación empresarial permanece en Supabase." flush>
   {state.users.length===0?<div className="empty-state"><strong>No hay usuarios locales</strong><span>Crea el primer usuario para habilitar una sesión administrativa inicial.</span></div>:<div className="table-scroll"><table><thead><tr><th>Usuario</th><th>Rol</th><th>Alcance</th><th>Estado</th><th>Sesión</th><th>Acciones</th></tr></thead><tbody>{state.users.map(user=>{const site=state.sites.find(item=>item.id===user.siteId);return <tr key={user.id}><td><strong>{user.name}</strong><small>{user.email||'Sin correo'}</small></td><td>{user.role}</td><td>{site?.name||'Todas las sedes'}</td><td><span className={`tag ${user.active===false?'':'success'}`}>{user.active===false?'Inactivo':'Activo'}</span></td><td>{user.activeSession?<span className="tag success">En uso</span>:<button className="button secondary compact" disabled={user.active===false} onClick={()=>session(user.id)}>Usar perfil</button>}</td><td><div className="row-actions"><button onClick={()=>toggleActive(user.id)}>{user.active===false?'Activar':'Desactivar'}</button><button className="danger-link" disabled={user.activeSession} onClick={()=>remove(user.id)}>Eliminar</button></div></td></tr>})}</tbody></table></div>}
  </Card>
 </>
}
