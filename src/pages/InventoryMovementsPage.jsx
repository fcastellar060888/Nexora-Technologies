import{useEffect,useState}from'react'
import Card from'../components/Card'
import Field from'../components/Field'
import PageHeader from'../components/PageHeader'
import{FormActions,ValidationMessage}from'../components/forms/FormKit.jsx'
import{INVENTORY_OPERATIONS}from'../services/inventoryCommand.js'
import{useInventoryCommandStore}from'../services/inventoryCommandStore.js'

const TYPES=['Entrada','Salida','Ajuste positivo','Ajuste negativo','Devolución','Consumo','Baja','Vencimiento']

export default function InventoryMovementsPage(){
 const{state,execute}=useInventoryCommandStore()
 const[form,setForm]=useState({lotId:state.inventoryLots[0]?.id||'',type:'Entrada',quantity:0,date:new Date().toISOString().slice(0,10),supplier:'',reference:'',responsible:'',notes:''})
 const[msg,setMsg]=useState(''),[saving,setSaving]=useState(false)
 useEffect(()=>{if(!state.inventoryLots.some(l=>l.id===form.lotId))setForm(current=>({...current,lotId:state.inventoryLots[0]?.id||''}))},[state.inventoryLots,form.lotId])
 async function save(e){e.preventDefault();setSaving(true);try{await execute({operation:INVENTORY_OPERATIONS.RECORD_MOVEMENT,input:{...form,sourceType:'Manual'}});setMsg('Movimiento guardado y confirmado remotamente.');setForm(current=>({...current,quantity:0,supplier:'',reference:'',notes:''}))}catch(error){setMsg(error.message)}finally{setSaving(false)}}
 return <>
  <PageHeader title="Movimientos de inventario" subtitle="Kardex de entradas, salidas, consumos y ajustes con trazabilidad de origen."/>
  <Card title="Nuevo movimiento"><form id="inventory-movement-new" data-module="Movimiento de inventario" data-record-id="new-movement" className="form-grid" onSubmit={save}>
   {msg&&<ValidationMessage type={msg.includes('confirmado remotamente')?'success':'error'}>{msg}</ValidationMessage>}
   <Field label="Lote"><select required value={form.lotId} onChange={e=>setForm({...form,lotId:e.target.value})}><option value="">Selecciona un lote</option>{state.inventoryLots.map(l=>{const p=state.products.find(x=>x.id===l.productId);return <option key={l.id} value={l.id}>{p?.name} · {l.lotNumber||'sin lote'} · saldo {l.quantity}</option>})}</select></Field>
   <Field label="Tipo de movimiento"><select value={form.type} onChange={e=>setForm({...form,type:e.target.value})}>{TYPES.map(type=><option key={type}>{type}</option>)}</select></Field>
   <Field label="Cantidad"><input required min="0.01" type="number" step=".01" value={form.quantity} onChange={e=>setForm({...form,quantity:Number(e.target.value)})}/></Field>
   <Field label="Fecha"><input required type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></Field>
   <Field label="Proveedor"><input value={form.supplier} onChange={e=>setForm({...form,supplier:e.target.value})}/></Field>
   <Field label="Documento o referencia"><input value={form.reference} onChange={e=>setForm({...form,reference:e.target.value})}/></Field>
   <Field label="Responsable"><input value={form.responsible} onChange={e=>setForm({...form,responsible:e.target.value})}/></Field>
   <Field label="Notas" className="full"><textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></Field>
   <FormActions><button className="button primary" disabled={saving}>{saving?'Confirmando…':'Guardar movimiento'}</button></FormActions>
  </form></Card>
  <Card title="Kardex de inventario"><div className="table-scroll"><table><thead><tr><th>Fecha</th><th>Producto</th><th>Tipo</th><th>Cantidad</th><th>Origen</th><th>Responsable</th><th>Referencia</th><th>Saldo</th></tr></thead><tbody>{[...state.inventoryMovements].reverse().map(x=>{const l=state.inventoryLots.find(a=>a.id===x.lotId),p=state.products.find(a=>a.id===(x.productId||l?.productId));return <tr key={x.id}><td>{x.date}</td><td>{p?.name}</td><td>{x.type}</td><td>{x.signedQuantity}</td><td>{x.sourceType||'Manual'}</td><td>{x.responsible||'—'}</td><td>{x.reference||'—'}</td><td>{x.balanceAfter??'—'}</td></tr>})}</tbody></table></div></Card>
 </>
}
