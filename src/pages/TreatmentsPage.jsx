import{useState}from'react'
import Card from'../components/Card'
import Field from'../components/Field'
import PageHeader from'../components/PageHeader'
import StateMessage from'../components/StateMessage'
import{FormActions,ValidationMessage}from'../components/forms/FormKit.jsx'
import{executeTreatment,scheduleTreatment}from'../domain/mipe'
import{useMipeStore}from'../services/mipeTenantStore.js'

const today=()=>new Date().toISOString().slice(0,10)
const initialForm=state=>({findingId:state.findings.find(x=>!['Resuelto','Falso positivo'].includes(x.status))?.id||'',productId:state.products.find(x=>x.category==='MIPE'||x.category==='Biológico'||x.category==='Adyuvante')?.id||'',dose:0,doseUnit:'mL/L',mixVolume:0,date:today(),responsible:'',notes:''})

export default function TreatmentsPage(){
 const{state,update}=useMipeStore();const[f,setF]=useState(()=>initialForm(state));const[execution,setExecution]=useState({});const[msg,setMsg]=useState('')
 const openFindings=state.findings.filter(x=>!['Resuelto','Falso positivo'].includes(x.status))
 const products=state.products.filter(p=>p.category==='MIPE'||p.category==='Biológico'||p.category==='Adyuvante')
 const selectedProduct=state.products.find(p=>p.id===f.productId)
 const canSchedule=openFindings.length>0&&products.length>0
 function add(e){e.preventDefault();try{update(s=>scheduleTreatment(s,{...f,id:crypto.randomUUID(),createdAt:new Date().toISOString()}),{module:'MIPE',action:'Tratamiento programado',detail:`${f.dose} ${f.doseUnit} para ${f.mixVolume} L`});setMsg('Tratamiento programado. El inventario se descontará al ejecutarlo.');setF(current=>({...initialForm(state),findingId:current.findingId,productId:current.productId,responsible:current.responsible}))}catch(error){setMsg(error.message)}}
 function execute(treatment){const lotId=execution[treatment.id]?.lotId||'';const responsible=execution[treatment.id]?.responsible||treatment.responsible||'';try{update(s=>executeTreatment(s,{treatmentId:treatment.id,lotId,responsible,executedAt:new Date().toISOString(),costEntryId:crypto.randomUUID()}),{module:'MIPE',action:'Tratamiento ejecutado',detail:`Consumo ${treatment.totalQuantity} ${treatment.inventoryUnit||''}`});setMsg('Tratamiento ejecutado, inventario descontado y costo registrado.')}catch(error){setMsg(error.message)}}
 return <>
  <PageHeader title="Tratamientos MIPE" subtitle="Programa la intervención y descuenta el lote físico únicamente al ejecutarla."/>
  <Card title="Nuevo tratamiento"><form id="mipe-treatment-new" data-module="Tratamiento MIPE" data-record-id="new-treatment" className="stacked-form" onSubmit={add}>
   {msg&&<ValidationMessage type={msg.includes('ejecutado')||msg.includes('programado')?'success':'error'}>{msg}</ValidationMessage>}
   {!openFindings.length&&<StateMessage type="empty" title="No hay hallazgos abiertos" message="Registra o reabre un hallazgo MIPE antes de programar una intervención."/>}
   {!products.length&&<StateMessage type="empty" title="No hay productos MIPE disponibles" message="Configura un producto MIPE, biológico o adyuvante y registra su inventario antes de programar el tratamiento."/>}
   <section className="form-section"><h4>1. Hallazgo y producto</h4><div className="form-grid">
    <Field label="Hallazgo"><select required disabled={!openFindings.length} value={f.findingId} onChange={e=>setF({...f,findingId:e.target.value})}><option value="">Seleccionar hallazgo</option>{openFindings.map(x=>{const i=state.incidents.find(q=>q.id===x.incidentId);return <option key={x.id} value={x.id}>{i?.name} · {String(x.createdAt).slice(0,10)}</option>})}</select></Field>
    <Field label="Producto"><select required disabled={!products.length} value={f.productId} onChange={e=>setF({...f,productId:e.target.value,doseUnit:state.products.find(p=>p.id===e.target.value)?.doseUnit||f.doseUnit})}><option value="">Seleccionar producto</option>{products.map(p=><option key={p.id} value={p.id}>{p.name} · existencia {state.inventoryLots.filter(l=>l.productId===p.id).reduce((a,l)=>a+Number(l.quantity||0),0)} {p.unit}</option>)}</select></Field>
   </div></section>
   <section className="form-section"><h4>2. Dosis y programación</h4><div className="form-grid">
    <Field label="Dosis aprobada"><input type="number" min="0" step=".01" value={f.dose} onChange={e=>setF({...f,dose:Number(e.target.value)})}/>{selectedProduct&&<small>Etiqueta: {selectedProduct.doseMin||0}–{selectedProduct.doseMax||0} {selectedProduct.doseUnit}</small>}</Field>
    <Field label="Unidad de dosis"><select value={f.doseUnit} onChange={e=>setF({...f,doseUnit:e.target.value})}><option>mL/L</option><option>g/L</option><option>mL/100 L</option><option>g/100 L</option></select></Field>
    <Field label="Volumen de mezcla (L)"><input type="number" min="0" step=".01" value={f.mixVolume} onChange={e=>setF({...f,mixVolume:Number(e.target.value)})}/></Field>
    <Field label="Fecha programada"><input type="date" value={f.date} onChange={e=>setF({...f,date:e.target.value})}/></Field>
    <Field label="Responsable"><input value={f.responsible} onChange={e=>setF({...f,responsible:e.target.value})}/></Field>
   </div></section>
   <section className="form-section"><h4>3. Observaciones</h4><div className="form-grid one"><Field label="Instrucciones y observaciones"><textarea value={f.notes} onChange={e=>setF({...f,notes:e.target.value})}/></Field></div></section>
   <FormActions><button className="button primary" disabled={!canSchedule}>Programar tratamiento</button></FormActions>
  </form></Card>
  <Card title="Tratamientos">{!state.treatments.length?<StateMessage type="empty" title="No hay tratamientos programados" message="Los tratamientos aparecerán aquí después de asociarlos a un hallazgo abierto y un producto autorizado."/>:<div className="table-scroll"><table><thead><tr><th>Fecha</th><th>Problema</th><th>Producto</th><th>Dosis</th><th>Volumen</th><th>Cantidad</th><th>Estado</th><th>Lote y ejecución</th><th>Restricciones</th></tr></thead><tbody>{state.treatments.map(t=>{const h=state.findings.find(x=>x.id===t.findingId),i=state.incidents.find(x=>x.id===h?.incidentId),p=state.products.find(x=>x.id===t.productId),lots=state.inventoryLots.filter(l=>l.productId===t.productId&&Number(l.quantity)>0),selected=execution[t.id]||{};return <tr key={t.id}><td>{t.date}</td><td>{i?.name}</td><td>{p?.name}</td><td>{t.dose} {t.doseUnit}</td><td>{t.mixVolume} L</td><td>{t.totalQuantity} {t.inventoryUnit||p?.unit}</td><td>{t.status}</td><td>{t.status==='Programado'?(lots.length?<form id={`mipe-treatment-execute-${t.id}`} data-module="Ejecución de tratamiento MIPE" data-record-id={t.id} className="inline-operation-form" onSubmit={e=>{e.preventDefault();execute(t)}}><select required value={selected.lotId||''} onChange={e=>setExecution({...execution,[t.id]:{...selected,lotId:e.target.value}})}><option value="">Seleccionar lote</option>{lots.map(l=><option key={l.id} value={l.id}>{l.lotNumber} · {l.quantity} {p?.unit}</option>)}</select><input placeholder="Responsable" value={selected.responsible||t.responsible||''} onChange={e=>setExecution({...execution,[t.id]:{...selected,responsible:e.target.value}})}/><button className="button primary">Ejecutar</button></form>:<StateMessage type="error" compact title="Sin lote disponible" message="Registra inventario utilizable para este producto antes de ejecutar."/>):<><div>{state.inventoryLots.find(l=>l.id===t.lotId)?.lotNumber||'—'}</div><small>{t.executedAt?new Date(t.executedAt).toLocaleString('es-CO'):'—'} · costo ${Number(t.cost||0).toLocaleString('es-CO')}</small></>}</td><td>{t.status==='Ejecutado'?<><div>Reentrada: {t.reentryUntil?new Date(t.reentryUntil).toLocaleString('es-CO'):'—'}</div><div>Carencia: {t.harvestRestrictedUntil?new Date(t.harvestRestrictedUntil).toLocaleString('es-CO'):'—'}</div></>:'Pendiente de ejecución'}</td></tr>})}</tbody></table></div>}</Card>
 </>
}
