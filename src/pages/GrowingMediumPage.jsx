import{useMemo,useState}from'react'
import Card from'../components/Card'
import Field from'../components/Field'
import PageHeader from'../components/PageHeader'
import{GROWING_MEDIUM_KINDS}from'../domain/growingMedium.js'
import{activeOrganizationId}from'../domain/organizationOwnership.js'
import{executeGrowingMediumCommand,GROWING_MEDIUM_OPERATIONS}from'../services/growingMediumCommand.js'
import{useStore}from'../services/store'

const productForm=()=>({name:'',kind:'COCO',brand:'',supplierId:'',notes:''})
const batchForm=()=>({productId:'',supplierLot:'',receivedVolumeLiters:'',unitCostPerLiter:'',currency:'COP'})
const policyForm=()=>({name:'Reutilización 70/30 · 3 usos',replacementPercent:30,maxUses:3})

export default function GrowingMediumPage(){
 const{state,update}=useStore(),organizationId=activeOrganizationId(state)
 const[product,setProduct]=useState(productForm),[batch,setBatch]=useState(batchForm),[policy,setPolicy]=useState(policyForm),[busy,setBusy]=useState(false),[notice,setNotice]=useState('')
 const products=useMemo(()=>(state.growingMediumProducts||[]).filter(x=>x.organizationId===organizationId),[state.growingMediumProducts,organizationId])
 const batches=useMemo(()=>(state.growingMediumBatches||[]).filter(x=>x.organizationId===organizationId),[state.growingMediumBatches,organizationId])
 const policies=useMemo(()=>(state.growingMediumReusePolicies||[]).filter(x=>x.organizationId===organizationId),[state.growingMediumReusePolicies,organizationId])
 async function execute(operation,input){setBusy(true);setNotice('');try{await executeGrowingMediumCommand(state,{operation,input},{commit:update});return true}catch(error){setNotice(error instanceof Error?error.message:'No fue posible completar la operación.');return false}finally{setBusy(false)}}
 async function saveProduct(event){event.preventDefault();if(await execute(GROWING_MEDIUM_OPERATIONS.CREATE_PRODUCT,product))setProduct(productForm())}
 async function saveBatch(event){event.preventDefault();if(await execute(GROWING_MEDIUM_OPERATIONS.REGISTER_BATCH,{...batch,receivedVolumeLiters:Number(batch.receivedVolumeLiters),unitCostPerLiter:Number(batch.unitCostPerLiter||0)}))setBatch(batchForm())}
 async function savePolicy(event){event.preventDefault();if(await execute(GROWING_MEDIUM_OPERATIONS.CREATE_REUSE_POLICY,{...policy,replacementPercent:Number(policy.replacementPercent),maxUses:Number(policy.maxUses)}))setPolicy(policyForm())}
 return <>
  <PageHeader title="Medios de cultivo" subtitle="Productos, lotes físicos y políticas de reutilización con trazabilidad por organización."/>
  {notice&&<p className="auth-status error" role="alert">{notice}</p>}
  <Card title="Nuevo producto"><form className="form-grid" onSubmit={saveProduct}><Field label="Nombre" required><input required value={product.name} onChange={e=>setProduct({...product,name:e.target.value})}/></Field><Field label="Tipo"><select value={product.kind} onChange={e=>setProduct({...product,kind:e.target.value})}>{Object.values(GROWING_MEDIUM_KINDS).map(kind=><option key={kind}>{kind}</option>)}</select></Field><Field label="Marca"><input value={product.brand} onChange={e=>setProduct({...product,brand:e.target.value})}/></Field><Field label="Proveedor"><input value={product.supplierId} onChange={e=>setProduct({...product,supplierId:e.target.value})}/></Field><Field label="Notas"><input value={product.notes} onChange={e=>setProduct({...product,notes:e.target.value})}/></Field><div className="form-actions"><button className="button primary" disabled={busy}>Crear producto</button></div></form></Card>
  <Card title="Registrar lote/batch"><form className="form-grid" onSubmit={saveBatch}><Field label="Producto" required><select required value={batch.productId} onChange={e=>setBatch({...batch,productId:e.target.value})}><option value="">Seleccionar</option>{products.filter(x=>x.active!==false).map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></Field><Field label="Lote proveedor" required><input required value={batch.supplierLot} onChange={e=>setBatch({...batch,supplierLot:e.target.value})}/></Field><Field label="Volumen recibido (L)" required><input required type="number" min="0.01" step="0.01" value={batch.receivedVolumeLiters} onChange={e=>setBatch({...batch,receivedVolumeLiters:e.target.value})}/></Field><Field label="Costo por litro"><input type="number" min="0" step="0.01" value={batch.unitCostPerLiter} onChange={e=>setBatch({...batch,unitCostPerLiter:e.target.value})}/></Field><Field label="Moneda"><input value={batch.currency} onChange={e=>setBatch({...batch,currency:e.target.value})}/></Field><div className="form-actions"><button className="button primary" disabled={busy}>Registrar batch</button></div></form></Card>
  <Card title="Política de reutilización"><form className="form-grid" onSubmit={savePolicy}><Field label="Nombre" required><input required value={policy.name} onChange={e=>setPolicy({...policy,name:e.target.value})}/></Field><Field label="Reposición fresca (%)"><input type="number" min="0" max="100" value={policy.replacementPercent} onChange={e=>setPolicy({...policy,replacementPercent:e.target.value})}/></Field><Field label="Usos máximos"><input type="number" min="1" value={policy.maxUses} onChange={e=>setPolicy({...policy,maxUses:e.target.value})}/></Field><div className="form-actions"><button className="button primary" disabled={busy}>Crear política</button></div></form></Card>
  <Card title="Inventario de medio"><div className="table-scroll"><table><thead><tr><th>Producto / lote</th><th>Disponible</th><th>Costo/L</th><th>Estado</th></tr></thead><tbody>{batches.map(item=>{const p=products.find(x=>x.id===item.productId);return <tr key={`${item.organizationId}:${item.id}`}><td><strong>{p?.name||'Producto'}</strong><br/><small>{item.supplierLot}</small></td><td>{Number(item.availableVolumeLiters).toFixed(2)} L</td><td>{Number(item.unitCostPerLiter||0).toLocaleString()} {item.currency}</td><td>{item.active===false?'Archivado':'Activo'}</td></tr>})}</tbody></table></div></Card>
  <Card title="Políticas activas"><div className="table-scroll"><table><thead><tr><th>Política</th><th>Reposición</th><th>Usos máximos</th></tr></thead><tbody>{policies.filter(x=>x.active!==false).map(item=><tr key={`${item.organizationId}:${item.id}`}><td>{item.name}</td><td>{item.replacementPercent}%</td><td>{item.maxUses}</td></tr>)}</tbody></table></div></Card>
 </>
}
