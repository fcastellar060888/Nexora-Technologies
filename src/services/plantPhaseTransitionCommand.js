import{DomainEvents,publishDomainEvent}from'../core/events/index.js'
import{cultivationPhases}from'../domain/propagation.js'
import{MIPE_RESTRICTED_OPERATIONS,assertMipeOperationAllowed}from'../domain/mipeOperationalRestrictions.js'
import{activeOrganizationId}from'../domain/organizationOwnership.js'
import{findMipeRecord,scopeMipeState}from'../domain/mipeTenancy.js'
import{hasPermission}from'./permissions.js'
import{executeCoreOperationCommand}from'./coreOperationCommand.js'

const text=value=>String(value??'').trim()
const iso=value=>{const normalized=text(value);if(!normalized||Number.isNaN(Date.parse(normalized)))throw new Error('occurredAt del cambio de fase no es válido.');return new Date(normalized).toISOString()}
const dateOnly=value=>{const normalized=text(value);if(!/^\d{4}-\d{2}-\d{2}$/.test(normalized))throw new Error('La fecha del cambio de fase no es válida.');return normalized}

function uniqueRecord(records,label){if(records.length!==1)throw new Error(records.length?`${label} tiene identidad duplicada dentro de la empresa activa.`:`No se encontró ${label} dentro de la empresa activa.`);return records[0]}
function positionLocation(state,position,organizationId){
 const tenant=scopeMipeState(state,organizationId),directSiteId=text(position?.siteId),directHouseId=text(position?.houseId),bedId=text(position?.bedId)
 let bed=null,house=null,houseId='',siteId=''
 if(bedId){
  bed=uniqueRecord((tenant.beds||[]).filter(item=>text(item.id)===bedId),'la cama canónica de la planta')
  houseId=text(bed?.houseId)
  if(directHouseId&&directHouseId!==houseId)throw new Error('La ubicación de la planta es contradictoria con su nave canónica.')
  if(houseId){
   house=uniqueRecord((tenant.houses||[]).filter(item=>text(item.id)===houseId),'la nave canónica de la planta')
   const bedSiteId=text(bed?.siteId),houseSiteId=text(house?.siteId)
   if(bedSiteId&&houseSiteId&&bedSiteId!==houseSiteId)throw new Error('La ubicación de la cama es contradictoria con su nave canónica.')
   siteId=houseSiteId||bedSiteId
  }else{
   if(directHouseId)throw new Error('La planta declara una nave que su cama canónica no referencia.')
   siteId=text(bed?.siteId)
  }
 }else if(directHouseId){
  houseId=directHouseId
  house=uniqueRecord((tenant.houses||[]).filter(item=>text(item.id)===houseId),'la nave canónica de la planta')
  siteId=text(house?.siteId)
 }else siteId=directSiteId
 if(directSiteId&&siteId&&directSiteId!==siteId)throw new Error('La ubicación de la planta es contradictoria con su sede canónica.')
 siteId=siteId||directSiteId
 if(!siteId)throw new Error('No se pudo resolver la sede canónica de la planta.')
 uniqueRecord((tenant.sites||[]).filter(item=>text(item.id)===siteId),'la sede canónica de la planta')
 return Object.freeze({siteId,houseId,bedId})
}
function assertDeclaredLocation(input,location){
 for(const[field,label]of[['siteId','sede'],['houseId','nave'],['bedId','cama']]){const declared=text(input?.[field]),canonical=text(location?.[field]);if(declared&&declared!==canonical)throw new Error(`La ${label} declarada para el cambio de fase contradice la ubicación canónica de la planta.`)}
}
function existingTransition(state,organizationId,commandId){
 const matches=(state.phaseTransitions||[]).filter(item=>text(item.id)===commandId&&text(item.organizationId||item.companyId||item._organizationId)===organizationId)
 if(matches.length>1)throw new Error('El cambio de fase tiene identidad duplicada dentro de la empresa activa.')
 return matches[0]||null
}
function assertReplayMatches(existing,input){
 const comparisons=[
  ['plantId',text(input.plantId),text(existing.plantId||existing.entityId)],
  ['fromPhase',text(input.fromPhase),text(existing.fromPhase)],
  ['toPhase',text(input.toPhase),text(existing.toPhase)],
  ['date',text(input.date),text(existing.date)],
  ['siteId',text(input.siteId),text(existing.siteId)],
  ['houseId',text(input.houseId),text(existing.houseId)],
  ['bedId',text(input.bedId),text(existing.bedId)],
  ['responsible',text(input.responsible),text(existing.responsible)],
  ['notes',text(input.notes),text(existing.notes)]
 ]
 for(const[label,requested,recorded]of comparisons)if(requested&&requested!==recorded)throw new Error(`El commandId del cambio de fase ya fue usado con ${label} diferente.`)
 return existing
}
function operationForTransition(transition){return transition.toPhase==='Cosecha'?MIPE_RESTRICTED_OPERATIONS.HARVEST:MIPE_RESTRICTED_OPERATIONS.CULTIVATION_WORK}
function assertTargetPermission(state,organizationId,siteId){if(!hasPermission(state,'manage_cultivation',{companyId:organizationId,siteId}))throw new Error('No tienes permiso manage_cultivation sobre la sede real de esta planta.')}

