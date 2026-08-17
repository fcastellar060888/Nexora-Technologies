import{useEffect,useMemo,useState}from'react'
import Card from'../components/Card'
import Field from'../components/Field'
import PageHeader from'../components/PageHeader'
import StateMessage from'../components/StateMessage'
import{FormActions,ValidationMessage}from'../components/forms/FormKit.jsx'
import{scopeOperationalState}from'../domain/operationalContext.js'
import{MIPE_OPERATIONS}from'../services/mipeCommand.js'
import{useMipeCommandStore}from'../services/mipeCommandStore.js'

const today=()=>new Date().toISOString().slice(0,10)
const executableProduct=product=>['MIPE','Biológico','Adyuvante'].includes(product?.category)&&product?.active!==false&&!product?.archivedAt
const availableProducts=state=>state.products.filter(executableProduct)
const initialForm=state=>{const product=availableProducts(state)[0];return{findingId:state.findings.find(x=>!['Resuelto','Falso positivo'].includes(x.status))?.id||'',productId:product?.id||'',dose:0,doseUnit:product?.doseUnit||'mL/L',mixVolume:0,date:today(),responsible:'',notes:''}}

export default function TreatmentsPage(){
 const{state:tenantState,execute}=useMipeCommandStore()
 const state=useMemo(()=>scopeOperationalState(tenantState,tenantState.currentContext),[tenantState])
 const contextKey=['companyId','siteId','houseId','bedId','plantId'].map(key=>state.currentContext?.[key]||'').join(':')
 const[f,setF]=useState(()=>initialForm(state));const[execution,setExecution]=useState({});const[msg,setMsg]=useState('')
 useEffect(()=>{setF(initialForm(state));setExecution({});setMsg('')},[contextKey])
 const openFindings=state.findings.filter(x=>!['Resuelto','Falso positivo'].includes(x.status))
 const products=availableProducts(state)
 const selectedProduct=products.find(p=>p.id===f.productId)
 const canSchedule=openFindings.length>0&&products.length>0
 async function add(e){e.preventDefault();try{await execute({operation:MIPE_OPERATIONS.SCHEDULE_TREATMENT,input:{...f}});setMsg('Tratamiento programado con perfil técnico congelado. El inventario se descontará al ejecutarlo.');setF(current=>({...initialForm(state),findingId:current.findingId,productId:current.productId,doseUnit:selectedProduct?.doseUnit||current.doseUnit,responsible:current.responsible}))}catch(error){setMsg(error.message)}}
 async function executeTreatmentCommand(treatment){const lotId=execution[treatment.id]?.lotId||'';const responsible=execution[treatment.id]?.responsible||treatment.responsible||'';try{await execute({operation:MIPE_OPERATIONS.EXECUTE_TREATMENT,entityId:treatment.id,input:{lotId,responsible}});setMsg('Tratamiento ejecutado, inventario descontado y costo registrado desde la evidencia aprobada.')}catch(error){setMsg(error.message)}}
 return <>
  <PageHeader title="Tratamientos MIPE" subtitle="Programa y ejecuta tratamientos dentro del contexto operativo activo, con perfil técnico congelado y lote físico autorizado."/>
  <Card title="Nuevo tratamiento"><form id="mipe-treatment-new" data-module="Tratamiento MIPE" data-record-id="new-treatment" className="stacked-form" onSubmit={add}>
   {msg&&<ValidationMessage type={msg.includes('ejecutado')||msg.includes('programado')?'success':'error'}>{msg}</ValidationMessage>}
   {!openFindings.length&&<StateMessage type="empty" title="No hay hallazgos abiertos" message="No hay hallazgos abiertos dentro del contexto operativo activo."/>}
   {!products.length&&<StateMessage type="empty" title="No hay productos MIPE activos" message="Configura un producto MIPE, biológico o adyuvante con perfil técnico vigente antes de programar el tratamiento."/>}
   <section className="form-section"><h4>1. Hallazgo y producto</h4><div className="form-grid">
    <Field label="Hallazgo"><select required disabled={!openFindings.length} value={f.findingId} onChange={e=>setF({...f,findingId:e.target.value})}><option value="">Seleccionar hallazgo</option>{openFindings.map(x=>{const i=state.incidents.find(q=>q.id===x.incidentId);return <option key={x.id} value={x.id}>{i?.name||x.type||'Hallazgo'} · {String(x.createdAt||x.reportedAt).slice(0,10)}</option>})}</select></Field>
    <Field label="Producto"><select required disabled={!products.length} value={f.productId} onChange={e=>{const product=products.find(p=>p.id===e.target.value);setF({...f,productId:e.target.value,doseUnit:product?.doseUnit||''})}}><option value="">Seleccionar producto</option>{products.map(p=><option key={p.id} value={p.id}>{p.name} · existencia {state.inventoryLots.filter(l=>l.productId===p.id).reduce((a,l)=>a+Number(l.quantity||0),0)} {p.unit}</option>)}</select></Field>
   </div>{selectedProduct&&<div className="management-summary"><div><span>Ingrediente activo</span><strong>{selectedProduct.activeIngredient||'No registrado'}</strong></div><div><span>Registro</span><strong>{selectedProduct.registrationNumber||'No registrado'}</strong></div><div><span>Vigencia</span><strong>{selectedProduct.validUntil?`Hasta ${String(selectedProduct.validUntil).slice(0,10)}`:'Sin vencimiento técnico'}</strong></div><div><span>Reentrada / carencia</span><strong>{Number(selectedProduct.reentryHours||0)} h / {Number(selectedProduct.withdrawalDays||0)} d</strong></div></div>}</section>
   <section className="form-section"><h4>2. Dosis y programación</h4><div className="form-grid">
    <Field label="Dosis aprobada"><input type="number" min="0" step=".01" value={f.dose} onChange={e=>setF({...f,dose:Number(e.target.value)})}/>{selectedProduct&&<small>Perfil: {selectedProduct.doseMin||0}–{selectedProduct.doseMax||0} {selectedProduct.doseUnit}</small>}</Field>
    <Field label="Unidad de dosis"><input aria-label="Unidad de dosis técnica" value={selectedProduct?.doseUnit||f.doseUnit} disabled/></Field>
    <Field label="Volumen de mezcla (L)"><input type="number" min="0" step=".01" value={f.mixVolume} onChange={e=>setF({...f,mixVolume:Number(e.target.value)})}/></Field>
    <Field label="Fecha programada"><input type="date" value={f.date} onChange={e=>setF({...f,date:e.target.value})}/></Field>
    <Field label="Responsable"><input value={f.responsible} onChange={e=>setF({...f,responsible:e.target.value})}/></Field>
   </div></section>
   <section className="form-section"><h4>3. Observaciones</h4><div className="form-grid one"><Field label="Instrucciones y observaciones"><textarea value={f.notes} onChange={e=>setF({...f,notes:e.target.value})}/></Field></div></section>
   <FormActions><button className="button primary" disabled={!canSchedule}>Programar tratamiento</button></FormActions>
  </form></Card>
  <Card title="Tratamientos">{!state.treatments.length?<StateMessage type="empty" title="No hay tratamientos programados" message="No hay tratamientos asociados a los hallazgos visibles en el contexto operativo activo."/>:<div className="table-scroll"><table><thead><tr><th>Fecha</th><th>Problema</th><th>Producto</th><th>Dosis</th><th>Volumen</th><th>Cantidad</th><th>Estado</th><th>Lote y ejecución</th><th>Restricciones</th></tr></thead><tbody>{state.treatments.map(t=>{const h=state.findings.find(x=>x.id===t.findingId),i=state.incidents.find(x=>x.id===h?.incidentId),liveProduct=state.products.find(x=>x.id===t.productId),profile=t.productSnapshot||liveProduct,lots=state.inventoryLots.filter(l=>l.productId===t.productId&&Number(l.quantity)>0),selected=execution[t.id]||{};return <tr key={t.id}><td>{t.date}</td><td>{i?.name||h?.type}</td><td>{profile?.name}</td><td>{t.dose} {t.doseUnit}</td><td>{t.mixVolume} L</td><td>{t.totalQuantity} {t.inventoryUnit||profile?.unit}</td><td>{t.status}</td><td>{t.status==='Programado'?(lots.length?<form id={`mipe-treatment-execute-${t.id}`} data-module="Ejecución de tratamiento MIPE" data-record-id={t.id} className="inline-operation-form" onSubmit={e=>{e.preventDefault();executeTreatmentCommand(t)}}><select required value={selected.lotId||''} onChange={e=>setExecution({...execution,[t.id]:{...selected,lotId:e.target.value}})}><option value="">Seleccionar lote</option>{lots.map(l=><option key={l.id} value={l.id}>{l.lotNumber} · {l.quantity} {profile?.unit}</option>)}</select><input placeholder="Responsable" value={selected.responsible||t.responsible||''} onChange={e=>setExecution({...execution,[t.id]:{...selected,responsible:e.target.value}})}/><button className="button primary">Ejecutar</button></form>:<StateMessage type="error" compact title="Sin lote disponible" message="No hay inventario utilizable en la sede autorizada del contexto."/>):<><div>{state.inventoryLots.find(l=>l.id===t.lotId)?.lotNumber||'—'}</div><small>{t.executedAt?new Date(t.executedAt).toLocaleString('es-CO'):'—'} · costo ${Number(t.cost||0).toLocaleString('es-CO')}</small></>}</td><td>{t.status==='Ejecutado'?<><div>Reentrada: {t.reentryUntil?new Date(t.reentryUntil).toLocaleString('es-CO'):'—'}</div><div>Carencia: {t.harvestRestrictedUntil?new Date(t.harvestRestrictedUntil).toLocaleString('es-CO'):'—'}</div></>:'Pendiente de ejecución'}</td></tr>})}</tbody></table></div>}</Card>
 </>
}
