import{DomainEvents}from'../core/events/eventCatalog.js'
import{
 CALIBRATION_RESULTS,ENVIRONMENT_COLLECTIONS,ENVIRONMENT_DEVICE_KINDS,
 MEASUREMENT_SOURCES,createEnvironmentCalibration,createEnvironmentDevice,
 createEnvironmentalReading,createEnvironmentSetpointVersion,currentEnvironmentSetpoint,
 deriveEnvironmentAlerts,effectiveEnvironmentCalibration,mutateEnvironmentState,scopeEnvironmentState
}from'../domain/environment.js'
import{activeOrganizationId,explicitOrganizationId}from'../domain/organizationOwnership.js'
import{activeUser,hasPermission}from'./permissions.js'
import{executeCoreOperationCommand}from'./coreOperationCommand.js'

export const ENVIRONMENT_OPERATIONS=Object.freeze({
 REGISTER_DEVICE:'REGISTER_DEVICE',
 RECORD_CALIBRATION:'RECORD_CALIBRATION',
 CREATE_SETPOINT:'CREATE_SETPOINT',
 RECORD_READING:'RECORD_READING'
})

const text=value=>String(value??'').trim()
const list=value=>Array.isArray(value)?value:[]
const plainObject=value=>value&&typeof value==='object'&&!Array.isArray(value)
const required=(value,label)=>{const normalized=text(value);if(!normalized)throw new Error(`${label} es obligatorio.`);return normalized}

function canonical(value){
 if(Array.isArray(value))return value.map(canonical)
 if(plainObject(value))return Object.fromEntries(Object.keys(value).sort().filter(key=>value[key]!==undefined).map(key=>[key,canonical(value[key])]))
 return value
}

const stable=value=>JSON.stringify(canonical(value))

export function environmentCommandRequestKey({operation,entityId='',input={}}={}){
 return stable({operation:text(operation),entityId:text(entityId),input:plainObject(input)?input:{}})
}

export function environmentCommandSignature({operation,aggregateId,input={}}={}){
 return stable({operation:text(operation),aggregateId:text(aggregateId),input:plainObject(input)?input:{}})
}

function knownOperation(operation){return Object.values(ENVIRONMENT_OPERATIONS).includes(operation)}

function authorize(state,organizationId,siteId){
 if(!hasPermission(state,'manage_settings',{companyId:organizationId,siteId}))throw new Error('No tienes permiso manage_settings para operar la autoridad ambiental.')
}

function receipts(record){return list(record?.commandReceipts).filter(item=>plainObject(item)&&text(item.commandId))}

function findReceipt(state,organizationId,commandId){
 const tenant=scopeEnvironmentState(state,organizationId),matches=[]
 for(const collection of ENVIRONMENT_COLLECTIONS)for(const record of list(tenant?.[collection]))for(const receipt of receipts(record))if(receipt.commandId===commandId)matches.push({collection,record,receipt})
 if(matches.length>1&&new Set(matches.map(item=>item.receipt.signature)).size>1)throw new Error('El commandId colisiona con recibos ambientales diferentes.')
 return matches[0]||null
}

function assertReceipt(receipt,signature){
 if(receipt&&receipt.signature!==signature)throw new Error('El commandId ambiental ya fue usado con contenido diferente.')
}

function appendReceipt(state,organizationId,collection,id,receipt){
 return mutateEnvironmentState(state,tenant=>{
  const records=list(tenant?.[collection]),matches=records.filter(record=>record.id===id)
  if(matches.length!==1)throw new Error(`No se pudo asociar el recibo ambiental a ${collection}/${id}.`)
  return{...tenant,[collection]:records.map(record=>record.id===id?{...record,commandReceipts:[...receipts(record),receipt]}:record)}
 },organizationId)
}

function appendEntries(state,organizationId,entries){
 return mutateEnvironmentState(state,tenant=>{
  const next={...tenant}
  for(const{collection,record}of entries){
   const records=list(next[collection])
   if(records.some(item=>item.id===record.id))throw new Error(`${collection} ya contiene ese id en la empresa activa.`)
   next[collection]=[...records,record]
  }
  return next
 },organizationId)
}

