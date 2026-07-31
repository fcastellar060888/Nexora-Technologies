import{useState}from'react'
import Card from'../components/Card'
import Field from'../components/Field'
import PageHeader from'../components/PageHeader'
import{useStore}from'../services/store'
import{transactInventory}from'../domain/inventory'

const TYPES=['Entrada','Salida','Ajuste positivo','Ajuste negativo','Devolución','Consumo','Baja','Vencimiento']

export default function InventoryMovementsPage(){
 const{state,update}=useStore()
 const[form,setForm]=useState({lotId:state.inventoryLots[0]?.id||'',type:'Entrada',quantity:0,date:new Date().toISOString().slice(0,10),supplier:'',reference:'',responsible:'',notes:''})
 function save(e){
  e.preventDefault()
  try{
   update(s=>transactInventory(s,{...form,sourceType:'Manual'}),{module:'Inventario',action:`${form.type} de inventario`,detail:`${form.quantity}`})
   setForm(current=>({...current,quantity:0,supplier:'',reference:'',notes:''}))
  }catch(error){alert(error.message)}
 }
 return <>
  <PageHeader title="Movimientos de inventario" subtitle="Kardex de entradas, salidas, consumos y ajustes con trazabilidad de origen."/>
  <Card title="Nuevo movimiento"><form className="form-grid" onSubmit={save}>
   <Field label="Lote"><select required value={form.lotId} onChange={e=>setForm({...form,lotId:e.target.value})}><option value="">Selecciona</option>{state.inventoryLots.map(l=>{const p=state.products.find(x=>x.id===l.productId);return <option key={l.id} value={l.id}>{p?.name} · {l.lotNumber||'sin lote'} · {l.quantity}</option>})}</select></Field>
   <Field label="Tipo"><select value={form.type} onChange={e=>setForm({...form,type:e.target.value})}>{TYPES.map(type=><option key={type}>{type}</option>)}</select></Field>
   <Field label="Cantidad"><input required min="0.01" type="number" step=".01" value={form.quantity} onChange={e=>setForm({...form,quantity:Number(e.target.value)})}/></Field>
   <Field label="Fecha"><input required type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></Field>
   <Field label="Proveedor"><input value={form.supplier} onChange={e=>setForm({...form,supplier:e.target.value})}/></Field>
   <Field label="Referencia"><input value={form.reference} onChange={e=>setForm({...form,reference:e.target.value})}/></Field>
   <Field label="Responsable"><input value={form.responsible} onChange={e=>setForm({...form,responsible:e.target.value})}/></Field>
   <Field label="Notas"><textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></Field>
   <button className="button primary">Guardar movimiento</button>
  </form></Card>
  <Card title="Kardex"><div className="table-scroll"><table><thead><tr><th>Fecha</th><th>Producto</th><th>Tipo</th><th>Cantidad</th><th>Origen</th><th>Responsable</th><th>Referencia</th><th>Saldo</th></tr></thead><tbody>{[...state.inventoryMovements].reverse().map(x=>{const l=state.inventoryLots.find(a=>a.id===x.lotId),p=state.products.find(a=>a.id===(x.productId||l?.productId));return <tr key={x.id}><td>{x.date}</td><td>{p?.name}</td><td>{x.type}</td><td>{x.signedQuantity}</td><td>{x.sourceType||'Manual'}</td><td>{x.responsible||'—'}</td><td>{x.reference||'—'}</td><td>{x.balanceAfter??'—'}</td></tr>})}</tbody></table></div></Card>
 </>
}
