import{DomainEvents}from'../core/events/eventCatalog.js'
import{MATERIAL_PLANT_TYPES,projectLotPlantUnits}from'../domain/materialPlantIdentity.js'
import{appendMaterialPlantFindings,resolveMaterialPlantFinding}from'../domain/materialPlantMipe.js'
import{executeTreatment,scheduleTreatment}from'../domain/mipe.js'
import{archiveMipeIncidentRecord,assertMipeIncidentUsable,createExecutableMipeProductSnapshot,createMipeIncidentCatalogRecord}from'../domain/mipeCatalogAuthority.js'
import{
 MIPE_FINDING_STATES,
 MIPE_FINDING_TRANSITIONS,
 correctMipeFinding,
 createMipeFindingWorkflow,
 mipeFindingHistory,
 transitionMipeFinding,
 transitionNameForResolution
}from'../domain/mipeFindingWorkflow.js'
import{createCanonicalMipeIntervention,reassignCanonicalMipeIntervention}from'../domain/mipeInterventionAuthority.js'
import{activeOrganizationId}from'../domain/organizationOwnership.js'
import{findMipeRecord,scopeMipeState}from'../domain/mipeTenancy.js'
import{activeUser,hasPermission}from'./permissions.js'
import{executeCoreOperationCommand}from'./coreOperationCommand.js'
import{applyMipeTreatmentConfirmation,buildMipeTreatmentTransaction}from'./mipeTreatmentTransaction.js'
import{mutateMipeTenantState}from'./mipeTenantState.js'

export const MIPE_OPERATIONS=Object.freeze({
 CREATE_INCIDENT:'CREATE_INCIDENT',
 ARCHIVE_INCIDENT:'ARCHIVE_INCIDENT',
 DELETE_INCIDENT:'DELETE_INCIDENT',
 CREATE_FINDING:'CREATE_FINDING',
 CREATE_MATERIAL_FINDINGS:'CREATE_MATERIAL_FINDINGS',
 UPDATE_FINDING:'UPDATE_FINDING',
 CORRECT_FINDING:'CORRECT_FINDING',
 TRANSITION_FINDING:'TRANSITION_FINDING',
 RESOLVE_FINDING:'RESOLVE_FINDING',
 DELETE_FINDING:'DELETE_FINDING',
 SCHEDULE_TREATMENT:'SCHEDULE_TREATMENT',
 EXECUTE_TREATMENT:'EXECUTE_TREATMENT',
 RECORD_INTERVENTION:'RECORD_INTERVENTION',
 REASSIGN_INTERVENTION:'REASSIGN_INTERVENTION'
})

const list=value=>Array.isArray(value)?value:[]
const text=value=>String(value??'').trim()
const plainObject=value=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value)
const required=(value,label)=>{const normalized=text(value);if(!normalized)throw new Error(`${label} es obligatorio.`);return normalized}

function canonical(value){
 if(Array.isArray(value))return value.map(canonical)
 if(plainObject(value))return Object.fromEntries(Object.keys(value).sort().filter(key=>value[key]!==undefined).map(key=>[key,canonical(value[key])]))
 return value
}
function stable(value){return JSON.stringify(canonical(value))}
export function mipeCommandRequestKey({operation,entityId='',input={}}={}){return stable({operation:text(operation),entityId:text(entityId),input:plainObject(input)?input:{}})}
export function mipeCommandSignature({operation,aggregateId,input={}}={}){return stable({operation:text(operation),aggregateId:text(aggregateId),input:plainObject(input)?input:{}})}

function knownOperation(operation){return Object.values(MIPE_OPERATIONS).includes(operation)}
function permissionFor(operation){return operation===MIPE_OPERATIONS.EXECUTE_TREATMENT?'execute_treatments':'manage_mipe'}
function authorize(state,operation,organizationId,siteId){
 const permission=permissionFor(operation)
 if(!hasPermission(state,permission,{companyId:organizationId,siteId:siteId||undefined}))throw new Error(`No tienes permiso ${permission} para ejecutar esta operación MIPE.`)
}
function actor(state){const user=activeUser(state);return{id:text(user?.remoteId||user?.id)||'system',name:text(user?.name)||'Sistema'}}

