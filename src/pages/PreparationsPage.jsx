import{useState}from'react'
import Card from'../components/Card'
import Field from'../components/Field'
import PageHeader from'../components/PageHeader'
import{FormActions,ValidationMessage}from'../components/forms/FormKit.jsx'
import{useStore}from'../services/store'
import{createTankPreparation,executeTankPreparation}from'../domain/irrigationExecution'

export default function PreparationsPage(){
 const{state,update}=useStore()
 const[allocations,setAllocations]=useState({})
 const[responsible,setResponsible]=useState('')
 const[msg,setMsg]=useState('')
 function create(formulation){
  if(!responsible.trim())return setMsg('Registra el responsable antes de crear la preparación.')
  try{
   update(s=>createTankPreparation(s,{formulationId:formulation.id,responsible:responsible.trim()}),{module:'Fertirriego',action:'Crear preparación',detail:formulation.id})
   setMsg('Preparación creada. Selecciona los lotes de inventario antes de ejecutarla.')
  }catch(error){setMsg(error.message)}
 }
 function execute(preparation){
  if(!responsible.trim())return setMsg('Registra el responsable de la ejecución.')
  const pendingItems=preparation.items||[]
  const missing=pendingItems.filter(item=>!allocations[item.id])
  if(missing.length)return setMsg(`Selecciona el lote de inventario para ${missing.length} producto(s).`)
  try{
   update(s=>executeTankPreparation(s,{preparationId:preparation.id,allocations,responsible:responsible.trim()}),{module:'Fertirriego',action:'Ejecutar preparación',detail:preparation.id})
   setMsg('Preparación ejecutada: inventario y costos actualizados correctamente.')
  }catch(error){setMsg(error.message)}
 }
 const available=state.formulations.filter(f=>f.status==='Aprobada'&&!state.tankPreparations.some(p=>p.formulationId===f.id&&!['Cancelada','Aplicada'].includes(p.status)))
 return <>
  <PageHeader title="Preparaciones por tanque" subtitle="Convierte fórmulas aprobadas en consumos reales de inventario, costos y órdenes de aplicación."/>
  <Card title="Responsable de la operación">
   <form id="tank-preparation-responsible" data-module="Preparaciones por tanque" data-record-id="preparation-responsible" className="form-grid one" onSubmit={e=>e.preventDefault()}>
    {msg&&<ValidationMessage type={msg.includes('correctamente')||msg.includes('creada')?'success':'error'}>{msg}</ValidationMessage>}
    <Field label="Nombre del responsable"><input required value={responsible} onChange={e=>setResponsible(e.target.value)} placeholder="Persona que prepara o ejecuta"/></Field>
   </form>
  </Card>
  <Card title="Fórmulas aprobadas disponibles">{available.length?available.map(f=><div className="house-list-card" key={f.id}><div><strong>{state.sites.find(s=>s.id===f.siteId)?.name||'Sede no disponible'} · {f.stage}</strong><small>{f.volumeL} L · fórmula {f.status.toLowerCase()}</small></div><button type="button" className="button primary" onClick={()=>create(f)}>Crear preparación</button></div>):<p className="muted">No hay fórmulas aprobadas pendientes de preparación.</p>}</Card>
  <Card title="Preparaciones registradas">{state.tankPreparations.length?state.tankPreparations.map(p=><article className="preparation-card" key={p.id} data-record-id={p.id}><header><h4>{state.sites.find(s=>s.id===p.siteId)?.name||'Sede no disponible'} · {p.volumeL} L</h4><span className={`tag ${p.status==='Pendiente'?'':'success'}`}>{p.status}</span></header>{Object.entries((p.items||[]).reduce((a,x)=>((a[x.tank]=a[x.tank]||[]).push(x),a),{})).map(([tank,items])=><section className="preparation-tank" key={tank}><h5>Tanque {tank}</h5><div className="preparation-items">{items.map(i=>{const nutrient=state.nutrientProducts.find(x=>x.id===i.nutrientProductId);const lots=state.inventoryLots.filter(l=>l.productId===i.inventoryProductId&&l.siteId===p.siteId&&Number(l.quantity)>0);return <div className="preparation-item" key={i.id}><div><strong>{nutrient?.name||'Producto no disponible'}</strong><small>Requerido: {i.requiredQuantity} {i.requiredUnit}</small></div>{p.status==='Pendiente'?<Field label="Lote de inventario"><select required value={allocations[i.id]||''} onChange={e=>setAllocations({...allocations,[i.id]:e.target.value})}><option value="">Selecciona un lote</option>{lots.map(l=><option key={l.id} value={l.id}>{l.lotNumber||'Sin lote'} · disponible {l.quantity}</option>)}</select></Field>:<small>Lote {state.inventoryLots.find(l=>l.id===i.lotId)?.lotNumber||'—'} · costo ${Number(i.cost||0).toLocaleString('es-CO')}</small>}</div>})}</div></section>)}{p.status==='Pendiente'?<FormActions><button type="button" className="button warning" onClick={()=>execute(p)}>Ejecutar y descontar inventario</button></FormActions>:<p><strong>Costo total:</strong> ${Number(p.totalCost||0).toLocaleString('es-CO')}</p>}</article>):<p className="muted">Todavía no hay preparaciones registradas.</p>}</Card>
 </>
}
