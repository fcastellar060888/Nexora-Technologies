import{DomainEvents}from'../core/events/eventCatalog.js'
import{MATERIAL_PLANT_TYPES,projectLotPlantUnits}from'../domain/materialPlantIdentity.js'
import{appendMaterialPlantFindings,appendMipeIntervention,resolveMaterialPlantFinding}from'../domain/materialPlantMipe.js'
import{executeTreatment,scheduleTreatment}from'../domain/mipe.js'
import{reassignMipeReviewTask}from'../domain/mipeReviewTasks.js'
import{activeOrganizationId}from'../domain/organizationOwnership.js'
import{findMipeRecord,scopeMipeState}from'../domain/mipeTenancy.js'
import{activeUser,hasPermission}from'./permissions.js'
import{executeCoreOperationCommand}from'./coreOperationCommand.js'
import{mutateMipeTenantState}from'./mipeTenantState.js'

export const MIPE_OPERATIONS=Object.freeze({
 CREATE_INCIDENT:'CREATE_INCIDENT',
 DELETE_INCIDENT:'DELETE_INCIDENT',
 CREATE_FINDING:'CREATE_FINDING',
 CREATE_MATERIAL_FINDINGS:'CREATE_MATERIAL_FINDINGS',
 UPDATE_FINDING:'UPDATE_FINDING',
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
function applyOnce(current,organizationId,receipt,mutation){
 if(activeOrganizationId(current)!==organizationId)throw new Error('La empresa activa cambió antes de confirmar la operación MIPE.')
 const existing=findReceipt(current,organizationId,receipt.commandId)
 if(existing){assertReceipt(existing,receipt.signature);return current}
 return appendReceipt(mutation(current),receipt)
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

function planIncident(state,input,aggregateId,organizationId,occurredAt){
 const name=required(input.name,'name'),record={id:aggregateId,organizationId,name,category:text(input.category)||'Plaga',risk:text(input.risk)||'Medio',color:text(input.color)||'#e67e22',active:input.active!==false,createdAt:occurredAt}
 return{aggregateType:'mipe.incident',aggregateId,eventName:DomainEvents.MIPE_INCIDENT_CREATED,siteId:null,payload:{incidentId:aggregateId,name,category:record.category,risk:record.risk},apply:current=>tenantMutation(current,organizationId,tenant=>{if(tenant.incidents.some(item=>item.id===aggregateId))throw new Error('La incidencia ya existe en la empresa activa.');return{...tenant,incidents:[...tenant.incidents,record]}})}
}
function planDeleteIncident(state,input,aggregateId,organizationId){
 const incident=activeRecord(state,'incidents',aggregateId,'incidencia',organizationId)
 return{aggregateType:'mipe.incident',aggregateId,eventName:DomainEvents.MIPE_INCIDENT_DELETED,siteId:null,payload:{incidentId:aggregateId,name:text(incident.name)},apply:current=>tenantMutation(current,organizationId,tenant=>({...tenant,incidents:tenant.incidents.filter(item=>item.id!==aggregateId)}))}
}
function planFinding(state,input,aggregateId,organizationId,occurredAt){
 const plant=activeRecord(state,'plantPositions',required(input.plantPositionId||input.targetId,'plantPositionId'),'planta/Position',organizationId)
 const incident=activeRecord(state,'incidents',required(input.incidentId,'incidentId'),'incidencia',organizationId),siteId=siteForPosition(state,plant)
 if(!siteId)throw new Error('No se pudo resolver la sede de la planta MIPE.')
 const record={id:aggregateId,organizationId,siteId,plantPositionId:plant.id,targetType:'POSITION',targetId:plant.id,incidentId:incident.id,severity:Number(input.severity||1),status:text(input.status)||'Detectado',notes:text(input.notes),action:text(input.action),responsible:text(input.responsible),followUpDate:text(input.followUpDate),createdAt:occurredAt,reportedAt:occurredAt,source:'mipe-command'}
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
function planMaterialFindings(state,input,aggregateId,organizationId,occurredAt){
 const targets=materialTargets(state,organizationId,input.plantIds),draft={type:required(input.type,'type'),severity:text(input.severity)||'Media',notes:text(input.notes),reportedAt:occurredAt,restrictAvailability:input.restrictAvailability===true}
 const siteIds=[...new Set(targets.map(item=>text(item.siteId)).filter(Boolean))],siteId=siteIds.length===1?siteIds[0]:null
 return{aggregateType:'mipe.finding-batch',aggregateId,eventName:DomainEvents.MIPE_FINDING_RECORDED,siteId,payload:{plantIds:targets.map(item=>item.id),type:draft.type,severity:draft.severity,restrictAvailability:draft.restrictAvailability,targetCount:targets.length},apply:current=>{
   const beforeFindings=new Set(list(current.findings).map(item=>item.id)),beforeInterventions=new Set(list(current.mipeInterventions).map(item=>item.id))
   const next=appendMaterialPlantFindings(current,targets,draft)
   const findings=list(next.findings).map(item=>beforeFindings.has(item.id)?item:{...item,organizationId})
   const mipeInterventions=list(next.mipeInterventions).map(item=>beforeInterventions.has(item.id)?item:{...item,organizationId})
   return{...next,findings,mipeInterventions}
 }}
}
function planUpdateFinding(state,input,aggregateId,organizationId,occurredAt){
 const finding=activeRecord(state,'findings',aggregateId,'hallazgo',organizationId),siteId=text(finding.siteId)
 if(input.incidentId)activeRecord(state,'incidents',input.incidentId,'incidencia',organizationId)
 const allowed=['incidentId','severity','status','notes','action','responsible','followUpDate','createdAt'],patch=Object.fromEntries(allowed.filter(key=>input[key]!==undefined).map(key=>[key,input[key]]))
 return{aggregateType:'mipe.finding',aggregateId,eventName:DomainEvents.MIPE_FINDING_UPDATED,siteId,payload:{findingId:aggregateId,changedFields:Object.keys(patch)},apply:current=>tenantMutation(current,organizationId,tenant=>({...tenant,findings:tenant.findings.map(item=>item.id===aggregateId?{...item,...patch,updatedAt:occurredAt}:item)}))}
}
function planResolveFinding(state,input,aggregateId,organizationId,occurredAt){
 const finding=activeRecord(state,'findings',aggregateId,'hallazgo',organizationId),siteId=text(finding.siteId),status=text(input.status)||'Resuelto'
 return{aggregateType:'mipe.finding',aggregateId,eventName:DomainEvents.MIPE_FINDING_RESOLVED,siteId,payload:{findingId:aggregateId,status,resolutionNotes:text(input.resolutionNotes||input.notes),releaseAvailability:input.releaseAvailability!==false},apply:current=>{
  if(finding.materialPlantId){
   const tenant=scopeMipeState(current,organizationId),scopedCurrent={...current,findings:tenant.findings,mipeInterventions:tenant.mipeInterventions}
   const outcome=resolveMaterialPlantFinding(scopedCurrent,{findingId:aggregateId,status,resolutionNotes:text(input.resolutionNotes||input.notes),resolvedAt:occurredAt,releaseAvailability:input.releaseAvailability!==false})
   const merged=tenantMutation(current,organizationId,currentTenant=>({...currentTenant,findings:outcome.state.findings,mipeInterventions:outcome.state.mipeInterventions}))
   return{...merged,materialPlantUnits:outcome.state.materialPlantUnits,plantEvents:outcome.state.plantEvents}
  }
  return tenantMutation(current,organizationId,tenant=>({...tenant,findings:tenant.findings.map(item=>item.id===aggregateId?{...item,status,closedAt:occurredAt,resolvedAt:occurredAt,resolutionNotes:text(input.resolutionNotes||input.notes),updatedAt:occurredAt}:item)}))
 }}
}
function planDeleteFinding(state,input,aggregateId,organizationId){
 const finding=activeRecord(state,'findings',aggregateId,'hallazgo',organizationId),siteId=text(finding.siteId)
 return{aggregateType:'mipe.finding',aggregateId,eventName:DomainEvents.MIPE_FINDING_DELETED,siteId,payload:{findingId:aggregateId},apply:current=>tenantMutation(current,organizationId,tenant=>({...tenant,findings:tenant.findings.filter(item=>item.id!==aggregateId)}))}
}
function planScheduleTreatment(state,input,aggregateId,organizationId,occurredAt){
 const finding=activeRecord(state,'findings',required(input.findingId,'findingId'),'hallazgo',organizationId),product=activeRecord(state,'products',required(input.productId,'productId'),'producto',organizationId),siteId=text(finding.siteId||product.siteId)
 const request={...input,id:aggregateId,createdAt:occurredAt}
 return{aggregateType:'mipe.treatment',aggregateId,eventName:DomainEvents.MIPE_TREATMENT_SCHEDULED,siteId,payload:{treatmentId:aggregateId,findingId:finding.id,productId:product.id,dose:Number(input.dose),doseUnit:text(input.doseUnit),mixVolume:Number(input.mixVolume)},apply:current=>tenantMutation(current,organizationId,tenant=>scheduleTreatment(tenant,request))}
}
function planExecuteTreatment(state,input,aggregateId,organizationId,occurredAt){
 const treatment=activeRecord(state,'treatments',aggregateId,'tratamiento',organizationId),lot=activeRecord(state,'inventoryLots',required(input.lotId,'lotId'),'lote de inventario',organizationId),finding=activeRecord(state,'findings',treatment.findingId,'hallazgo',organizationId),siteId=text(treatment.siteId||finding.siteId||lot.siteId)
 return{aggregateType:'mipe.treatment',aggregateId,eventName:DomainEvents.MIPE_TREATMENT_EXECUTED,siteId,payload:{treatmentId:aggregateId,findingId:finding.id,lotId:lot.id,totalQuantity:Number(treatment.totalQuantity||0)},apply:current=>tenantMutation(current,organizationId,tenant=>executeTreatment(tenant,{treatmentId:aggregateId,lotId:lot.id,responsible:text(input.responsible),executedAt:occurredAt,costEntryId:text(input.costEntryId)||`${aggregateId}:${text(input.commandId)||'execution'}:cost`}))}
}
function planRecordIntervention(state,input,aggregateId,organizationId,occurredAt){
 const finding=activeRecord(state,'findings',required(input.findingId,'findingId'),'hallazgo',organizationId),siteId=text(finding.siteId)
 return{aggregateType:'mipe.intervention',aggregateId,eventName:DomainEvents.MIPE_INTERVENTION_RECORDED,siteId,payload:{interventionId:aggregateId,findingId:finding.id,type:text(input.type),responsible:text(input.responsible),nextReviewAt:text(input.nextReviewAt)},apply:current=>{
   const tenant=scopeMipeState(current,organizationId),before=new Set(list(tenant.mipeInterventions).map(item=>item.id)),next=appendMipeIntervention(tenant,{...input,findingId:finding.id,performedAt:input.performedAt||occurredAt})
   const candidates=list(next.mipeInterventions).filter(item=>!before.has(item.id))
   if(candidates.length!==1)throw new Error('La intervención MIPE no produjo una identidad única.')
   const stamped=list(next.mipeInterventions).map(item=>item.id===candidates[0].id?{...item,id:aggregateId,organizationId}:item)
   const merged=tenantMutation(current,organizationId,currentTenant=>({...currentTenant,mipeInterventions:stamped}))
   return{...merged,plantEvents:next.plantEvents}
 }}
}
function planReassignIntervention(state,input,aggregateId,organizationId){
 const intervention=activeRecord(state,'mipeInterventions',aggregateId,'intervención',organizationId),finding=activeRecord(state,'findings',intervention.findingId,'hallazgo',organizationId),siteId=text(intervention.siteId||finding.siteId),responsible=required(input.responsible,'responsible')
 return{aggregateType:'mipe.intervention',aggregateId,eventName:DomainEvents.MIPE_INTERVENTION_REASSIGNED,siteId,payload:{interventionId:aggregateId,findingId:finding.id,responsible},apply:current=>tenantMutation(current,organizationId,tenant=>reassignMipeReviewTask(tenant,{interventionId:aggregateId,responsible}))}
}

function plan(state,{operation,input,aggregateId,organizationId,occurredAt}){
 if(operation===MIPE_OPERATIONS.CREATE_INCIDENT)return planIncident(state,input,aggregateId,organizationId,occurredAt)
 if(operation===MIPE_OPERATIONS.DELETE_INCIDENT)return planDeleteIncident(state,input,aggregateId,organizationId)
 if(operation===MIPE_OPERATIONS.CREATE_FINDING)return planFinding(state,input,aggregateId,organizationId,occurredAt)
 if(operation===MIPE_OPERATIONS.CREATE_MATERIAL_FINDINGS)return planMaterialFindings(state,input,aggregateId,organizationId,occurredAt)
 if(operation===MIPE_OPERATIONS.UPDATE_FINDING)return planUpdateFinding(state,input,aggregateId,organizationId,occurredAt)
 if(operation===MIPE_OPERATIONS.RESOLVE_FINDING)return planResolveFinding(state,input,aggregateId,organizationId,occurredAt)
 if(operation===MIPE_OPERATIONS.DELETE_FINDING)return planDeleteFinding(state,input,aggregateId,organizationId)
 if(operation===MIPE_OPERATIONS.SCHEDULE_TREATMENT)return planScheduleTreatment(state,input,aggregateId,organizationId,occurredAt)
 if(operation===MIPE_OPERATIONS.EXECUTE_TREATMENT)return planExecuteTreatment(state,input,aggregateId,organizationId,occurredAt)
 if(operation===MIPE_OPERATIONS.RECORD_INTERVENTION)return planRecordIntervention(state,input,aggregateId,organizationId,occurredAt)
 if(operation===MIPE_OPERATIONS.REASSIGN_INTERVENTION)return planReassignIntervention(state,input,aggregateId,organizationId)
 throw new Error('Operación MIPE desconocida.')
}

export async function executeMipeCommand(state,{operation,entityId='',input={},commandId,occurredAt=new Date().toISOString()}={},deps={}){
 if(!knownOperation(operation))throw new Error('Operación MIPE desconocida.')
 const organizationId=activeOrganizationId(state),id=required(commandId,'commandId'),aggregateId=text(entityId)||id,normalizedInput=plainObject(input)?input:{},signature=mipeCommandSignature({operation,aggregateId,input:normalizedInput}),existing=findReceipt(state,organizationId,id)
 assertReceipt(existing,signature)
 const planned=plan(state,{operation,input:{...normalizedInput,commandId:id},aggregateId,organizationId,occurredAt})
 authorize(state,operation,organizationId,planned.siteId)
 const receipt=Object.freeze({commandId:id,organizationId,signature,operation,aggregateId,occurredAt,actor:actor(state)})
 return executeCoreOperationCommand({commandId:id,organizationId,siteId:planned.siteId,aggregateType:planned.aggregateType,aggregateId,completedEventName:planned.eventName,occurredAt,payload:planned.payload,metadata:{source:'m3.2-mipe-command',operation,actorName:receipt.actor.name},commitMeta:{module:'MIPE',action:operation,detail:aggregateId},apply:current=>applyOnce(current,organizationId,receipt,planned.apply)},deps)
}