function receipts(state){return list(state?.mipeCommandReceipts).filter(item=>plainObject(item)&&text(item.commandId)&&text(item.organizationId))}
function findReceipt(state,organizationId,commandId){
 const matches=receipts(state).filter(item=>item.organizationId===organizationId&&item.commandId===commandId)
 if(matches.length>1){const signatures=new Set(matches.map(item=>item.signature));if(signatures.size>1)throw new Error('El commandId colisiona con recibos MIPE diferentes.')}
 return matches[0]||null
}
function assertReceipt(receipt,signature){if(receipt&&receipt.signature!==signature)throw new Error('El commandId ya fue usado con contenido diferente.')}
function appendReceipt(state,receipt){return{...state,mipeCommandReceipts:[...receipts(state),receipt]}}
function applyReceiptOnly(current,organizationId,receipt){
 if(activeOrganizationId(current)!==organizationId)throw new Error('La empresa activa cambió antes de confirmar la operación MIPE.')
 const existing=findReceipt(current,organizationId,receipt.commandId)
 if(existing){assertReceipt(existing,receipt.signature);return current}
 return appendReceipt(current,receipt)
}
function applyOnce(current,organizationId,receipt,mutation){
 const checked=applyReceiptOnly(current,organizationId,receipt)
 if(checked!==current)return mutation(checked)
 return current
}

function tenantMutation(current,organizationId,recipe){
 if(activeOrganizationId(current)!==organizationId)throw new Error('La empresa activa cambió antes de confirmar la operación MIPE.')
 return mutateMipeTenantState(current,recipe)
}

function activeRecord(state,collection,id,label,organizationId){return findMipeRecord(state,collection,id,{label,organizationId})}
function siteForPosition(state,position){
 if(position?.siteId)return text(position.siteId)
 const tenant=scopeMipeState(state),bed=tenant.beds.find(item=>item.id===position?.bedId),house=tenant.houses.find(item=>item.id===bed?.houseId)
 return text(bed?.siteId||house?.siteId)
}
function materializedFinding(finding){
 if(list(finding?.mipeHistory).length)return finding
 const history=mipeFindingHistory(finding)
 return{...finding,mipeHistory:history,mipeHistoryVersion:history.length}
}
function replaceFinding(state,finding){return{...state,findings:list(state.findings).map(item=>item.id===finding.id?finding:item)}}

