import{useState}from'react'
import Card from'../components/Card'
import Field from'../components/Field'
import PageHeader from'../components/PageHeader'
import{useStore}from'../services/store'
import{createInventoryLot}from'../domain/inventory'

export default function InventoryPage(){
 const{state,update}=useStore()
 const[p,setP]=useState({name:'',category:'MIPE',activeIngredient:'',unit:'mL',doseMin:0,doseMax:0,doseUnit:'mL/L',reentryHours:0,withdrawalDays:0,cost:0})
 const[lot,setLot]=useState({productId:state.products[0]?.id||'',siteId:state.sites[0]?.id||'',quantity:0,lotNumber:'',expiryDate:'',minimum:0,responsible:''})
 function addP(e){
  e.preventDefault()
  if(!p.name.trim())return alert('El nombre comercial es obligatorio.')
  if(Number(p.doseMin)<0||Number(p.doseMax)<0||Number(p.cost)<0)return alert('Dosis y costos no pueden ser negativos.')
  if(Number(p.doseMax)>0&&Number(p.doseMin)>Number(p.doseMax))return alert('La dosis mínima no puede superar la máxima.')
  const id=crypto.randomUUID()
  update(s=>({...s,products:[...s.products,{id,...p,name:p.name.trim(),active:true}]}),{module:'Inventario',action:'Crear insumo',detail:p.name.trim()})
  setLot(current=>({...current,productId:id}))
  setP(current=>({...current,name:'',activeIngredient:''}))
 }
 function addL(e){
  e.preventDefault()
  try{
   update(s=>createInventoryLot(s,lot),{module:'Inventario',action:'Crear lote de inventario',detail:lot.lotNumber})
   setLot(current=>({...current,quantity:0,lotNumber:'',expiryDate:'',minimum:0}))
  }catch(error){alert(error.message)}
 }
 return <>
  <PageHeader title="Inventario MIPE / MIRFE" subtitle="Insumos, lotes, vencimientos y existencias respaldadas por kardex."/>
  <div className="content-grid two">
   <Card title="Nuevo insumo"><form className="form-grid one" onSubmit={addP}>
    <Field label="Nombre comercial"><input required value={p.name} onChange={e=>setP({...p,name:e.target.value})}/></Field>
    <Field label="Categoría"><select value={p.category} onChange={e=>setP({...p,category:e.target.value})}><option>MIPE</option><option>MIRFE</option><option>Fertilizante</option><option>Adyuvante</option><option>Corrector pH</option><option>Biológico</option><option>Monitoreo</option><option>EPP</option><option>Otro</option></select></Field>
    <Field label="Ingrediente activo"><input value={p.activeIngredient} onChange={e=>setP({...p,activeIngredient:e.target.value})}/></Field>
    <Field label="Unidad inventario"><select value={p.unit} onChange={e=>setP({...p,unit:e.target.value})}><option>mL</option><option>L</option><option>g</option><option>kg</option><option>unidad</option></select></Field>
    <Field label="Dosis mínima"><input min="0" type="number" step=".01" value={p.doseMin} onChange={e=>setP({...p,doseMin:+e.target.value})}/></Field>
    <Field label="Dosis máxima"><input min="0" type="number" step=".01" value={p.doseMax} onChange={e=>setP({...p,doseMax:+e.target.value})}/></Field>
    <Field label="Unidad dosis"><select value={p.doseUnit} onChange={e=>setP({...p,doseUnit:e.target.value})}><option>mL/L</option><option>g/L</option><option>mL/100 L</option><option>g/100 L</option></select></Field>
    <Field label="Reentrada horas"><input min="0" type="number" value={p.reentryHours} onChange={e=>setP({...p,reentryHours:+e.target.value})}/></Field>
    <Field label="Carencia días"><input min="0" type="number" value={p.withdrawalDays} onChange={e=>setP({...p,withdrawalDays:+e.target.value})}/></Field>
    <Field label="Costo por unidad"><input min="0" type="number" step=".01" value={p.cost} onChange={e=>setP({...p,cost:+e.target.value})}/></Field>
    <button className="button primary">Guardar insumo</button>
   </form></Card>
   <Card title="Registrar lote"><form className="form-grid one" onSubmit={addL}>
    <Field label="Producto"><select required value={lot.productId} onChange={e=>setLot({...lot,productId:e.target.value})}><option value="">Selecciona</option>{state.products.map(product=><option key={product.id} value={product.id}>{product.name}</option>)}</select></Field>
    <Field label="Sede"><select required value={lot.siteId} onChange={e=>setLot({...lot,siteId:e.target.value})}><option value="">Selecciona</option>{state.sites.map(site=><option key={site.id} value={site.id}>{site.name}</option>)}</select></Field>
    <Field label="Cantidad inicial"><input min="0" type="number" step=".01" value={lot.quantity} onChange={e=>setLot({...lot,quantity:+e.target.value})}/></Field>
    <Field label="Lote"><input required value={lot.lotNumber} onChange={e=>setLot({...lot,lotNumber:e.target.value})}/></Field>
    <Field label="Vencimiento"><input type="date" value={lot.expiryDate} onChange={e=>setLot({...lot,expiryDate:e.target.value})}/></Field>
    <Field label="Stock mínimo"><input min="0" type="number" step=".01" value={lot.minimum} onChange={e=>setLot({...lot,minimum:+e.target.value})}/></Field>
    <Field label="Responsable"><input value={lot.responsible} onChange={e=>setLot({...lot,responsible:e.target.value})}/></Field>
    <button className="button primary">Guardar lote y movimiento inicial</button>
   </form></Card>
  </div>
  <Card title="Existencias"><div className="table-scroll"><table><thead><tr><th>Producto</th><th>Categoría</th><th>Sede</th><th>Existencia</th><th>Mínimo</th><th>Lote</th><th>Vence</th><th>Estado</th></tr></thead><tbody>{state.inventoryLots.map(l=>{const product=state.products.find(x=>x.id===l.productId),site=state.sites.find(x=>x.id===l.siteId);return <tr key={l.id}><td>{product?.name}</td><td>{product?.category}</td><td>{site?.name}</td><td>{l.quantity} {product?.unit}</td><td>{l.minimum}</td><td>{l.lotNumber||'—'}</td><td>{l.expiryDate||'—'}</td><td className={l.quantity<=l.minimum?'warn':'ok'}>{l.quantity<=l.minimum?'COMPRAR':'OK'}</td></tr>})}</tbody></table></div></Card>
 </>
}
