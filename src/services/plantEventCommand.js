import{activeUser,hasPermission}from'./permissions.js'
import{DomainEvents}from'../core/events/eventCatalog.js'
import{activeOrganizationId,explicitOrganizationId}from'../domain/organizationOwnership.js'
import{findIrrigationMirfeRecord}from'../domain/irrigationMirfeTenancy.js'

const text=value=>String(value??'').trim()
const list=value=>Array.isArray(value)?value:[]
const ALLOWED_TYPES=new Set(['Observación','MIPE','MIRFE','Riego','Producción','Trasplante','Cosecha'])

function plantLocation(state,plant,organizationId){
 const bedId=text(plant?.bedId),bed=bedId?findIrrigationMirfeRecord(state,'beds',bedId,{label:'cama de la planta',organizationId}):null
 const houseId=text(plant?.houseId||bed?.houseId),house=houseId?findIrrigationMirfeRecord(state,'houses',houseId,{label:'nave de la planta',organizationId}):null
 const siteId=text(plant?.siteId||house?.siteId),site=siteId?findIrrigationMirfeRecord(state,'sites',siteId,{label:'sede de la planta',organizationId}):null
 return{bed,house,site,organizationId}
}

function normalizedDate(value){
 const raw=text(value)
 if(!raw||Number.isNaN(Date.parse(raw)))throw new Error('La fecha del evento de planta no es válida.')
 return new Date(raw).toISOString()
}

function sameCommand(existing,record){
 return existing.plantId===record.plantId&&explicitOrganizationId(existing)===record.organizationId&&existing.type===record.type&&existing.title===record.title&&text(existing.detail)===text(record.detail)&&new Date(existing.date).toISOString()===record.date
}

function existingCommand(state,commandId,organizationId){
 const matches=list(state?.plantEvents).filter(item=>(text(item?.commandId)===commandId||text(item?.id)===commandId)&&explicitOrganizationId(item)===organizationId)
 if(matches.length>1)throw new Error('El commandId tiene más de un evento de planta dentro de la empresa activa.')
 return matches[0]||null
}

export function preparePlantEventCommand(state,{plantId,commandId,type='Observación',title,detail='',date=new Date().toISOString()}={}){
 const id=text(plantId),cmd=text(commandId)
 if(!id)throw new Error('La planta es obligatoria.')
 if(!cmd)throw new Error('El commandId es obligatorio para garantizar idempotencia.')
 const organizationId=activeOrganizationId(state)
 const plant=findIrrigationMirfeRecord(state,'plantPositions',id,{label:'planta productiva',organizationId})
 const location=plantLocation(state,plant,organizationId),siteId=location.site?.id||plant.siteId||''
 if(!hasPermission(state,'record_observations',{companyId:organizationId,siteId}))throw new Error('No tienes permiso para registrar observaciones en la sede de esta planta.')
 const normalizedType=text(type)
 if(!ALLOWED_TYPES.has(normalizedType))throw new Error('El tipo de evento de planta no es válido.')
 const normalizedTitle=text(title)
 if(!normalizedTitle)throw new Error('El título del evento de planta es obligatorio.')
 const occurredAt=normalizedDate(date),actor=activeUser(state)
 const record=Object.freeze({id:cmd,commandId:cmd,plantId:id,organizationId,siteId:siteId||null,actorId:actor?.remoteId||actor?.id||'system',type:normalizedType,title:normalizedTitle,detail:text(detail),date:occurredAt})
 const existing=existingCommand(state,cmd,organizationId)
 if(existing){
  if(!sameCommand(existing,record))throw new Error('El commandId ya fue usado con contenido diferente.')
  return Object.freeze({duplicate:true,record:Object.freeze({...existing}),organizationId,siteId:record.siteId,commandId:cmd})
 }
 return Object.freeze({duplicate:false,record,organizationId,siteId:record.siteId,commandId:cmd})
}

export function applyPreparedPlantEvent(state,prepared){
 const existing=existingCommand(state,prepared.commandId,prepared.organizationId)
 if(existing){
  if(!sameCommand(existing,prepared.record))throw new Error('Colisión de idempotencia al aplicar el evento de planta.')
  return state
 }
 const active=activeOrganizationId(state)
 if(active!==prepared.organizationId)throw new Error('La empresa activa cambió antes de confirmar el evento de planta.')
 const plant=findIrrigationMirfeRecord(state,'plantPositions',prepared.record.plantId,{label:'planta productiva',organizationId:prepared.organizationId})
 const location=plantLocation(state,plant,prepared.organizationId),siteId=location.site?.id||plant.siteId||''
 if(!hasPermission(state,'record_observations',{companyId:prepared.organizationId,siteId}))throw new Error('El permiso sobre la sede de la planta cambió antes de confirmar el evento.')
 return{...state,plantEvents:[...list(state?.plantEvents),prepared.record]}
}

function eventSpec(prepared,phase){
 const requested=phase==='requested'
 return{
  name:requested?DomainEvents.PLANT_EVENT_REQUESTED:DomainEvents.PLANT_EVENT_RECORDED,
  aggregateType:'cultivation.plant',aggregateId:prepared.record.plantId,
  organizationId:prepared.organizationId,siteId:prepared.siteId,
  eventId:`${prepared.commandId}:${phase}`,
  occurredAt:prepared.record.date,
  correlationId:prepared.commandId,
  causationId:requested?null:`${prepared.commandId}:requested`,
  payload:{commandId:prepared.commandId,type:prepared.record.type,title:prepared.record.title,detail:prepared.record.detail},
  metadata:{source:'m1.1-plant-event-command'}
 }
}

export async function executePlantEventCommand(state,input,{publishEvent,commit}={}){
 if(typeof publishEvent!=='function')throw new TypeError('publishEvent es obligatorio.')
 if(typeof commit!=='function')throw new TypeError('commit es obligatorio.')
 const prepared=preparePlantEventCommand(state,input)
 if(!prepared.duplicate){
  await publishEvent(eventSpec(prepared,'requested'))
  commit(current=>applyPreparedPlantEvent(current,prepared),{module:'Planta',action:'Evento agregado',detail:prepared.record.title})
 }
 await publishEvent(eventSpec(prepared,'recorded'))
 return Object.freeze({ok:true,duplicate:prepared.duplicate,record:prepared.record})
}