function planIncident(state,input,aggregateId,organizationId,occurredAt){
 const record=createMipeIncidentCatalogRecord({...input,id:aggregateId,organizationId,createdAt:occurredAt})
 return{aggregateType:'mipe.incident',aggregateId,eventName:DomainEvents.MIPE_INCIDENT_CREATED,siteId:null,payload:{incidentId:aggregateId,name:record.name,category:record.category,risk:record.risk,validFrom:record.validFrom||null,validUntil:record.validUntil||null},apply:current=>tenantMutation(current,organizationId,tenant=>{if(tenant.incidents.some(item=>item.id===aggregateId))throw new Error('La incidencia ya existe en la empresa activa.');return{...tenant,incidents:[...tenant.incidents,record]}})}
}
function planArchiveIncident(state,input,aggregateId,organizationId,occurredAt,commandActor){
 const incident=activeRecord(state,'incidents',aggregateId,'incidencia',organizationId),reason=text(input.reason||input.archiveReason),preview=archiveMipeIncidentRecord(incident,{organizationId,commandId:input.commandId,actor:commandActor,occurredAt,reason})
 return{aggregateType:'mipe.incident',aggregateId,eventName:DomainEvents.MIPE_INCIDENT_ARCHIVED,siteId:null,payload:{incidentId:aggregateId,name:text(incident.name),reason,archivedAt:preview.archivedAt},apply:current=>tenantMutation(current,organizationId,tenant=>({...tenant,incidents:tenant.incidents.map(item=>item.id===aggregateId?archiveMipeIncidentRecord(item,{organizationId,commandId:input.commandId,actor:commandActor,occurredAt,reason}):item)}))}
}
function planFinding(state,input,aggregateId,organizationId,occurredAt,commandActor){
 const plant=activeRecord(state,'plantPositions',required(input.plantPositionId||input.targetId,'plantPositionId'),'planta/Position',organizationId)
 const incident=activeRecord(state,'incidents',required(input.incidentId,'incidentId'),'incidencia',organizationId),siteId=siteForPosition(state,plant)
 assertMipeIncidentUsable(incident,{organizationId,at:occurredAt})
 if(!siteId)throw new Error('No se pudo resolver la sede de la planta MIPE.')
 const draft={id:aggregateId,organizationId,siteId,plantPositionId:plant.id,targetType:'POSITION',targetId:plant.id,incidentId:incident.id,severity:Number(input.severity||1),status:text(input.status)||MIPE_FINDING_STATES.DETECTED,notes:text(input.notes),action:text(input.action),responsible:text(input.responsible),followUpDate:text(input.followUpDate),createdAt:occurredAt,reportedAt:occurredAt,source:'mipe-command'}
 const record=createMipeFindingWorkflow(draft,{commandId:input.commandId,actor:commandActor,occurredAt})
 return{aggregateType:'mipe.finding',aggregateId,eventName:DomainEvents.MIPE_FINDING_RECORDED,siteId,payload:{findingId:aggregateId,plantPositionId:plant.id,incidentId:incident.id,severity:record.severity,status:record.status},apply:current=>tenantMutation(current,organizationId,tenant=>{if(tenant.findings.some(item=>item.id===aggregateId))throw new Error('El hallazgo ya existe en la empresa activa.');return{...tenant,findings:[...tenant.findings,record]}})}
}
function materialPlantCandidates(state,organizationId){
 const tenant=scopeMipeState(state,organizationId),overrides=list(state?.materialPlantUnits),units=[]
 for(const lot of list(tenant.grandmotherPlants))units.push(...projectLotPlantUnits(lot,{plantType:MATERIAL_PLANT_TYPES.GRANDMOTHER,overrides}))
 for(const lot of list(tenant.motherPlants))units.push(...projectLotPlantUnits(lot,{plantType:MATERIAL_PLANT_TYPES.MOTHER,overrides}))
 return units
}
function materialTargets(state,organizationId,ids){
 const candidates=materialPlantCandidates(state,organizationId),targets=[]
 for(const id of [...new Set(list(ids).map(text).filter(Boolean))]){
  const matches=candidates.filter(item=>item.id===id)
  if(matches.length!==1)throw new Error(matches.length?'La planta material tiene identidad duplicada dentro de la empresa activa.':'No se encontró la planta material en la empresa activa.')
  targets.push(matches[0])
 }
 if(!targets.length)throw new Error('Selecciona al menos una planta material para registrar MIPE.')
 return targets
}
function planMaterialFindings(state,input,aggregateId,organizationId,occurredAt,commandActor){
 const targets=materialTargets(state,organizationId,input.plantIds),incident=activeRecord(state,'incidents',required(input.incidentId,'incidentId'),'incidencia',organizationId),commandId=required(input.commandId,'commandId')
 assertMipeIncidentUsable(incident,{organizationId,at:occurredAt})
 const findingIdFactory=plant=>`${organizationId}:${commandId}:finding:${plant.id}`,availabilityEventIdFactory=plant=>`${organizationId}:${commandId}:material-block:${plant.id}`
 const draft={incidentId:incident.id,type:incident.name,severity:text(input.severity)||'Media',notes:text(input.notes),reportedAt:occurredAt,restrictAvailability:input.restrictAvailability===true,idFactory:findingIdFactory,availabilityEventIdFactory}
 const siteIds=[...new Set(targets.map(item=>text(item.siteId)).filter(Boolean))],siteId=siteIds.length===1?siteIds[0]:null
 appendMaterialPlantFindings(state,targets,draft)
 return{aggregateType:'mipe.finding-batch',aggregateId,eventName:DomainEvents.MIPE_FINDING_RECORDED,siteId,payload:{plantIds:targets.map(item=>item.id),incidentId:incident.id,type:draft.type,severity:draft.severity,restrictAvailability:draft.restrictAvailability,targetCount:targets.length},apply:current=>{
   const beforeFindings=new Set(list(current.findings).filter(item=>text(item?.organizationId||item?.companyId||item?._organizationId)===organizationId).map(item=>item.id))
   const next=appendMaterialPlantFindings(current,targets,draft)
   const findings=list(next.findings).map(item=>{
    const owner=text(item?.organizationId||item?.companyId||item?._organizationId)
    if(owner!==organizationId||beforeFindings.has(item.id))return item
    const owned={...item,organizationId,siteId:text(item.siteId)||siteId,status:text(item.status)||MIPE_FINDING_STATES.DETECTED,createdAt:item.createdAt||item.reportedAt||occurredAt,reportedAt:item.reportedAt||occurredAt}
    return createMipeFindingWorkflow(owned,{commandId:`${commandId}:material:${item.materialPlantId}`,actor:commandActor,occurredAt:owned.reportedAt})
   })
   return{...next,findings}
 }}
}
function correctionInput(input){
 const{correctionReason,reason,commandId,...patch}=plainObject(input)?input:{}
 return{patch,reason:required(correctionReason||reason,'El motivo de la corrección')}
}
function planCorrectFinding(state,input,aggregateId,organizationId,occurredAt,commandActor){
 const finding=activeRecord(state,'findings',aggregateId,'hallazgo',organizationId),siteId=text(finding.siteId),correction=correctionInput(input)
 if(correction.patch.incidentId&&text(correction.patch.incidentId)!==text(finding.incidentId)){
  const incident=activeRecord(state,'incidents',correction.patch.incidentId,'incidencia',organizationId)
  assertMipeIncidentUsable(incident,{organizationId,at:occurredAt})
 }
 const preview=correctMipeFinding(finding,correction.patch,{commandId:input.commandId,actor:commandActor,occurredAt,reason:correction.reason})
 return{aggregateType:'mipe.finding',aggregateId,eventName:DomainEvents.MIPE_FINDING_CORRECTED,siteId,payload:{findingId:aggregateId,changedFields:Object.keys(preview.mipeHistory.at(-1)?.changes||{}),reason:correction.reason},apply:current=>tenantMutation(current,organizationId,tenant=>({...tenant,findings:tenant.findings.map(item=>item.id===aggregateId?correctMipeFinding(item,correction.patch,{commandId:input.commandId,actor:commandActor,occurredAt,reason:correction.reason}):item)}))}
}
function planTransitionFinding(state,input,aggregateId,organizationId,occurredAt,commandActor){
 const finding=activeRecord(state,'findings',aggregateId,'hallazgo',organizationId),siteId=text(finding.siteId),transition=required(input.transition,'transition'),notes=text(input.reason||input.notes)
 const preview=transitionMipeFinding(finding,transition,{commandId:input.commandId,actor:commandActor,occurredAt,notes,metadata:{source:'mipe-command'}})
 return{aggregateType:'mipe.finding',aggregateId,eventName:DomainEvents.MIPE_FINDING_TRANSITIONED,siteId,payload:{findingId:aggregateId,transition,from:text(finding.status),to:text(preview.status),reason:notes},apply:current=>tenantMutation(current,organizationId,tenant=>({...tenant,findings:tenant.findings.map(item=>item.id===aggregateId?transitionMipeFinding(item,transition,{commandId:input.commandId,actor:commandActor,occurredAt,notes,metadata:{source:'mipe-command'}}):item)}))}
}
function planResolveFinding(state,input,aggregateId,organizationId,occurredAt,commandActor){
 const finding=activeRecord(state,'findings',aggregateId,'hallazgo',organizationId),siteId=text(finding.siteId),status=text(input.status)||MIPE_FINDING_STATES.RESOLVED,transition=transitionNameForResolution(status),notes=text(input.resolutionNotes||input.notes)
 const preview=transitionMipeFinding(finding,transition,{commandId:input.commandId,actor:commandActor,occurredAt,notes,metadata:{resolution:true}})
 return{aggregateType:'mipe.finding',aggregateId,eventName:DomainEvents.MIPE_FINDING_RESOLVED,siteId,payload:{findingId:aggregateId,status:preview.status,resolutionNotes:notes,releaseAvailability:input.releaseAvailability!==false},apply:current=>{
  if(finding.materialPlantId){
   const tenant=scopeMipeState(current,organizationId),currentFinding=tenant.findings.find(item=>item.id===aggregateId),scopedCurrent={...current,findings:tenant.findings,mipeInterventions:tenant.mipeInterventions}
   const outcome=resolveMaterialPlantFinding(scopedCurrent,{findingId:aggregateId,status:preview.status,resolutionNotes:notes,resolvedAt:occurredAt,releaseAvailability:input.releaseAvailability!==false})
   const legacyResolved=list(outcome.state.findings).find(item=>item.id===aggregateId)||currentFinding
   const transitioned=transitionMipeFinding(currentFinding,transition,{commandId:input.commandId,actor:commandActor,occurredAt,notes,metadata:{resolution:true}})
   const resolved={...legacyResolved,...transitioned,resolutionNotes:notes}
   const merged=tenantMutation(current,organizationId,currentTenant=>({...currentTenant,findings:outcome.state.findings.map(item=>item.id===aggregateId?resolved:item),mipeInterventions:outcome.state.mipeInterventions}))
   return{...merged,materialPlantUnits:outcome.state.materialPlantUnits,plantEvents:outcome.state.plantEvents}
  }
  return tenantMutation(current,organizationId,tenant=>({...tenant,findings:tenant.findings.map(item=>item.id===aggregateId?{...transitionMipeFinding(item,transition,{commandId:input.commandId,actor:commandActor,occurredAt,notes,metadata:{resolution:true}}),resolutionNotes:notes}:item)}))
 }}
}
function planDeleteFinding(state,input,aggregateId,organizationId){
 activeRecord(state,'findings',aggregateId,'hallazgo',organizationId)
 throw new Error('El hard-delete de hallazgos MIPE está prohibido; usa una transición terminal o una corrección auditable.')
}
function planScheduleTreatment(state,input,aggregateId,organizationId,occurredAt,commandActor){
 const finding=activeRecord(state,'findings',required(input.findingId,'findingId'),'hallazgo',organizationId),product=activeRecord(state,'products',required(input.productId,'productId'),'producto',organizationId),siteId=text(finding.siteId||product.siteId)
 if(!siteId)throw new Error('No se pudo resolver la sede del tratamiento MIPE.')
 const scheduledAt=text(input.date)?`${text(input.date)}T00:00:00.000Z`:occurredAt,productSnapshot=createExecutableMipeProductSnapshot(product,{organizationId,siteId,at:scheduledAt,requestedDoseUnit:text(input.doseUnit)}),request={...input,id:aggregateId,createdAt:occurredAt,productSnapshot}
 let previewFinding=materializedFinding(finding)
 if(text(previewFinding.status)!==MIPE_FINDING_STATES.TREATMENT_APPROVED)previewFinding=transitionMipeFinding(previewFinding,MIPE_FINDING_TRANSITIONS.APPROVE_TREATMENT,{commandId:input.commandId,actor:commandActor,occurredAt,notes:text(input.notes),metadata:{treatmentId:aggregateId,productTechnicalRevision:productSnapshot.technicalRevision}})
 scheduleTreatment(scopeMipeState(state,organizationId),request)
 return{aggregateType:'mipe.treatment',aggregateId,eventName:DomainEvents.MIPE_TREATMENT_SCHEDULED,siteId,payload:{treatmentId:aggregateId,findingId:finding.id,productId:product.id,dose:Number(input.dose),doseUnit:text(input.doseUnit),mixVolume:Number(input.mixVolume),productTechnicalRevision:productSnapshot.technicalRevision,productValidUntil:productSnapshot.validUntil},apply:current=>tenantMutation(current,organizationId,tenant=>{
   const before=tenant.findings.find(item=>item.id===finding.id),scheduled=scheduleTreatment(tenant,request)
   let workflowFinding=materializedFinding(before)
   if(text(workflowFinding.status)!==MIPE_FINDING_STATES.TREATMENT_APPROVED)workflowFinding=transitionMipeFinding(workflowFinding,MIPE_FINDING_TRANSITIONS.APPROVE_TREATMENT,{commandId:input.commandId,actor:commandActor,occurredAt,notes:text(input.notes),metadata:{treatmentId:aggregateId,productTechnicalRevision:productSnapshot.technicalRevision}})
   return replaceFinding(scheduled,workflowFinding)
 })}
}
function treatmentWorkflowAfterExecution(finding,{commandId,commandActor,occurredAt,treatmentId,legacyFinding}){
 let workflowFinding=materializedFinding(finding)
 workflowFinding=transitionMipeFinding(workflowFinding,MIPE_FINDING_TRANSITIONS.BEGIN_TREATMENT,{commandId,actor:commandActor,occurredAt,metadata:{treatmentId}})
 workflowFinding=transitionMipeFinding(workflowFinding,MIPE_FINDING_TRANSITIONS.START_FOLLOW_UP,{commandId,actor:commandActor,occurredAt,metadata:{treatmentId}})
 return{...legacyFinding,...workflowFinding,lastTreatmentAt:legacyFinding?.lastTreatmentAt||occurredAt,reentryUntil:legacyFinding?.reentryUntil||'',harvestRestrictedUntil:legacyFinding?.harvestRestrictedUntil||''}
}
function planExecuteTreatment(state,input,aggregateId,organizationId,occurredAt,commandActor){
 const treatment=activeRecord(state,'treatments',aggregateId,'tratamiento',organizationId),lot=activeRecord(state,'inventoryLots',required(input.lotId,'lotId'),'lote de inventario',organizationId),finding=activeRecord(state,'findings',treatment.findingId,'hallazgo',organizationId),siteId=text(treatment.siteId||finding.siteId||lot.siteId),commandId=required(input.commandId,'commandId')
 if(!siteId)throw new Error('No se pudo resolver la sede de la ejecución MIPE.')
 treatmentWorkflowAfterExecution(finding,{commandId,commandActor,occurredAt,treatmentId:aggregateId,legacyFinding:finding})
 return{aggregateType:'mipe.treatment',aggregateId,eventName:DomainEvents.MIPE_TREATMENT_EXECUTED,siteId,payload:{treatmentId:aggregateId,findingId:finding.id,lotId:lot.id,totalQuantity:Number(treatment.totalQuantity||0),productTechnicalRevision:treatment.productSnapshot?.technicalRevision||null},apply:current=>tenantMutation(current,organizationId,tenant=>{
   const beforeFinding=tenant.findings.find(item=>item.id===finding.id),executed=executeTreatment(tenant,{treatmentId:aggregateId,lotId:lot.id,responsible:text(input.responsible),executedAt:occurredAt,siteId,movementId:`${aggregateId}:${commandId}:movement`,costEntryId:text(input.costEntryId)||`${aggregateId}:${commandId}:cost`})
   const legacyFinding=executed.findings.find(item=>item.id===finding.id)
   const workflowFinding=treatmentWorkflowAfterExecution(beforeFinding,{commandId,commandActor,occurredAt,treatmentId:aggregateId,legacyFinding})
   return replaceFinding(executed,workflowFinding)
 })}
}
function materialInterventionPlantEvent(finding,record,organizationId){
 const materialPlantId=text(record?.findingSnapshot?.materialPlantId||finding?.materialPlantId)
 if(!materialPlantId)return null
 const detail=record.type==='Tratamiento'?`${record.product||'Tratamiento'}${record.dose?` · ${record.dose}`:''}`:record.outcome||'Seguimiento registrado'
 return Object.freeze({id:`${organizationId}:${record.id}:plant-event`,organizationId,siteId:record.siteId||null,plantId:materialPlantId,entityId:materialPlantId,type:'MIPE',title:record.type==='Tratamiento'?'Tratamiento MIPE registrado':'Seguimiento MIPE registrado',detail,date:record.performedAt,createdAt:record.performedAt,source:'mipe-intervention-authority',findingId:finding.id,interventionId:record.id})
}
function planRecordIntervention(state,input,aggregateId,organizationId,occurredAt,commandActor){
 const finding=activeRecord(state,'findings',required(input.findingId,'findingId'),'hallazgo',organizationId),siteId=text(finding.siteId),treatmentId=text(input.treatmentId),treatment=treatmentId?activeRecord(state,'treatments',treatmentId,'tratamiento',organizationId):null
 const record=createCanonicalMipeIntervention({finding,treatment,input,organizationId,commandId:aggregateId,actor:commandActor,occurredAt}),plantEvent=materialInterventionPlantEvent(finding,record,organizationId)
 return{aggregateType:'mipe.intervention',aggregateId,eventName:DomainEvents.MIPE_INTERVENTION_RECORDED,siteId,payload:{interventionId:aggregateId,findingId:finding.id,treatmentId:record.treatmentId,type:record.type,responsible:record.responsible,nextReviewAt:record.nextReviewAt,targetType:record.findingSnapshot.targetType,targetId:record.findingSnapshot.targetId},apply:current=>{
   const merged=tenantMutation(current,organizationId,tenant=>{
    if(tenant.mipeInterventions.some(item=>item.id===aggregateId))throw new Error('La intervención MIPE ya existe en la empresa activa.')
    return{...tenant,mipeInterventions:[...tenant.mipeInterventions,record]}
   })
   if(!plantEvent)return merged
   if(list(merged.plantEvents).some(item=>item.id===plantEvent.id))return merged
   return{...merged,plantEvents:[...list(merged.plantEvents),plantEvent]}
 }}
}
function planReassignIntervention(state,input,aggregateId,organizationId,occurredAt,commandActor){
 const intervention=activeRecord(state,'mipeInterventions',aggregateId,'intervención',organizationId),finding=activeRecord(state,'findings',intervention.findingId,'hallazgo',organizationId),siteId=text(intervention.siteId||finding.siteId),responsible=required(input.responsible,'responsible')
 const preview=reassignCanonicalMipeIntervention(intervention,{responsible,commandId:input.commandId,actor:commandActor,occurredAt})
 return{aggregateType:'mipe.intervention',aggregateId,eventName:DomainEvents.MIPE_INTERVENTION_REASSIGNED,siteId,payload:{interventionId:aggregateId,findingId:finding.id,previousResponsible:text(intervention.responsible),responsible:preview.responsible},apply:current=>tenantMutation(current,organizationId,tenant=>({...tenant,mipeInterventions:tenant.mipeInterventions.map(item=>item.id===aggregateId?reassignCanonicalMipeIntervention(item,{responsible,commandId:input.commandId,actor:commandActor,occurredAt}):item)}))}
}

