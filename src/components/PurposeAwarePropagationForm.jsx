import{useMemo,useState}from'react'
import Field from'./Field'
import{dateOnly}from'../domain/lifecycle'
import{activeOrganizationId,explicitOrganizationId,resolveOrganizationId}from'../domain/organizationOwnership.js'
import{bankOccupancy}from'../domain/propagationAllocation.js'
import{PROPAGATION_PURPOSES,PROPAGATION_PURPOSE_LABELS,propagationSourceUnits}from'../domain/propagationPurpose.js'
import{geneticProfilesForOrganization}from'../domain/geneticProfile.js'
import{executePlantAction,PlantActions}from'../services/plantActionEngine.js'

const nextSeq=(items,organizationId)=>Math.max(0,...items.filter(item=>!explicitOrganizationId(item)||explicitOrganizationId(item)===organizationId).map(item=>Number(item.sequence)||0))+1
const emptyForm=(state,today,organizationId)=>({sourcePlantId:'',purpose:PROPAGATION_PURPOSES.PRODUCTION,siteId:state.currentContext?.siteId||state.sites.find(site=>!explicitOrganizationId(site)||explicitOrganizationId(site)===organizationId)?.id||'',bankId:'',cutDate:today,sequence:nextSeq(state.propagationBatches||[],organizationId),quantity:1,productionLotId:'',substrate:'',hormone:'',operator:'',expectedRootDate:'',notes:'',authorized:false})