function applyOnce(current,organizationId,receipt,plan){
 if(activeOrganizationId(current)!==organizationId)throw new Error('La empresa activa cambió antes de confirmar la operación ambiental.')
 const existing=findReceipt(current,organizationId,receipt.commandId)
 if(existing){assertReceipt(existing.receipt,receipt.signature);return current}
 return appendReceipt(appendEntries(current,organizationId,plan.entries),organizationId,plan.collection,plan.aggregateId,receipt)
}

function one(records,id,label){
 const matches=list(records).filter(item=>item.id===id)
 if(matches.length!==1)throw new Error(matches.length?`${label} tiene identidad duplicada en la empresa activa.`:`${label} no existe en la empresa activa.`)
 return matches[0]
}

function location(state,organizationId,input){
 const tenant=scopeEnvironmentState(state,organizationId),siteId=required(input.siteId,'siteId'),elementId=required(input.elementId,'elementId')
 one(tenant.sites,siteId,'La sede ambiental')
 const element=one(tenant.infrastructureElements,elementId,'La zona ambiental')
 const area=list(tenant.operationalAreas).filter(item=>item.id===element.areaId)
 const elementSiteId=text(element.siteId||area.length===1&&area[0].siteId)
 if(elementSiteId&&elementSiteId!==siteId)throw new Error('La zona ambiental no pertenece a la sede seleccionada.')
 if(area.length>1&&!element.siteId)throw new Error('La zona ambiental tiene una ubicación ambigua.')
 return{tenant,siteId,elementId,element}
}

function planDevice(state,input,aggregateId,organizationId,occurredAt){
 const{siteId,elementId}=location(state,organizationId,input)
 const record=createEnvironmentDevice({...input,id:aggregateId,organizationId,siteId,elementId,createdAt:occurredAt})
 return{
  aggregateType:'environment.device',aggregateId,eventName:DomainEvents.ENVIRONMENT_DEVICE_REGISTERED,siteId,collection:'environmentDevices',
  eventPayload:{deviceId:record.id,siteId,elementId,kind:record.kind,variables:record.variables,status:record.status},
  entries:[{collection:'environmentDevices',record}]
 }
}

function planCalibration(state,input,aggregateId,organizationId,occurredAt){
 const tenant=scopeEnvironmentState(state,organizationId),deviceId=required(input.deviceId,'deviceId'),device=one(tenant.environmentDevices,deviceId,'El dispositivo ambiental')
 if(text(input.siteId)&&input.siteId!==device.siteId)throw new Error('La calibración declara otra sede.')
 if(text(input.elementId)&&input.elementId!==device.elementId)throw new Error('La calibración declara otra zona ambiental.')
 const performedBy=input.performedBy||activeUser(state)?.id||'system'
 const record=createEnvironmentCalibration({...input,id:aggregateId,organizationId,siteId:device.siteId,elementId:device.elementId,performedAt:input.performedAt||occurredAt,performedBy},device)
 return{
  aggregateType:'environment.calibration',aggregateId,eventName:DomainEvents.ENVIRONMENT_CALIBRATION_RECORDED,siteId:device.siteId,collection:'environmentCalibrations',
  eventPayload:{calibrationId:record.id,deviceId,siteId:record.siteId,elementId:record.elementId,result:record.result,variables:record.variables,performedAt:record.performedAt,validUntil:record.validUntil},
  entries:[{collection:'environmentCalibrations',record}]
 }
}

function previousSetpoint(tenant,input,{siteId,elementId,setpointKey}){
 const previousId=text(input.supersedesSetpointId)
 if(previousId)return one(tenant.environmentSetpoints,previousId,'El setpoint anterior')
 const candidates=list(tenant.environmentSetpoints).filter(item=>item.siteId===siteId&&item.elementId===elementId&&item.setpointKey===setpointKey)
 const versions=candidates.map(item=>Number(item.version||1))
 if(new Set(versions).size!==versions.length)throw new Error('El lineage ambiental contiene una versión duplicada.')
 return candidates.sort((left,right)=>Number(right.version||1)-Number(left.version||1)||Date.parse(right.effectiveFrom)-Date.parse(left.effectiveFrom))[0]||null
}