export function preparePlantPhaseTransition(state,input={}, {commandId=text(input.commandId),occurredAt=input.occurredAt||new Date().toISOString()}={}){
 const organizationId=activeOrganizationId(state),id=text(commandId)
 if(!id)throw new Error('commandId es obligatorio para cambiar la fase de una planta.')
 const retry=existingTransition(state,organizationId,id)
 if(retry)return Object.freeze({organizationId,transition:assertReplayMatches(retry,input),retry:true})
 const plantId=text(input.plantId),plant=findMipeRecord(state,'plantPositions',plantId,{label:'planta/Position',organizationId})
 const fromPhase=text(input.fromPhase||plant.currentPhase),toPhase=text(input.toPhase),when=iso(occurredAt),date=dateOnly(input.date||when.slice(0,10)),location=positionLocation(state,plant,organizationId)
 assertDeclaredLocation(input,location)
 if(!cultivationPhases.includes(fromPhase)||!cultivationPhases.includes(toPhase))throw new Error('La fase de cultivo solicitada no es válida.')
 if(fromPhase===toPhase)throw new Error('La fase nueva debe ser diferente de la fase actual.')
 assertMipeOperationAllowed(state,{operation:toPhase==='Cosecha'?MIPE_RESTRICTED_OPERATIONS.HARVEST:MIPE_RESTRICTED_OPERATIONS.CULTIVATION_WORK,targetType:'POSITION',targetId:plant.id,organizationId,at:when})
 const transition=Object.freeze({id,commandId:id,organizationId,entityType:'plant',entityId:plant.id,plantId:plant.id,fromPhase,toPhase,date,occurredAt:when,createdAt:when,siteId:location.siteId,houseId:location.houseId,bedId:location.bedId,responsible:text(input.responsible),notes:text(input.notes)})
 return Object.freeze({organizationId,plant,transition,retry:false})
}

function applyPrepared(current,prepared){
 const{organizationId,transition}=prepared,existing=existingTransition(current,organizationId,transition.id)
 if(existing){assertReplayMatches(existing,transition);return current}
 if(activeOrganizationId(current)!==organizationId)throw new Error('La empresa activa cambió antes de confirmar el cambio de fase.')
 const plant=findMipeRecord(current,'plantPositions',transition.plantId,{label:'planta/Position',organizationId}),location=positionLocation(current,plant,organizationId)
 if(location.siteId!==transition.siteId||location.houseId!==transition.houseId||location.bedId!==transition.bedId)throw new Error('La ubicación canónica de la planta cambió antes de confirmar el cambio de fase.')
 assertTargetPermission(current,organizationId,location.siteId)
 if(text(plant.currentPhase)&&text(plant.currentPhase)!==transition.fromPhase)throw new Error('La fase actual de la planta cambió antes de confirmar la transición.')
 assertMipeOperationAllowed(current,{operation:operationForTransition(transition),targetType:'POSITION',targetId:plant.id,organizationId,at:transition.occurredAt})
 return{
  ...current,
  phaseTransitions:[...(current.phaseTransitions||[]),transition],
  plantPositions:(current.plantPositions||[]).map(item=>item===plant?{...item,currentPhase:transition.toPhase,phaseStartDate:transition.date}:item)
 }
}

export async function executePlantPhaseTransitionCommand(state,input={},deps={}){
 const commandId=text(input.commandId)||crypto.randomUUID(),occurredAt=input.occurredAt||new Date().toISOString(),prepared=preparePlantPhaseTransition(state,input,{commandId,occurredAt})
 assertTargetPermission(state,prepared.organizationId,prepared.transition.siteId)
 if(prepared.retry)return Object.freeze({ok:true,retry:true,commandId,transition:prepared.transition})
 const publishEvent=deps.publishEvent||((event)=>publishDomainEvent(state,event)),commit=deps.commit
 if(typeof commit!=='function')throw new TypeError('commit es obligatorio para cambiar la fase de una planta.')
 await executeCoreOperationCommand({commandId,organizationId:prepared.organizationId,siteId:prepared.transition.siteId,aggregateType:'cultivation.plant',aggregateId:prepared.plant.id,completedEventName:DomainEvents.PLANT_PHASE_CHANGED,occurredAt,payload:{plantId:prepared.plant.id,fromPhase:prepared.transition.fromPhase,toPhase:prepared.transition.toPhase,date:prepared.transition.date},metadata:{module:'cultivation',restrictionGuard:'mipe'},apply:current=>applyPrepared(current,prepared)},{publishEvent,commit})
 return Object.freeze({ok:true,retry:false,commandId,transition:prepared.transition})
}
