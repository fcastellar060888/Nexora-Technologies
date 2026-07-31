import {useState} from'react'
import Card from'../components/Card'
import Field from'../components/Field'
import PageHeader from'../components/PageHeader'
import PermissionButton from'../components/PermissionButton'
import{useStore}from'../services/store'

export default function WorkOrdersPage(){
 const{state,update}=useStore()
 const[form,setForm]=useState({title:'Preparar tanque',siteId:state.sites[0]?.id||'',responsible:'',dueDate:new Date().toISOString().slice(0,10),status:'Pendiente',instructions:''})
 function save(e){e.preventDefault();update(s=>({...s,workOrders:[...s.workOrders,{id:crypto.randomUUID(),createdAt:new Date().toISOString(),...form}]}))}
 function complete(id){update(s=>({...s,workOrders:s.workOrders.map(x=>x.id===id?{...x,status:'Completada',completedAt:new Date().toISOString()}:x)}))}
 return <>
  <PageHeader title="Orden del encargado" subtitle="Instrucciones claras, responsable, fecha y confirmación de ejecución."/>
  <Card title="Nueva orden"><form className="form-grid" onSubmit={save}>
   <Field label="Título"><input value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></Field>
   <Field label="Sede"><select value={form.siteId} onChange={e=>setForm({...form,siteId:e.target.value})}>{state.sites.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
   <Field label="Responsable"><input value={form.responsible} onChange={e=>setForm({...form,responsible:e.target.value})}/></Field>
   <Field label="Fecha límite"><input type="date" value={form.dueDate} onChange={e=>setForm({...form,dueDate:e.target.value})}/></Field>
   <Field label="Estado"><select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}><option>Pendiente</option><option>En proceso</option><option>Completada</option></select></Field>
   <Field label="Instrucciones"><textarea value={form.instructions} onChange={e=>setForm({...form,instructions:e.target.value})}/></Field>
   <div className="form-actions"><button className="button primary">Guardar orden</button></div>
  </form></Card>
  <Card title="Órdenes"><div className="table-scroll"><table><thead><tr><th>Fecha</th><th>Sede</th><th>Tarea</th><th>Responsable</th><th>Estado</th><th></th></tr></thead><tbody>{state.workOrders.map(x=><tr key={x.id}><td>{x.dueDate}</td><td>{state.sites.find(s=>s.id===x.siteId)?.name}</td><td>{x.title}<small>{x.instructions}</small></td><td>{x.responsible||'—'}</td><td>{x.status}</td><td><PermissionButton permission="execute_orders" className="button secondary" onClick={()=>complete(x.id)}>Completar</PermissionButton></td></tr>)}</tbody></table></div></Card>
 </>
}
