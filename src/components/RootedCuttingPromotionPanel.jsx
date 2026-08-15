import{useMemo,useState}from'react'
import Card from'./Card'
import Field from'./Field'
import{clearSelection,createBulkActionRequest,createSelection,isSelected,selectAll,selectionSummary,toggleSelection}from'../core/selection/index.js'
import{PROMOTION_TARGETS,promotablePropagationUnits,promotionTargetForBatch}from'../domain/propagationPromotion.js'
import{activeOrganizationId,resolveOrganizationId}from'../domain/organizationOwnership.js'
import{executePropagationPromotionCommand}from'../services/propagationPromotionCommand.js'

const TARGET_LABELS={
 [PROMOTION_TARGETS.MOTHER]:'renovación de madres',
 [PROMOTION_TARGETS.GRANDMOTHER]:'renovación de abuelas',
 [PROMOTION_TARGETS.PRODUCTION]:'lote productivo'
}

export default function RootedCuttingPromotionPanel({state,update,batch}){
 const organizationId=activeOrganizationId(state)
 const available=useMemo(()=>promotablePropagationUnits(state,batch.id).filter(unit=>{try{return resolveOrganizationId(state,{record:unit,siteId:unit.siteId||batch.siteId,label:'el esqueje'})===organizationId}catch{return false}}),[state,batch.id,batch.siteId,organizationId])
 const availableIds=available.map(unit=>unit.id),target=promotionTargetForBatch(batch)
 const supported=Boolean(TARGET_LABELS[target])
 const[selection,setSelection]=useState(()=>createSelection({scopeType:'propagation.batch',scopeId:batch.id}))
 const[form,setForm]=useState({effectiveDate:new Date().toISOString().slice(0,10),responsible:'',notes:'',houseId:'',bedId:'',confirmed:false})
 const[busy,setBusy]=useState(false)
 const[notice,setNotice]=useState('')
 const summary=selectionSummary(selection,availableIds)
 const houses=(state.houses||[]).filter(house=>house.siteId===batch.siteId&&(()=>{try{return resolveOrganizationId(state,{record:house,siteId:batch.siteId,label:'la nave'})===organizationId}catch{return false}})())
 const beds=(state.beds||[]).filter(bed=>bed.houseId===form.houseId&&(()=>{try{return resolveOrganizationId(state,{record:bed,siteId:batch.siteId,label:'la cama'})===organizationId}catch{return false}})())
 const freePositions=form.bedId?(state.plantPositions||[]).filter(position=>position.bedId===form.bedId&&position.active!==true&&!position.sourcePropagationUnitId&&(()=>{try{return resolveOrganizationId(state,{record:position,siteId:batch.siteId,label:'la posición'})===organizationId}catch{return false}})()).length:0

 async function execute(event){
  event.preventDefault();if(busy)return
  setBusy(true);setNotice('')
  try{
   if(!supported)throw new Error('Este propósito todavía no tiene una promoción operativa confirmada.')
   if(target===PROMOTION_TARGETS.PRODUCTION&&(!form.houseId||!form.bedId))throw new Error('Selecciona nave y cama para promover a producción.')
   if(!form.confirmed)throw new Error('Confirma explícitamente la promoción antes de continuar.')
   const request=createBulkActionRequest({selection,actionType:'propagation.promote',availableIds,requiresConfirmation:true,metadata:{batchId:batch.id,target}})
   await executePropagationPromotionCommand(state,{batchId:batch.id,unitIds:request.targetIds,effectiveDate:form.effectiveDate,responsible:form.responsible,notes:form.notes,houseId:form.houseId,bedId:form.bedId,commandId:crypto.randomUUID()},{commit:update})
   setSelection(current=>clearSelection(current));setForm(current=>({...current,notes:'',confirmed:false}));setNotice('Promoción registrada con trazabilidad.')
  }catch(error){setNotice(error instanceof Error?error.message:'No fue posible promover los esquejes.')}
  finally{setBusy(false)}
 }

 if(!supported)return <Card title="Promoción de esquejes enraizados"><p className="muted">El propósito de este lote permanece en evaluación y no ejecutará cambios automáticos hasta confirmar su flujo operativo.</p></Card>
 return <Card title="Promover esquejes enraizados" subtitle={`Destino definido por el propósito del lote: ${TARGET_LABELS[target]}.`}>
  <div className="selection-toolbar"><strong>{summary.selectedCount} de {summary.availableCount} seleccionados</strong><div className="form-actions"><button type="button" className="button secondary" disabled={!availableIds.length||summary.isAll} onClick={()=>setSelection(current=>selectAll(current,availableIds))}>Seleccionar todos</button><button type="button" className="button secondary" disabled={summary.isEmpty} onClick={()=>setSelection(current=>clearSelection(current))}>Limpiar</button></div></div>
  {available.length?<div className="table-scroll"><table><thead><tr><th></th><th>Esqueje</th><th>Estado</th><th>Banco</th><th>Bandeja</th><th>Posición</th></tr></thead><tbody>{available.map(unit=><tr key={`${organizationId}:${unit.id}`} className={isSelected(selection,unit.id)?'selected-row':''}><td><input aria-label={`Seleccionar ${unit.code}`} type="checkbox" checked={isSelected(selection,unit.id)} onChange={()=>setSelection(current=>toggleSelection(current,unit.id))}/></td><td><strong>{unit.code}</strong></td><td>{unit.status}</td><td>{state.propagationBanks.find(bank=>bank.id===unit.bankId)?.name||'—'}</td><td>{unit.trayIndex||'—'}</td><td>{unit.traySlot||'—'}</td></tr>)}</tbody></table></div>:<p className="muted">No hay esquejes enraizados disponibles para promover.</p>}
  <form className="form-grid" onSubmit={execute}>
   <Field label="Fecha efectiva" required><input type="date" value={form.effectiveDate} onChange={event=>setForm({...form,effectiveDate:event.target.value})}/></Field>
   <Field label="Responsable"><input value={form.responsible} onChange={event=>setForm({...form,responsible:event.target.value})}/></Field>
   {target===PROMOTION_TARGETS.PRODUCTION&&<><Field label="Nave" required><select value={form.houseId} onChange={event=>setForm({...form,houseId:event.target.value,bedId:''})}><option value="">Seleccionar</option>{houses.map(house=><option key={house.id} value={house.id}>{house.name}</option>)}</select></Field><Field label="Cama" required help={form.bedId?`${freePositions} posiciones canónicas libres.`:''}><select value={form.bedId} onChange={event=>setForm({...form,bedId:event.target.value})}><option value="">Seleccionar</option>{beds.map(bed=><option key={bed.id} value={bed.id}>{bed.name}</option>)}</select></Field></>}
   <Field label="Observaciones"><textarea value={form.notes} onChange={event=>setForm({...form,notes:event.target.value})}/></Field>
   <label className="confirmation-check span-all"><input type="checkbox" checked={form.confirmed} onChange={event=>setForm({...form,confirmed:event.target.checked})}/><span>Confirmo que los {summary.selectedCount} esquejes seleccionados serán promovidos a {TARGET_LABELS[target]}.</span></label>
   {notice&&<p className={`auth-status ${notice.startsWith('Promoción')?'success':'error'} span-all`} role="status">{notice}</p>}
   <div className="form-actions span-all"><button className="button primary" disabled={busy||summary.isEmpty||(target===PROMOTION_TARGETS.PRODUCTION&&summary.selectedCount>freePositions)}>{busy?'Promoviendo…':'Promover selección'}</button></div>
  </form>
 </Card>
}
