import{activeUser,hasPermission}from'./permissions.js'
import{DomainEvents}from'../core/events/eventCatalog.js'

const text=value=>String(value??'').trim()
const list=value=>Array.isArray(value)?value:[]
const ownerOf=value=>text(value?.organizationId||value?.companyId||value?._organizationId)
const ALLOWED_TYPES=new Set(['Observación','MIPE','MIRFE','Riego','Producción','Trasplante','Cosecha'])

function activeOrganizationId(state){
 const active=text(state?.currentContext?.companyId)
 if(active)return active
 const companies=list(state?.companies)
 if(companies.length===1)return text(companies[0]?.id)
 if(companies.length===0)return'local-installation'
 throw new Error('Selecciona una empresa antes de registrar eventos de planta.')
}

function plantLocation(state,plant){
 const bed=list(state?.beds).find(item=>item?.id===plant?.bedId)||null
 const house=list(state?.houses).find(item=>item?.id===(plant?.houseId||bed?.houseId))||null
 const site=list(state?.sites).find(item=>item?.id===(plant?.siteId||house?.siteId))||null
 const organizationId=ownerOf(plant)||ownerOf(bed)||ownerOf(house)||ownerOf(site)
 return{bed,house,site,organizationId}
}

function normalizedDate(value){
 const raw=text(value)
 if(!raw||Number.isNaN(Date.parse(raw)))throw new Error('La fecha del evento de planta no es válida.')
 return new Date(raw).toISOString()
}

function sameCommand(existing,record){
 return existing.plantId===record.plantId&&existing.organizationId===record.organizationId&&existing.type===record.type&&existing.title===record.title&&text(existing.detail)===text(record.detail)&&new Date(existing.date).toISOString()===record.date
}

export function preparePlantEventCommand(state,{plantId,commandId,type='Observación',title,detail='',date=new Date().toISOString()}={}){
 if(!hasPermission(state,'record_observations'))throw new Error('No tienes permiso para registrar observaciones de planta.')
 const id=text(plantId),cmd=text(commandId)
 if(!id)throw new Error('La planta es obligatoria.')
 if(!cmd)throw new Error('El commandId es obligatorio para garantizar idempotencia.')
 const plant=list(state?.plantPositions).find(item=>item?.id===id)
 if(!plant)throw new Error('No se encontró la planta productiva solicitada.')
 const organizationId=activeOrganizationId(state),location=plantLocation(state,plant)
 if(location.organizationId&&location.organizationId!==organizationId)throw new Error('La planta pertenece a otra empresa.')
 if(!location.organizationId&&list(state?.companies).length>1)throw new Error('No se puede demostrar el ownership organizacional de la planta.')
 const normalizedType=text(type)
 if(!ALLOWED_TYPES.has(normalizedType))throw new Error('El tipo de evento de planta no es válido.')
 const normalizedTitle=text(title)
 if(!normalizedTitle)throw new Error('El título del evento de planta es obligatorio.')
 const occurredAt=normalizedDate(date),actor=activeUser(state)
 const record=Object.freeze({id:cmd,commandId:cmd,plantId:id,organizationId,siteId:location.site?.id||plant.siteId||null,actorId:actor?.remoteId||actor?.id||'system',type:normalizedType,title:normalizedTitle,detail:text(detail),date:occurredAt})
 const existing=list(state?.plantEvents).find(item=>item?.commandId===cmd||item?.id===cmd)
 if(existing){
  if(!sameCommand(existing,record))throw new Error('El commandId ya fue usado con contenido diferente.')
  return Object.freeze({duplicate:true,record:Object.freeze({...existing}),organizationId,siteId:record.siteId,commandId:cmd})
 }
 return Object.freeze({duplicate:false,record,organizationId,siteId:record.siteId,commandId:cmd})
}

export function applyPreparedPlantEvent(state,prepared){
 const existing=list(state?.plantEvents).find(item=>item?.commandId===prepared.commandId||item?.id===prepared.commandId)
 if(existing){
  if(!sameCommand(existing,prepared.record))throw new Error('Colisión de idempotencia al aplicar el evento de planta.')
  return state
 }
 const active=activeOrganizationId(state)
 if(active!==prepared.organizationId)throw new Error('La empresa activa cambió antes de confirmar el evento de planta.')
 const plant=list(state?.plantPositions).find(item=>item?.id===prepared.record.plantId)
 if(!plant)throw new Error('La planta dejó de estar disponible antes de confirmar el evento.')
 const location=plantLocation(state,plant)
 if(location.organizationId&&location.organizationId!==prepared.organizationId)throw new Error('La planta cambió de ownership antes de confirmar el evento.')
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