function plan(state,{operation,input,aggregateId,organizationId,occurredAt,commandActor}){
 if(operation===MIPE_OPERATIONS.CREATE_INCIDENT)return planIncident(state,input,aggregateId,organizationId,occurredAt)
 if(operation===MIPE_OPERATIONS.ARCHIVE_INCIDENT||operation===MIPE_OPERATIONS.DELETE_INCIDENT)return planArchiveIncident(state,input,aggregateId,organizationId,occurredAt,commandActor)
 if(operation===MIPE_OPERATIONS.CREATE_FINDING)return planFinding(state,input,aggregateId,organizationId,occurredAt,commandActor)
 if(operation===MIPE_OPERATIONS.CREATE_MATERIAL_FINDINGS)return planMaterialFindings(state,input,aggregateId,organizationId,occurredAt,commandActor)
 if(operation===MIPE_OPERATIONS.UPDATE_FINDING||operation===MIPE_OPERATIONS.CORRECT_FINDING)return planCorrectFinding(state,input,aggregateId,organizationId,occurredAt,commandActor)
 if(operation===MIPE_OPERATIONS.TRANSITION_FINDING)return planTransitionFinding(state,input,aggregateId,organizationId,occurredAt,commandActor)
 if(operation===MIPE_OPERATIONS.RESOLVE_FINDING)return planResolveFinding(state,input,aggregateId,organizationId,occurredAt,commandActor)
 if(operation===MIPE_OPERATIONS.DELETE_FINDING)return planDeleteFinding(state,input,aggregateId,organizationId)
 if(operation===MIPE_OPERATIONS.SCHEDULE_TREATMENT)return planScheduleTreatment(state,input,aggregateId,organizationId,occurredAt,commandActor)
 if(operation===MIPE_OPERATIONS.EXECUTE_TREATMENT)return planExecuteTreatment(state,input,aggregateId,organizationId,occurredAt,commandActor)
 if(operation===MIPE_OPERATIONS.RECORD_INTERVENTION)return planRecordIntervention(state,input,aggregateId,organizationId,occurredAt,commandActor)
 if(operation===MIPE_OPERATIONS.REASSIGN_INTERVENTION)return planReassignIntervention(state,input,aggregateId,organizationId,occurredAt,commandActor)
 throw new Error('Operación MIPE desconocida.')
}

