import{useMemo,useState}from'react'
import Field from'./Field'
import{dateOnly,lotCode}from'../domain/lifecycle'
import{allocateUnitsToBank,bankOccupancy}from'../domain/propagationAllocation.js'
import{PROPAGATION_PURPOSES,PROPAGATION_PURPOSE_LABELS,createPurposeAwareBatch,propagationSourceUnits}from'../domain/propagationPurpose.js'

const nextSeq=items=>Math.max(0,...items.map(item=>Number(item.sequence)||0))+1
const emptyForm=(state,today)=>({sourcePlantId:'',purpose:PROPAGATION_PURPOSES.PRODUCTION,siteId:state.currentContext?.siteId||state.sites[0]?.id||'',bankId:'',cutDate:today,sequence:nextSeq(state.propagationBatches),quantity:1,productionLotId:'',substrate:'',hormone:'',operator:'',expectedRootDate:'',notes:'',authorized:false})

export default function PurposeAwarePropagationForm({state,update,onCreated}){
 const today=dateOnly(),[form,setForm]=useState(()=>emptyForm(state,today))
 const sources=useMemo(()=>propagationSourceUnits(state,{siteId:form.siteId}),[state,form.siteId])
 const source=sources.find(item=>item.id===form.sourcePlantId)||null
 const banks=state.propagationBanks.filter(item=>item.siteId===form.siteId&&item.active!==false)
 const bank=banks.find(item=>item.id===form.bankId)||null
 const metrics=bank?bankOccupancy(bank,state.propagationUnits):null
 const production=form.purpose===PROPAGATION_PURPOSES.PRODUCTION
 const grandmotherProduction=production&&source?.plantType==='GRANDMOTHER'
 function changeSite(siteId){setForm(current=>({...current,siteId,sourcePlantId:'',bankId:''}))}
 function changeSource(sourcePlantId){const selected=sources.find(item=>item.id===sourcePlantId);setForm(current=>({...current,sourcePlantId,siteId:selected?.siteId||current.siteId,bankId:'',authorized:false}))}
 function submit(event){
  event.preventDefault()
  if(!source)return alert('Selecciona una Abuela o Madre individual como origen.')
  if(grandmotherProduction&&!form.authorized)return alert('Autoriza expresamente el uso productivo de una Abuela.')
  const quantity=Math.max(0,Number(form.quantity)||0)
  if(quantity<=0)return alert('La cantidad debe ser mayor que cero.')
  if(!bank)return alert('Selecciona un banco válido de la misma sede.')
  if(quantity>metrics.available)return alert(`Solo hay ${metrics.available} posiciones disponibles.`)
  const site=state.sites.find(item=>item.id===form.siteId),genetic=state.genetics.find(item=>item.id===source.geneticId)
  const code=lotCode(site,genetic,form.cutDate,form.sequence)
  if(state.propagationBatches.some(item=>item.code===code))return alert('Ese lote ya existe.')
  const id=crypto.randomUUID(),createdAt=new Date().toISOString()
  const rawUnits=Array.from({length:quantity},(_,index)=>({id:crypto.randomUUID(),batchId:id,code:`${code}-E${String(index+1).padStart(4,'0')}`,status:'Cortado',cutDate:form.cutDate,rootDate:'',discardDate:'',discardReason:'',plantPositionId:'',sourcePlantId:source.id,purpose:form.purpose,targetLifecycleStage:''}))
  let units
  try{units=allocateUnitsToBank(rawUnits,bank,state.propagationUnits)}catch(error){return alert(error.message)}
  const base={id,code,createdAt,phase:'Propagación',phaseStartedAt:form.cutDate,activeQuantity:quantity,geneticId:source.geneticId,siteId:form.siteId,bankId:bank.id,cutDate:form.cutDate,sequence:Number(form.sequence),quantity,substrate:form.substrate,hormone:form.hormone,operator:form.operator,expectedRootDate:form.expectedRootDate,notes:form.notes,motherPlantId:source.plantType==='MOTHER'?source.lotId:'',authorizedGrandmotherProduction:grandmotherProduction&&form.authorized}
  const batch=createPurposeAwareBatch(base,{sourceUnit:source,purpose:form.purpose,productionLotId:form.productionLotId})
  const enrichedUnits=units.map(unit=>({...unit,purpose:batch.purpose,targetLifecycleStage:batch.targetLifecycleStage,entersProduction:batch.entersProduction,directParentPlantId:source.id}))
  const eventTitle=production?`Corte productivo de ${quantity} esquejes`:`Corte de ${quantity} esquejes · ${batch.purposeLabel}`
  update(store=>({...store,propagationBatches:[...store.propagationBatches,batch],propagationUnits:[...store.propagationUnits,...enrichedUnits],lotEvents:[...store.lotEvents,{id:crypto.randomUUID(),lotId:id,type:'Creación',date:form.cutDate,title:eventTitle,quantity,responsible:form.operator,notes:`Origen ${source.code}. ${form.notes||''}`.trim()}]}),{module:'Material vegetal',action:production?'Lote productivo creado':'Lote de renovación creado',detail:`${code} · ${source.code} · ${batch.purposeLabel}`})
  setForm(emptyForm(state,today));onCreated?.(batch)
 }
 return <form className="form-grid" onSubmit={submit}>
  <Field label="Propósito" required><select value={form.purpose} onChange={event=>setForm({...form,purpose:event.target.value,productionLotId:'',authorized:false})}>{Object.entries(PROPAGATION_PURPOSE_LABELS).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></Field>
  <Field label="Sede" required><select value={form.siteId} onChange={event=>changeSite(event.target.value)}>{state.sites.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
  <Field label="Planta individual de origen" required help="Puedes elegir una Abuela o Madre activa."><select value={form.sourcePlantId} onChange={event=>changeSource(event.target.value)}><option value="">Seleccionar</option>{sources.map(item=><option key={item.id} value={item.id}>{item.code} · {item.plantType==='GRANDMOTHER'?'Abuela':'Madre'} · {state.genetics.find(genetic=>genetic.id===item.geneticId)?.name||'Sin genética'}</option>)}</select></Field>
  <Field label="Banco" required help={metrics?`${metrics.available} posiciones libres de ${metrics.capacity}.`:'Selecciona el banco donde enraizarán.'}><select value={form.bankId} onChange={event=>setForm({...form,bankId:event.target.value})}><option value="">Seleccionar</option>{banks.map(item=>{const itemMetrics=bankOccupancy(item,state.propagationUnits);return <option key={item.id} value={item.id}>{item.name} · {itemMetrics.available} libres</option>})}</select></Field>
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
  <button className="button primary" disabled={!source||!bank||Number(form.quantity)>Number(metrics?.available||0)||(grandmotherProduction&&!form.authorized)}>Crear corte y ubicar esquejes</button>
 </form>
}