export default function PurposeAwarePropagationForm({state,update,onCreated}){
 const today=dateOnly(),organizationId=activeOrganizationId(state)
 const[form,setForm]=useState(()=>emptyForm(state,today,organizationId))
 const[busy,setBusy]=useState(false)
 const[notice,setNotice]=useState('')
 const sources=useMemo(()=>propagationSourceUnits(state,{organizationId,siteId:form.siteId}),[state,organizationId,form.siteId])
 const genetics=useMemo(()=>geneticProfilesForOrganization(state,organizationId),[state,organizationId])
 const source=sources.find(item=>item.id===form.sourcePlantId)||null
 const banks=(state.propagationBanks||[]).filter(item=>item.siteId===form.siteId&&item.active!==false&&(()=>{try{return resolveOrganizationId(state,{record:item,siteId:item.siteId,label:'el banco'})===organizationId}catch{return false}})())
 const bank=banks.find(item=>item.id===form.bankId)||null
 const tenantUnits=(state.propagationUnits||[]).filter(unit=>!explicitOrganizationId(unit)||explicitOrganizationId(unit)===organizationId)
 const metrics=bank?bankOccupancy(bank,tenantUnits):null
 const production=form.purpose===PROPAGATION_PURPOSES.PRODUCTION
 const grandmotherProduction=production&&source?.plantType==='GRANDMOTHER'
 function changeSite(siteId){setForm(current=>({...current,siteId,sourcePlantId:'',bankId:''}));setNotice('')}
 function changeSource(sourcePlantId){const selected=sources.find(item=>item.id===sourcePlantId);setForm(current=>({...current,sourcePlantId,siteId:selected?.siteId||current.siteId,bankId:'',authorized:false}));setNotice('')}
 async function submit(event){
  event.preventDefault();if(busy)return
  setBusy(true);setNotice('')
  try{
   const action=await executePlantAction(state,PlantActions.CREATE_PROPAGATION_BATCH,{target:{type:'material-plant',id:source?.id||'',organizationId,siteId:form.siteId,snapshot:{plantType:source?.plantType||'',geneticId:source?.geneticId||''}},input:{...form,geneticId:source?.geneticId||'',authorizedGrandmotherProduction:form.authorized,commandId:crypto.randomUUID()}},{commit:update})
   setForm(emptyForm(state,today,organizationId));onCreated?.(action.result.batch)
  }catch(error){setNotice(error instanceof Error?error.message:'No fue posible crear el corte.')}
  finally{setBusy(false)}
 }
 return <form className="form-grid" onSubmit={submit}>
  <Field label="Propósito" required><select value={form.purpose} onChange={event=>setForm({...form,purpose:event.target.value,productionLotId:'',authorized:false})}>{Object.entries(PROPAGATION_PURPOSE_LABELS).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></Field>
  <Field label="Sede" required><select value={form.siteId} onChange={event=>changeSite(event.target.value)}>{(state.sites||[]).filter(site=>{try{return resolveOrganizationId(state,{record:site,label:'la sede'})===organizationId}catch{return false}}).map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
  <Field label="Planta individual de origen" required help="Puedes elegir una Abuela o Madre activa de esta organización."><select value={form.sourcePlantId} onChange={event=>changeSource(event.target.value)}><option value="">Seleccionar</option>{sources.map(item=><option key={`${item.organizationId}:${item.id}`} value={item.id}>{item.code} · {item.plantType==='GRANDMOTHER'?'Abuela':'Madre'} · {genetics.find(genetic=>genetic.id===item.geneticId)?.name||'Sin genética'}</option>)}</select></Field>
  <Field label="Banco" required help={metrics?`${metrics.available} posiciones libres de ${metrics.capacity}.`:'Selecciona el banco donde enraizarán.'}><select value={form.bankId} onChange={event=>setForm({...form,bankId:event.target.value})}><option value="">Seleccionar</option>{banks.map(item=>{const itemMetrics=bankOccupancy(item,tenantUnits);return <option key={item.id} value={item.id}>{item.name} · {itemMetrics.available} libres</option>})}</select></Field>
  <Field label="Fecha de corte"><input type="date" value={form.cutDate} onChange={event=>setForm({...form,cutDate:event.target.value})}/></Field>
  <Field label="Consecutivo"><input type="number" min="1" value={form.sequence} onChange={event=>setForm({...form,sequence:Number(event.target.value)})}/></Field>
  <Field label="Cantidad" required error={metrics&&Number(form.quantity)>metrics.available?`Solo hay ${metrics.available} posiciones libres.`:null}><input type="number" min="1" max={metrics?.available||undefined} value={form.quantity} onChange={event=>setForm({...form,quantity:Number(event.target.value)})}/></Field>
  {production&&<Field label="Lote productivo destino" help="Opcional: deja vacío para usar este mismo lote como destino productivo."><input value={form.productionLotId} onChange={event=>setForm({...form,productionLotId:event.target.value})} placeholder="Código o identificador del lote"/></Field>}
  {!production&&<div className="management-summary span-all"><div><span>Clasificación</span><strong>No productivo</strong></div><div><span>Destino final</span><strong>{PROPAGATION_PURPOSE_LABELS[form.purpose]}</strong></div><div><span>Ingreso a producción</span><strong>No</strong></div></div>}
  {grandmotherProduction&&<label className="bulk-confirmation span-all"><input type="checkbox" checked={form.authorized} onChange={event=>setForm({...form,authorized:event.target.checked})}/><span>Autorizo usar esta Abuela como fuente directa de un lote productivo y dejar trazabilidad de la excepción.</span></label>}
  <Field label="Sustrato"><input value={form.substrate} onChange={event=>setForm({...form,substrate:event.target.value})}/></Field>
  <Field label="Hormona / tratamiento"><input value={form.hormone} onChange={event=>setForm({...form,hormone:event.target.value})}/></Field>
  <Field label="Responsable"><input value={form.operator} onChange={event=>setForm({...form,operator:event.target.value})}/></Field>
  <Field label="Raíz esperada"><input type="date" value={form.expectedRootDate} onChange={event=>setForm({...form,expectedRootDate:event.target.value})}/></Field>
  <Field label="Notas"><textarea value={form.notes} onChange={event=>setForm({...form,notes:event.target.value})}/></Field>
  {metrics&&<div className="management-summary span-all"><div><span>Capacidad</span><strong>{metrics.capacity}</strong></div><div><span>Ocupados</span><strong>{metrics.occupied}</strong></div><div><span>Disponibles</span><strong>{metrics.available}</strong></div><div><span>Después del corte</span><strong>{Math.min(100,metrics.capacity?(metrics.occupied+Number(form.quantity||0))/metrics.capacity*100:0).toFixed(1)}%</strong></div></div>}
  {notice&&<p className="auth-status error span-all" role="alert">{notice}</p>}
  <button className="button primary" disabled={busy||!source||!bank||Number(form.quantity)>Number(metrics?.available||0)||(grandmotherProduction&&!form.authorized)}>{busy?'Creando corte…':'Crear corte y ubicar esquejes'}</button>
 </form>
}