export async function executeMipeCommand(state,{operation,entityId='',input={},commandId,occurredAt=new Date().toISOString()}={},deps={}){
 if(!knownOperation(operation))throw new Error('Operación MIPE desconocida.')
 const organizationId=activeOrganizationId(state),id=required(commandId,'commandId'),aggregateId=text(entityId)||id,normalizedInput=plainObject(input)?input:{},signature=mipeCommandSignature({operation,aggregateId,input:normalizedInput}),existing=findReceipt(state,organizationId,id),commandActor=actor(state)
 assertReceipt(existing,signature)
 const planned=plan(state,{operation,input:{...normalizedInput,commandId:id},aggregateId,organizationId,occurredAt,commandActor})
 authorize(state,operation,organizationId,planned.siteId)
 const receipt=Object.freeze({commandId:id,organizationId,signature,operation,aggregateId,occurredAt,actor:commandActor})
 const localApply=current=>applyOnce(current,organizationId,receipt,planned.apply)
 const remoteTreatment=operation===MIPE_OPERATIONS.EXECUTE_TREATMENT&&!existing&&typeof deps.commitTreatmentTransaction==='function'
 const transaction=remoteTreatment?buildMipeTreatmentTransaction(state,localApply(state),{commandId:id,signature,organizationId,treatmentId:aggregateId,siteId:planned.siteId}):null
 const prepareCommit=remoteTreatment?()=>deps.commitTreatmentTransaction(transaction):null
 const apply=remoteTreatment?(current,confirmation)=>{
  if(activeOrganizationId(current)!==organizationId)throw new Error('La empresa activa cambió antes de confirmar la operación MIPE.')
  const hydrated=applyMipeTreatmentConfirmation(current,confirmation,organizationId)
  return applyReceiptOnly(hydrated,organizationId,receipt)
 }:localApply
 const commitMeta={module:'MIPE',action:operation,detail:aggregateId,...(remoteTreatment?{sync:false}:{})}
 return executeCoreOperationCommand({commandId:id,organizationId,siteId:planned.siteId,aggregateType:planned.aggregateType,aggregateId,completedEventName:planned.eventName,occurredAt,payload:planned.payload,metadata:{source:'m3.2-mipe-command',operation,actorName:receipt.actor.name,remoteTreatment},prepareCommit,commitMeta,apply},deps)
}
