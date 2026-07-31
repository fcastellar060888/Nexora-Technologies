import{useState}from'react'
import Card from'../components/Card'
import Field from'../components/Field'
import PageHeader from'../components/PageHeader'
import{useStore}from'../services/store'

const roles=['Administrador','Gerente','Agrónomo','Supervisor','Encargado de riego','Encargado MIPE','Operario','Inventario']
export default function UsersPage(){
 const{state,update}=useStore();const[form,setForm]=useState({name:'',email:'',role:'Operario',siteId:state.sites[0]?.id||'',active:true})
 function save(e){e.preventDefault();if(!form.name.trim())return;update(s=>({...s,users:[...s.users,{id:crypto.randomUUID(),activeSession:s.users.length===0,...form}]}),{module:'Usuarios',action:'Usuario creado',detail:form.name})}
 function session(id){update(s=>({...s,users:s.users.map(x=>({...x,activeSession:x.id===id}))}),{module:'Usuarios',action:'Sesión local cambiada'})}
 function remove(id){if(confirm('¿Eliminar este usuario local?'))update(s=>({...s,users:s.users.filter(x=>x.id!==id)}),{module:'Usuarios',action:'Usuario eliminado'})}
 return <><PageHeader title="Usuarios y roles" subtitle="Selecciona un usuario activo para probar permisos antes de conectar Supabase."/>
 <Card title="Nuevo usuario"><form className="form-grid" onSubmit={save}><Field label="Nombre"><input value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></Field><Field label="Correo"><input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></Field><Field label="Rol"><select value={form.role} onChange={e=>setForm({...form,role:e.target.value})}>{roles.map(x=><option key={x}>{x}</option>)}</select></Field><Field label="Sede"><select value={form.siteId} onChange={e=>setForm({...form,siteId:e.target.value})}><option value="">Todas</option>{state.sites.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></Field><button className="button primary">Guardar usuario</button></form></Card>
 <Card title="Usuarios locales"><div className="table-scroll"><table><thead><tr><th>Usuario</th><th>Correo</th><th>Rol</th><th>Sede</th><th>Sesión</th><th></th></tr></thead><tbody>{state.users.map(x=><tr key={x.id}><td>{x.name}</td><td>{x.email}</td><td>{x.role}</td><td>{state.sites.find(s=>s.id===x.siteId)?.name||'Todas'}</td><td>{x.activeSession?<span className="tag success">Activo</span>:<button onClick={()=>session(x.id)}>Usar usuario</button>}</td><td><button className="danger-link" onClick={()=>remove(x.id)}>Eliminar</button></td></tr>)}</tbody></table></div></Card></>}
