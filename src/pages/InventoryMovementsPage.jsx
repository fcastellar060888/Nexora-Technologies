import{useEffect,useState}from'react'
import Card from'../components/Card'
import Field from'../components/Field'
import PageHeader from'../components/PageHeader'
import{FormActions,ValidationMessage}from'../components/forms/FormKit.jsx'
import{useStore}from'../services/store'
import{inventoryViewForActiveOrganization,transactInventory}from'../domain/inventory'

const TYPES=['Entrada','Salida','Ajuste positivo','Ajuste negativo','Devolución','Consumo','Baja','Vencimiento']

export default function InventoryMovementsPage(){
 const{state,update}=useStore()
 const inventoryView=inventoryViewForActiveOrganization(state)
 const{products,lots,movements}=inventoryView
 const[form,setForm]=useState({lotId:lots[0]?.id||'',type:'Entrada',quantity:0,date:new Date().toISOString().slice(0,10),supplier:'',reference:'',responsible:'',notes:''})
 const[msg,setMsg]=useState('')
 useEffect(()=>setForm(current=>({...current,lotId:lots.some(lot=>lot.id===current.lotId)?current.lotId:lots[0]?.id||''})),[inventoryView.organizationId])
 function save(e){e.preventDefault();try{update(s=>transactInventory(s,{...form,sourceType:'Manual'}),{module:'Inventario',action:`${form.type} de inventario`,detail:`${form.quantity}`});setMsg('Movimiento guardado y saldo actualizado correctamente.');setForm(current=>({...current,quantity:0,supplier:'',reference:'',notes:''}))}catch(error){setMsg(error.message)}}
 return <>
  <PageHeader title="Movimientos de inventario" subtitle="Kardex de entradas, salidas, consumos y ajustes con trazabilidad de origen."/>
  <Card title="Nuevo movimiento"><form id="inventory-movement-new" data-module="Movimiento de inventario" data-record-id="new-movement" className="form-grid" onSubmit={save}>
   {msg&&<ValidationMessage type={msg.includes('correctamente')?'success':'error'}>{msg}</ValidationMessage>}
   <Field label="Lote"><select required value={form.lotId} onChange={e=>setForm({...form,lotId:e.target.value})}><option value="">Selecciona un lote</option>{lots.map(l=>{const p=products.find(x=>x.id===l.productId);return <option key={l.id} value={l.id}>{p?.name} · {l.lotNumber||'sin lote'} · saldo {l.quantity}</option>})}</select></Field>
   <Field label="Tipo de movimiento"><select value={form.type} onChange={e=>setForm({...form,type:e.target.value})}>{TYPES.map(type=><option key={type}>{type}</option>)}</select></Field>
   <Field label="Cantidad"><input required min="0.01" type="number" step=".01" value={form.quantity} onChange={e=>setForm({...form,quantity:Number(e.target.value)})}/></Field>
   <Field label="Fecha"><input required type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></Field>
   <Field label="Proveedor"><input value={form.supplier} onChange={e=>setForm({...form,supplier:e.target.value})}/></Field>
   <Field label="Documento o referencia"><input value={form.reference} onChange={e=>setForm({...form,reference:e.target.value})}/></Field>
   <Field label="Responsable"><input value={form.responsible} onChange={e=>setForm({...form,responsible:e.target.value})}/></Field>
   <Field label="Notas" className="full"><textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></Field>
   <FormActions><button className="button primary">Guardar movimiento</button></FormActions>
  </form></Card>
  <Card title="Kardex de inventario"><div className="table-scroll"><table><thead><tr><th>Fecha</th><th>Producto</th><th>Tipo</th><th>Cantidad</th><th>Origen</th><th>Responsable</th><th>Referencia</th><th>Saldo</th></tr></thead><tbody>{[...movements].reverse().map(x=>{const l=lots.find(a=>a.id===x.lotId),p=products.find(a=>a.id===(x.productId||l?.productId));return <tr key={x.id}><td>{x.date}</td><td>{p?.name}</td><td>{x.type}</td><td>{x.signedQuantity}</td><td>{x.sourceType||'Manual'}</td><td>{x.responsible||'—'}</td><td>{x.reference||'—'}</td><td>{x.balanceAfter??'—'}</td></tr>})}</tbody></table></div></Card>
 </>
}