function planSetpoint(state,input,aggregateId,organizationId,occurredAt){
 const{tenant,siteId,elementId}=location(state,organizationId,input),setpointKey=required(input.setpointKey||`${siteId}:${elementId}:environment`,'setpointKey'),previous=previousSetpoint(tenant,input,{siteId,elementId,setpointKey})
 const actorId=required(input.createdBy||activeUser(state)?.id||'system','createdBy')
 const record=createEnvironmentSetpointVersion({...input,id:aggregateId,organizationId,siteId,elementId,setpointKey,createdAt:occurredAt,createdBy:actorId},previous)
 return{
  aggregateType:'environment.setpoint',aggregateId,eventName:DomainEvents.ENVIRONMENT_SETPOINT_CREATED,siteId,collection:'environmentSetpoints',
  eventPayload:{setpointId:record.id,setpointKey:record.setpointKey,version:record.version,supersedesSetpointId:record.supersedesSetpointId,siteId,elementId,effectiveFrom:record.effectiveFrom,targetVariables:Object.keys(record.targets)},
  entries:[{collection:'environmentSetpoints',record}]
 }
}

function calculatedInputs(tenant,input,{siteId,elementId,recordedAt}){
 if(input.source!==MEASUREMENT_SOURCES.CALCULATED)return
 for(const id of list(input.sourceEvidence?.inputReadingIds)){
  const source=one(tenant.environmentalReadings,id,'La lectura causal')
  if(source.siteId!==siteId||source.elementId!==elementId)throw new Error('La lectura calculada referencia otra zona ambiental.')
  if(Date.parse(source.recordedAt)>Date.parse(recordedAt))throw new Error('La lectura calculada no puede depender de evidencia futura.')
 }
}

function planReading(state,input,aggregateId,organizationId,occurredAt){
 const normalized={...input,source:input.source||MEASUREMENT_SOURCES.MANUAL},recordedAt=input.recordedAt||occurredAt
 const{tenant,siteId,elementId}=location(state,organizationId,normalized),variables=Object.keys(plainObject(normalized.values)?normalized.values:{})
 calculatedInputs(tenant,normalized,{siteId,elementId,recordedAt:normalized.recordedAt})
 const deviceSource=normalized.source===MEASUREMENT_SOURCES.SENSOR||normalized.source===MEASUREMENT_SOURCES.CONTROLLER
 let device=null,calibration=null
 if(deviceSource){
  device=one(tenant.environmentDevices,required(normalized.deviceId,'deviceId'),'El dispositivo ambiental')
  calibration=effectiveEnvironmentCalibration(tenant.environmentCalibrations,{organizationId,siteId,elementId,device,variables,at:normalized.recordedAt,calibrationId:normalized.calibrationId})
  if(!calibration)throw new Error('No existe una calibración aprobada, vigente y compatible para el dispositivo.')
 }
 let setpoint=null
 if(text(normalized.setpointId))setpoint=one(tenant.environmentSetpoints,normalized.setpointId,'El setpoint ambiental')
 else setpoint=currentEnvironmentSetpoint(tenant.environmentSetpoints,{organizationId,siteId,elementId,at:normalized.recordedAt,setpointKey:text(normalized.setpointKey)})
 const actorId=activeUser(state)?.id||'system'
 const record=createEnvironmentalReading({...normalized,id:aggregateId,organizationId,siteId,elementId,deviceId:device?.id,calibrationId:calibration?.id,setpointId:setpoint?.id},{device,calibration,setpoint,actorId})
 const alerts=deriveEnvironmentAlerts(record,setpoint)
 return{
  aggregateType:'environment.reading',aggregateId,eventName:DomainEvents.ENVIRONMENT_READING_RECORDED,siteId,collection:'environmentalReadings',
  eventPayload:{readingId:record.id,siteId,elementId,source:record.source,deviceId:record.deviceId,calibrationId:record.calibrationId,setpointId:record.setpointId,variables:Object.keys(record.values),values:record.values,alertIds:alerts.map(item=>item.id),alertCount:alerts.length},
  entries:[{collection:'environmentalReadings',record},...alerts.map(alert=>({collection:'environmentAlerts',record:alert}))]
 }
}

