import{useState}from'react'
import Card from'../components/Card'
import Field from'../components/Field'
import PageHeader from'../components/PageHeader'
import PermissionButton from'../components/PermissionButton'
import{FormActions,ValidationMessage}from'../components/forms/FormKit.jsx'
import{useStore}from'../services/store'

const initialForm=state=>({title:'Preparar tanque',siteId:state.sites[0]?.id||'',responsible:'',dueDate:new Date().toISOString().slice(0,10),status:'Pendiente',instructions:''})
export default function WorkOrdersPage(){
 const{state,update}=useStore()
 const[form,setForm]=useState(()=>initialForm(state))
 const[msg,setMsg]=useState('')
 function save(e){
  e.preventDefault()
  if(!form.title.trim())return setMsg('El título de la orden es obligatorio.')
  if(!form.siteId)return setMsg('Selecciona una sede.')
  if(!form.responsible.trim())return setMsg('Asigna un responsable.')
  const record={id:crypto.randomUUID(),createdAt:new Date().toISOString(),...form,title:form.title.trim(),responsible:form.responsible.trim(),instructions:form.instructions.trim()}
  update(s=>({...s,workOrders:[...s.workOrders,record]}),{module:'Órdenes operativas',action:'Crear orden',detail:record.id})
  setMsg('Orden operativa creada correctamente.')
  setForm(current=>({...initialForm(state),siteId:current.siteId,responsible:current.responsible}))
 }
 function complete(id){
  update(s=>({...s,workOrders:s.workOrders.map(x=>x.id===id?{...x,status:'Completada',completedAt:new Date().toISOString()}:x)}),{module:'Órdenes operativas',action:'Completar orden',detail:id})
  setMsg('Orden marcada como completada.')
 }
 return <>
  <PageHeader title="Órdenes operativas" subtitle="Asigna instrucciones, responsable, fecha límite y confirma la ejecución de cada tarea."/>
  <Card title="Nueva orden">
   <form id="work-order-new" data-module="Orden operativa" data-record-id="new-order" className="form-grid" onSubmit={save}>
    {msg&&<ValidationMessage type={msg.includes('correctamente')||msg.includes('completada')?'success':'error'}>{msg}</ValidationMessage>}
    <Field label="Título de la tarea"><input required value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></Field>
    <Field label="Sede"><select required value={form.siteId} onChange={e=>setForm({...form,siteId:e.target.value})}><option value="">Selecciona una sede</option>{state.sites.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
    <Field label="Responsable"><input required value={form.responsible} onChange={e=>setForm({...form,responsible:e.target.value})}/></Field>
    <Field label="Fecha límite"><input required type="date" value={form.dueDate} onChange={e=>setForm({...form,dueDate:e.target.value})}/></Field>
    <Field label="Estado inicial"><select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}><option>Pendiente</option><option>En proceso</option><option>Completada</option></select></Field>
    <Field label="Instrucciones" className="full"><textarea value={form.instructions} onChange={e=>setForm({...form,instructions:e.target.value})}/></Field>
    <FormActions><button type="button" className="button secondary" onClick={()=>setForm(initialForm(state))}>Limpiar</button><button className="button primary">Guardar orden</button></FormActions>
   </form>
  </Card>
  <Card title="Órdenes registradas"><div className="table-scroll"><table><thead><tr><th>Fecha límite</th><th>Sede</th><th>Tarea</th><th>Responsable</th><th>Estado</th><th>Acción</th></tr></thead><tbody>{state.workOrders.map(x=><tr key={x.id}><td>{x.dueDate}</td><td>{state.sites.find(s=>s.id===x.siteId)?.name||'—'}</td><td><strong>{x.title}</strong><small>{x.instructions||'Sin instrucciones adicionales'}</small></td><td>{x.responsible||'—'}</td><td>{x.status}</td><td>{x.status==='Completada'?<span className="tag success">Completada</span>:<PermissionButton permission="execute_orders" className="button secondary" onClick={()=>complete(x.id)}>Marcar completada</PermissionButton>}</td></tr>)}</tbody></table></div></Card>
 </>
}