function buildPlan(state,operation,input,aggregateId,organizationId,occurredAt){
 if(operation===ENVIRONMENT_OPERATIONS.REGISTER_DEVICE)return planDevice(state,input,aggregateId,organizationId,occurredAt)
 if(operation===ENVIRONMENT_OPERATIONS.RECORD_CALIBRATION)return planCalibration(state,input,aggregateId,organizationId,occurredAt)
 if(operation===ENVIRONMENT_OPERATIONS.CREATE_SETPOINT)return planSetpoint(state,input,aggregateId,organizationId,occurredAt)
 if(operation===ENVIRONMENT_OPERATIONS.RECORD_READING)return planReading(state,input,aggregateId,organizationId,occurredAt)
 throw new Error('Operación ambiental no soportada.')
}

export async function executeEnvironmentCommand(state,{operation,input={},entityId='',commandId,occurredAt}={},deps={}){
 const normalizedOperation=required(operation,'operation'),normalizedCommandId=required(commandId,'commandId')
 if(!knownOperation(normalizedOperation))throw new Error('Operación ambiental no soportada.')
 if(!plainObject(input))throw new Error('input debe ser un objeto.')
 const organizationId=activeOrganizationId(state),declaredOwner=explicitOrganizationId(input)
 if(declaredOwner&&declaredOwner!==organizationId)throw new Error('La operación ambiental declara otra empresa.')
 const aggregateId=required(entityId||input.id||normalizedCommandId,'aggregateId')
 const signature=environmentCommandSignature({operation:normalizedOperation,aggregateId,input}),existing=findReceipt(state,organizationId,normalizedCommandId)
 assertReceipt(existing?.receipt,signature)
 const initialSiteId=text(existing?.receipt?.siteId||input.siteId||state.currentContext?.siteId)
 authorize(state,organizationId,initialSiteId)
 const effectiveOccurredAt=existing?.receipt?.occurredAt||occurredAt||new Date().toISOString()
 if(Number.isNaN(Date.parse(effectiveOccurredAt)))throw new Error('occurredAt no es válido.')
 const plan=existing?{
  aggregateType:existing.receipt.aggregateType,aggregateId:existing.receipt.aggregateId,eventName:existing.receipt.eventName,siteId:existing.receipt.siteId,eventPayload:existing.receipt.eventPayload,collection:existing.collection,entries:[]
 }:buildPlan(state,normalizedOperation,input,aggregateId,organizationId,effectiveOccurredAt)
 authorize(state,organizationId,plan.siteId)
 const receipt=existing?.receipt||Object.freeze({commandId:normalizedCommandId,signature,operation:normalizedOperation,occurredAt:effectiveOccurredAt,aggregateType:plan.aggregateType,aggregateId:plan.aggregateId,eventName:plan.eventName,siteId:plan.siteId,eventPayload:plan.eventPayload})
 const publishEvent=deps.publishEvent,commit=deps.commit
 if(typeof publishEvent!=='function')throw new TypeError('publishEvent es obligatorio para ejecutar comandos ambientales.')
 if(typeof commit!=='function')throw new TypeError('commit es obligatorio para ejecutar comandos ambientales.')
 const apply=existing?current=>{
  if(activeOrganizationId(current)!==organizationId)throw new Error('La empresa activa cambió antes de confirmar la operación ambiental.')
  return current
 }:current=>applyOnce(current,organizationId,receipt,plan)
 await executeCoreOperationCommand({commandId:normalizedCommandId,organizationId,siteId:plan.siteId,aggregateType:plan.aggregateType,aggregateId:plan.aggregateId,completedEventName:plan.eventName,occurredAt:effectiveOccurredAt,payload:plan.eventPayload,metadata:{module:'environment',operation:normalizedOperation},apply},{publishEvent,commit})
 return Object.freeze({ok:true,replay:Boolean(existing),commandId:normalizedCommandId,aggregateId:plan.aggregateId,eventName:plan.eventName})
}

export{CALIBRATION_RESULTS,ENVIRONMENT_DEVICE_KINDS,MEASUREMENT_SOURCES}
