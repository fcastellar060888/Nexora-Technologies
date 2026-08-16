import{MEASUREMENT_SOURCES}from'./irrigationMirfe.js'
import{activeOrganizationId,explicitOrganizationId}from'./organizationOwnership.js'

const text=value=>String(value??'').trim()
const list=value=>Array.isArray(value)?value:[]
const plainObject=value=>value&&typeof value==='object'&&!Array.isArray(value)
const required=(value,label)=>{const normalized=text(value);if(!normalized)throw new Error(`${label} es obligatorio.`);return normalized}
const iso=(value,label)=>{const normalized=required(value,label),time=Date.parse(normalized);if(Number.isNaN(time))throw new Error(`${label} debe ser una fecha válida.`);return new Date(time).toISOString()}
const enumValue=(value,values,label)=>{const normalized=required(value,label);if(!Object.values(values).includes(normalized))throw new Error(`${label} no pertenece al catálogo canónico.`);return normalized}
const finite=(value,label)=>{const number=Number(value);if(!Number.isFinite(number))throw new Error(`${label} debe ser un número finito.`);return number}

function deepFreeze(value){
 if(!value||typeof value!=='object'||Object.isFrozen(value))return value
 Object.values(value).forEach(deepFreeze)
 return Object.freeze(value)
}

function unique(values,label){
 const normalized=list(values).map(value=>required(value,label))
 if(new Set(normalized).size!==normalized.length)throw new Error(`${label} contiene duplicados.`)
 return normalized
}

function scope(input={}){
 return{
  organizationId:required(input.organizationId,'organizationId'),
  siteId:required(input.siteId,'siteId'),
  elementId:required(input.elementId,'elementId')
 }
}

function assertSameScope(reference,expected,label){
 if(!reference)throw new Error(`${label} es obligatorio.`)
 for(const key of['organizationId','siteId','elementId'])if(reference[key]!==expected[key])throw new Error(`${label} no pertenece al mismo ámbito ambiental.`)
 return reference
}

export{MEASUREMENT_SOURCES}

export const ENVIRONMENT_DEVICE_KINDS=Object.freeze({SENSOR:'SENSOR',CONTROLLER:'CONTROLLER'})
export const ENVIRONMENT_DEVICE_STATUSES=Object.freeze({ACTIVE:'ACTIVE',INACTIVE:'INACTIVE',RETIRED:'RETIRED'})
export const CALIBRATION_RESULTS=Object.freeze({PASS:'PASS',FAIL:'FAIL'})
export const ENVIRONMENT_ALERT_DIRECTIONS=Object.freeze({LOW:'LOW',HIGH:'HIGH'})
export const ENVIRONMENT_ALERT_SEVERITIES=Object.freeze({INFO:'INFO',WARNING:'WARNING',CRITICAL:'CRITICAL'})
export const ENVIRONMENT_COLLECTIONS=Object.freeze(['environmentDevices','environmentCalibrations','environmentSetpoints','environmentalReadings','environmentAlerts'])

export const ENVIRONMENT_VARIABLES=deepFreeze({
 temperature:{unit:'°C',minimum:-100,maximum:100},
 humidity:{unit:'%',minimum:0,maximum:100},
 co2:{unit:'ppm',minimum:0,maximum:100000},
 vpd:{unit:'kPa',minimum:0,maximum:20},
 dewPoint:{unit:'°C',minimum:-100,maximum:100},
 light:{unit:'µmol/m²/s',minimum:0,maximum:10000},
 substrateMoisture:{unit:'%',minimum:0,maximum:100},
 substrateTemperature:{unit:'°C',minimum:-100,maximum:100},
 flow:{unit:'L/min',minimum:0,maximum:100000},
 pressure:{unit:'bar',minimum:0,maximum:1000},
 drainage:{unit:'%',minimum:0,maximum:100}
})

function variableNames(values,label='variables'){
 const names=unique(values,label)
 if(!names.length)throw new Error(`${label} requiere al menos una variable.`)
 for(const name of names)if(!ENVIRONMENT_VARIABLES[name])throw new Error(`${label}.${name} no pertenece al catálogo ambiental.`)
 return names
}

function normalizeValues(input,label='values'){
 if(!plainObject(input)||Object.keys(input).length===0)throw new Error(`${label} requiere al menos una medición.`)
 const values={}
 for(const[name,raw]of Object.entries(input)){
  const definition=ENVIRONMENT_VARIABLES[name]
  if(!definition)throw new Error(`${label}.${name} no pertenece al catálogo ambiental.`)
  const number=finite(raw,`${label}.${name}`)
  if(number<definition.minimum||number>definition.maximum)throw new Error(`${label}.${name} está fuera del rango físico admitido.`)
  values[name]=number
 }
 return values
}

function normalizeUnits(values,input={}){
 if(input!==undefined&&!plainObject(input))throw new Error('units debe ser un objeto.')
 const units={}
 for(const name of Object.keys(values)){
  const canonical=ENVIRONMENT_VARIABLES[name].unit,declared=text(input?.[name])
  if(declared&&declared!==canonical)throw new Error(`La unidad de ${name} debe ser ${canonical}.`)
  units[name]=canonical
 }
 return units
}

function normalizeTargets(input){
 if(!plainObject(input)||Object.keys(input).length===0)throw new Error('targets requiere al menos una variable.')
 const targets={}
 for(const[name,raw]of Object.entries(input)){
  const definition=ENVIRONMENT_VARIABLES[name]
  if(!definition)throw new Error(`targets.${name} no pertenece al catálogo ambiental.`)
  if(!plainObject(raw))throw new Error(`targets.${name} debe ser un objeto.`)
  const hasMinimum=raw.minimum!==''&&raw.minimum!==null&&raw.minimum!==undefined
  const hasMaximum=raw.maximum!==''&&raw.maximum!==null&&raw.maximum!==undefined
  const hasDesired=raw.desired!==''&&raw.desired!==null&&raw.desired!==undefined
  if(!hasMinimum&&!hasMaximum)throw new Error(`targets.${name} requiere minimum o maximum.`)
  const minimum=hasMinimum?finite(raw.minimum,`targets.${name}.minimum`):null
  const maximum=hasMaximum?finite(raw.maximum,`targets.${name}.maximum`):null
  const desired=hasDesired?finite(raw.desired,`targets.${name}.desired`):null
  if(minimum!==null&&(minimum<definition.minimum||minimum>definition.maximum))throw new Error(`targets.${name}.minimum está fuera del rango físico admitido.`)
  if(maximum!==null&&(maximum<definition.minimum||maximum>definition.maximum))throw new Error(`targets.${name}.maximum está fuera del rango físico admitido.`)
  if(minimum!==null&&maximum!==null&&minimum>maximum)throw new Error(`targets.${name}.minimum no puede superar maximum.`)
  if(desired!==null&&((minimum!==null&&desired<minimum)||(maximum!==null&&desired>maximum)))throw new Error(`targets.${name}.desired debe estar dentro del intervalo.`)
  const unit=text(raw.unit)||definition.unit
  if(unit!==definition.unit)throw new Error(`La unidad objetivo de ${name} debe ser ${definition.unit}.`)
  targets[name]={minimum,maximum,desired,unit,severity:enumValue(raw.severity||ENVIRONMENT_ALERT_SEVERITIES.WARNING,ENVIRONMENT_ALERT_SEVERITIES,`targets.${name}.severity`)}
 }
 return targets
}

export function createEnvironmentDevice(input={}){
 const location=scope(input),kind=enumValue(input.kind,ENVIRONMENT_DEVICE_KINDS,'kind')
 return deepFreeze({
  id:required(input.id,'id'),...location,
  code:required(input.code||input.id,'code'),name:required(input.name,'name'),kind,
  status:enumValue(input.status||ENVIRONMENT_DEVICE_STATUSES.ACTIVE,ENVIRONMENT_DEVICE_STATUSES,'status'),
  variables:variableNames(input.variables),externalId:text(input.externalId),
  installedAt:input.installedAt?iso(input.installedAt,'installedAt'):null,
  createdAt:iso(input.createdAt||new Date().toISOString(),'createdAt'),
  integration:plainObject(input.integration)?{...input.integration}:{},metadata:plainObject(input.metadata)?{...input.metadata}:{}
 })
}

export function createEnvironmentCalibration(input={},device){
 const location=scope(input);assertSameScope(device,location,'El dispositivo')
 if(device.status!==ENVIRONMENT_DEVICE_STATUSES.ACTIVE)throw new Error('El dispositivo debe estar activo para registrar calibración.')
 const performedAt=iso(input.performedAt,'performedAt'),validUntil=input.validUntil?iso(input.validUntil,'validUntil'):null
 if(validUntil&&Date.parse(validUntil)<=Date.parse(performedAt))throw new Error('validUntil debe ser posterior a performedAt.')
 const variables=variableNames(input.variables?.length?input.variables:device.variables)
 for(const variable of variables)if(!device.variables.includes(variable))throw new Error(`La calibración incluye ${variable}, que el dispositivo no mide.`)
 return deepFreeze({
  id:required(input.id,'id'),...location,deviceId:device.id,
  result:enumValue(input.result,CALIBRATION_RESULTS,'result'),variables,performedAt,validUntil,
  methodId:required(input.methodId,'methodId'),certificateId:text(input.certificateId),
  performedBy:required(input.performedBy,'performedBy'),notes:text(input.notes)
 })
}

export function calibrationEffectiveAt(calibration,{device,variables,at}={}){
 if(!calibration||!device)return false
 if(calibration.organizationId!==device.organizationId||calibration.siteId!==device.siteId||calibration.elementId!==device.elementId||calibration.deviceId!==device.id)return false
 if(calibration.result!==CALIBRATION_RESULTS.PASS)return false
 const instant=Date.parse(at),performed=Date.parse(calibration.performedAt),validUntil=calibration.validUntil?Date.parse(calibration.validUntil):Infinity
 if(Number.isNaN(instant)||Number.isNaN(performed)||instant<performed||instant>validUntil)return false
 return variableNames(variables).every(variable=>calibration.variables.includes(variable))
}

export function effectiveEnvironmentCalibration(records,{organizationId,siteId,elementId,device,variables,at,calibrationId=''}={}){
 const identity=text(calibrationId),candidates=list(records).filter(item=>item.organizationId===organizationId&&item.siteId===siteId&&item.elementId===elementId&&item.deviceId===device?.id)
 if(identity){
  const matches=candidates.filter(item=>item.id===identity)
  if(matches.length!==1)throw new Error(matches.length?'La calibración tiene identidad duplicada.':'La calibración no existe en la empresa activa.')
  if(!calibrationEffectiveAt(matches[0],{device,variables,at}))throw new Error('La calibración no está aprobada, vigente o no cubre las variables medidas.')
  return matches[0]
 }
 return candidates.filter(item=>calibrationEffectiveAt(item,{device,variables,at})).sort((left,right)=>Date.parse(right.performedAt)-Date.parse(left.performedAt)||right.id.localeCompare(left.id))[0]||null
}

export function createEnvironmentSetpointVersion(input={},previous=null){
 const location=scope(input),id=required(input.id,'id'),setpointKey=required(input.setpointKey||previous?.setpointKey||`${location.siteId}:${location.elementId}:environment`,'setpointKey')
 if(previous){
  assertSameScope(previous,location,'El setpoint anterior')
  if(previous.setpointKey!==setpointKey)throw new Error('El setpoint anterior pertenece a otro lineage.')
 }
 const effectiveFrom=iso(input.effectiveFrom||input.createdAt||new Date().toISOString(),'effectiveFrom'),effectiveUntil=input.effectiveUntil?iso(input.effectiveUntil,'effectiveUntil'):null
 if(effectiveUntil&&Date.parse(effectiveUntil)<=Date.parse(effectiveFrom))throw new Error('effectiveUntil debe ser posterior a effectiveFrom.')
 if(previous&&Date.parse(effectiveFrom)<Date.parse(previous.effectiveFrom))throw new Error('Una nueva versión no puede iniciar antes que la anterior.')
 return deepFreeze({
  id,...location,setpointKey,version:previous?Number(previous.version||1)+1:1,
  supersedesSetpointId:previous?.id||'',targets:normalizeTargets(input.targets),
  effectiveFrom,effectiveUntil,createdAt:iso(input.createdAt||effectiveFrom,'createdAt'),
  createdBy:required(input.createdBy,'createdBy'),notes:text(input.notes)
 })
}

export function currentEnvironmentSetpoint(records,{organizationId,siteId,elementId,at,setpointKey=''}={}){
 const instant=Date.parse(at)
 if(Number.isNaN(instant))throw new Error('at debe ser una fecha válida.')
 const scoped=list(records).filter(item=>item.organizationId===organizationId&&item.siteId===siteId&&item.elementId===elementId)
 const ids=new Set(),versions=new Set()
 for(const item of scoped){
  if(ids.has(item.id))throw new Error('El setpoint tiene identidad duplicada en la empresa activa.')
  ids.add(item.id)
  const versionKey=`${item.setpointKey}:${Number(item.version||1)}`
  if(versions.has(versionKey))throw new Error('El lineage ambiental contiene una versión duplicada.')
  versions.add(versionKey)
 }
 const active=scoped.filter(item=>(!setpointKey||item.setpointKey===setpointKey)&&Date.parse(item.effectiveFrom)<=instant&&(!item.effectiveUntil||Date.parse(item.effectiveUntil)>=instant))
 const lineages=new Set(active.map(item=>item.setpointKey))
 if(!setpointKey&&lineages.size>1)throw new Error('Existe más de un setpoint vigente; setpointKey es obligatorio.')
 return active.sort((left,right)=>Number(right.version||1)-Number(left.version||1)||Date.parse(right.effectiveFrom)-Date.parse(left.effectiveFrom)||right.id.localeCompare(left.id))[0]||null
}

function sourceEvidence(source,input={},fallbackActorId=''){
 const evidence=plainObject(input)?{...input}:{}
 if(source===MEASUREMENT_SOURCES.MANUAL)evidence.actorId=required(evidence.actorId||fallbackActorId,'sourceEvidence.actorId')
 if(source===MEASUREMENT_SOURCES.SAMPLE)evidence.sampleId=required(evidence.sampleId,'sourceEvidence.sampleId')
 if(source===MEASUREMENT_SOURCES.IMPORTED)evidence.importId=required(evidence.importId,'sourceEvidence.importId')
 if(source===MEASUREMENT_SOURCES.CALCULATED){
  evidence.methodId=required(evidence.methodId,'sourceEvidence.methodId')
  evidence.inputReadingIds=unique(evidence.inputReadingIds,'sourceEvidence.inputReadingIds')
  if(!evidence.inputReadingIds.length)throw new Error('sourceEvidence.inputReadingIds requiere al menos una lectura causal.')
 }
 return evidence
}

export function createEnvironmentalReading(input={},references={}){
 const location=scope(input),recordedAt=iso(input.recordedAt,'recordedAt'),values=normalizeValues(input.values),units=normalizeUnits(values,input.units),source=enumValue(input.source,MEASUREMENT_SOURCES,'source')
 const variables=Object.keys(values),device=references.device||null,calibration=references.calibration||null,setpoint=references.setpoint||null
 const deviceSource=source===MEASUREMENT_SOURCES.SENSOR||source===MEASUREMENT_SOURCES.CONTROLLER
 if(deviceSource){
  assertSameScope(device,location,'El dispositivo')
  if(device.kind!==source)throw new Error('La fuente no coincide con el tipo de dispositivo.')
  if(device.status!==ENVIRONMENT_DEVICE_STATUSES.ACTIVE)throw new Error('El dispositivo de medición no está activo.')
  if(!variables.every(variable=>device.variables.includes(variable)))throw new Error('El dispositivo no declara todas las variables medidas.')
  if(!calibrationEffectiveAt(calibration,{device,variables,at:recordedAt}))throw new Error('La lectura requiere una calibración aprobada, vigente y compatible.')
 }else if(device||calibration||text(input.deviceId)||text(input.calibrationId))throw new Error('Solo SENSOR o CONTROLLER pueden declarar dispositivo y calibración.')
 if(setpoint){
  assertSameScope(setpoint,location,'El setpoint')
  if(Date.parse(setpoint.effectiveFrom)>Date.parse(recordedAt)||(setpoint.effectiveUntil&&Date.parse(setpoint.effectiveUntil)<Date.parse(recordedAt)))throw new Error('El setpoint no estaba vigente al registrar la lectura.')
 }
 return deepFreeze({
  id:required(input.id,'id'),...location,recordedAt,source,
  deviceId:device?.id||'',calibrationId:calibration?.id||'',setpointId:setpoint?.id||'',
  values,units,sourceEvidence:sourceEvidence(source,input.sourceEvidence,references.actorId),notes:text(input.notes)
 })
}

export function deriveEnvironmentAlerts(reading,setpoint){
 if(!setpoint)return Object.freeze([])
 assertSameScope(setpoint,reading,'El setpoint')
 if(reading.setpointId!==setpoint.id)throw new Error('La lectura no referencia el setpoint evaluado.')
 const alerts=[]
 for(const[variable,value]of Object.entries(reading.values)){
  const target=setpoint.targets[variable]
  if(!target)continue
  const direction=target.minimum!==null&&value<target.minimum?ENVIRONMENT_ALERT_DIRECTIONS.LOW:target.maximum!==null&&value>target.maximum?ENVIRONMENT_ALERT_DIRECTIONS.HIGH:''
  if(!direction)continue
  alerts.push(deepFreeze({
   id:`${reading.id}:alert:${variable}:${direction}`,
   organizationId:reading.organizationId,siteId:reading.siteId,elementId:reading.elementId,
   readingId:reading.id,setpointId:setpoint.id,variable,direction,severity:target.severity,
   observedValue:value,unit:reading.units[variable],status:'OPEN',triggeredAt:reading.recordedAt
  }))
 }
 return Object.freeze(alerts)
}

function ownerCandidatesForSite(state,siteId){
 return[...new Set(list(state?.sites).filter(item=>item.id===siteId).map(explicitOrganizationId).filter(Boolean))]
}

function ownerCandidatesForArea(state,areaId){
 const owners=[]
 for(const area of list(state?.operationalAreas).filter(item=>item.id===areaId)){
  const explicit=explicitOrganizationId(area)
  if(explicit)owners.push(explicit)
  else owners.push(...ownerCandidatesForSite(state,area.siteId))
 }
 return[...new Set(owners.filter(Boolean))]
}

function ownerCandidatesForElement(state,elementId){
 const owners=[]
 for(const element of list(state?.infrastructureElements).filter(item=>item.id===elementId)){
  const explicit=explicitOrganizationId(element)
  if(explicit)owners.push(explicit)
  else if(element.siteId)owners.push(...ownerCandidatesForSite(state,element.siteId))
  else owners.push(...ownerCandidatesForArea(state,element.areaId))
 }
 return[...new Set(owners.filter(Boolean))]
}

export function environmentRecordOrganizationId(state,record){
 const explicit=explicitOrganizationId(record)
 if(explicit)return explicit
 const candidates=[]
 if(record?.siteId)candidates.push(...ownerCandidatesForSite(state,record.siteId))
 if(record?.elementId)candidates.push(...ownerCandidatesForElement(state,record.elementId))
 if(record?.areaId)candidates.push(...ownerCandidatesForArea(state,record.areaId))
 if(record?.assetId){
  for(const asset of list(state?.infrastructureAssets).filter(item=>item.id===record.assetId)){
   const owner=environmentRecordOrganizationId(state,asset)
   if(owner)candidates.push(owner)
  }
 }
 const owners=[...new Set(candidates.filter(Boolean))]
 return owners.length===1?owners[0]:''
}

function belongs(state,record,organizationId){
 if(/^UNRESOLVED_|^INVALID_/.test(text(record?.migrationStatus)))return false
 const owner=environmentRecordOrganizationId(state,record)
 if(owner)return owner===organizationId
 return organizationId==='local-installation'&&list(state?.companies).length===0
}

export function scopeEnvironmentState(state,organizationId=activeOrganizationId(state)){
 const scoped={...state}
 for(const collection of['sites','operationalAreas','infrastructureElements','infrastructureAssets','assetMaintenances',...ENVIRONMENT_COLLECTIONS])scoped[collection]=list(state?.[collection]).filter(record=>belongs(state,record,organizationId))
 return scoped
}

export function mergeEnvironmentState(state,tenantState,organizationId=activeOrganizationId(state)){
 const next={...state}
 for(const collection of ENVIRONMENT_COLLECTIONS){
  const foreign=list(state?.[collection]).filter(record=>environmentRecordOrganizationId(state,record)!==organizationId)
  next[collection]=[...foreign,...list(tenantState?.[collection])]
 }
 return next
}

export function mutateEnvironmentState(state,mutation,organizationId=activeOrganizationId(state)){
 if(typeof mutation!=='function')throw new TypeError('mutation debe ser una función.')
 return mergeEnvironmentState(state,mutation(scopeEnvironmentState(state,organizationId)),organizationId)
}

function legacyTarget(reading){
 const target={}
 const add=(variable,minimum,maximum)=>{
  const min=minimum===''||minimum==null?null:Number(minimum),max=maximum===''||maximum==null?null:Number(maximum)
  if(Number.isFinite(min)||Number.isFinite(max))target[variable]={minimum:Number.isFinite(min)?min:null,maximum:Number.isFinite(max)?max:null,severity:ENVIRONMENT_ALERT_SEVERITIES.WARNING}
 }
 add('temperature',reading.targetTempMin,reading.targetTempMax)
 add('humidity',reading.targetHumidityMin,reading.targetHumidityMax)
 return target
}

function deterministicId(value){
 let hash=2166136261
 for(const character of value){hash^=character.charCodeAt(0);hash=Math.imul(hash,16777619)}
 return(hash>>>0).toString(16).padStart(8,'0')
}

function legacyRecordedAt(reading){
 const value=reading.recordedAt||reading.createdAt||reading.date
 return Number.isNaN(Date.parse(value))?'1970-01-01T00:00:00.000Z':new Date(value).toISOString()
}

export function migrateLegacyEnvironmentState(input={}){
 const state={...input}
 for(const collection of ENVIRONMENT_COLLECTIONS)state[collection]=list(state[collection])
 const generatedSetpoints=[],generatedAlerts=[],lineages=new Map(),validSetpoints=new Set()
 const canonicalSource=reading=>Object.values(MEASUREMENT_SOURCES).includes(reading?.source)
 const legacy=list(state.environmentalReadings).filter(reading=>!plainObject(reading.values)||!canonicalSource(reading)||Object.keys(legacyTarget(reading)).length)
 for(const reading of legacy){
  const targets=legacyTarget(reading)
  if(!Object.keys(targets).length)continue
  const organizationId=environmentRecordOrganizationId(state,reading),siteId=text(reading.siteId),elementId=text(reading.elementId),setpointKey=`${siteId}:${elementId}:legacy-environment`
  const targetSignature=JSON.stringify(targets),lineageKey=`${organizationId}|${siteId}|${elementId}|${setpointKey}`
  if(!lineages.has(lineageKey))lineages.set(lineageKey,new Map())
  const versions=lineages.get(lineageKey)
  if(!versions.has(targetSignature))versions.set(targetSignature,{organizationId,siteId,elementId,setpointKey,targets,firstAt:legacyRecordedAt(reading),readings:[]})
  const group=versions.get(targetSignature);group.readings.push(reading)
  if(legacyRecordedAt(reading)<group.firstAt)group.firstAt=legacyRecordedAt(reading)
 }
 const setpointByReading=new Map()
 for(const versions of lineages.values()){
  let previous=null
  for(const group of[...versions.values()].sort((left,right)=>left.firstAt.localeCompare(right.firstAt)||JSON.stringify(left.targets).localeCompare(JSON.stringify(right.targets)))){
   const id=`legacy-environment-setpoint:${deterministicId(`${group.organizationId}|${group.siteId}|${group.elementId}|${JSON.stringify(group.targets)}`)}`
   let record
   try{
    const targets=normalizeTargets(group.targets)
    record=group.organizationId?createEnvironmentSetpointVersion({id,organizationId:group.organizationId,siteId:group.siteId,elementId:group.elementId,setpointKey:group.setpointKey,targets,effectiveFrom:group.firstAt,createdAt:group.firstAt,createdBy:'state-migration-v12',notes:'Importado desde targets embebidos en lecturas legacy.'},previous):deepFreeze({id,organizationId:'',siteId:group.siteId,elementId:group.elementId,setpointKey:group.setpointKey,version:previous?Number(previous.version||1)+1:1,supersedesSetpointId:previous?.id||'',targets,effectiveFrom:group.firstAt,effectiveUntil:null,createdAt:group.firstAt,createdBy:'state-migration-v12',notes:'Ownership legacy no resuelto.',migrationStatus:'UNRESOLVED_OWNERSHIP'})
    if(group.organizationId)validSetpoints.add(id)
   }catch(error){
    record=deepFreeze({id,organizationId:group.organizationId,siteId:group.siteId,elementId:group.elementId,setpointKey:group.setpointKey,version:previous?Number(previous.version||1)+1:1,supersedesSetpointId:previous?.id||'',targets:group.targets,effectiveFrom:group.firstAt,effectiveUntil:null,createdAt:group.firstAt,createdBy:'state-migration-v12',notes:'Evidencia target legacy en cuarentena.',migrationStatus:group.organizationId?'INVALID_TARGET_EVIDENCE':'UNRESOLVED_OWNERSHIP',migrationError:text(error?.message)})
   }
   generatedSetpoints.push(record);previous=record
   for(const reading of group.readings)setpointByReading.set(reading,record)
  }
 }
 const canonicalReadings=list(state.environmentalReadings).map(reading=>{
  if(plainObject(reading.values)&&canonicalSource(reading)&&!Object.keys(legacyTarget(reading)).length)return reading
  const{
   temperature,humidity,co2,targetTempMin,targetTempMax,targetHumidityMin,targetHumidityMax,
   ...rest
  }=reading
  const values={...(plainObject(reading.values)?reading.values:{})}
  for(const[name,value]of Object.entries({temperature,humidity,co2}))if(value!==''&&value!==null&&value!==undefined&&Number.isFinite(Number(value)))values[name]=Number(value)
  const organizationId=environmentRecordOrganizationId(state,reading),setpoint=setpointByReading.get(reading)||null,recordedAt=legacyRecordedAt(reading)
  let canonicalValues,validValues=true,migrationError=''
  try{canonicalValues=normalizeValues(values)}catch(error){canonicalValues=values;validValues=false;migrationError=text(error?.message)}
  let units
  try{units=normalizeUnits(canonicalValues)}catch{units=plainObject(reading.units)?{...reading.units}:{}}
  const migrationStatus=!organizationId?'UNRESOLVED_OWNERSHIP':validValues?'MIGRATED':'INVALID_READING_EVIDENCE'
  const migrated={...rest,organizationId,recordedAt,source:MEASUREMENT_SOURCES.IMPORTED,deviceId:'',calibrationId:'',setpointId:setpoint?.id||'',values:canonicalValues,units,sourceEvidence:{importId:'state-migration-v12',originalSource:text(reading.source)||'UNKNOWN'},migrationStatus,...(migrationError?{migrationError}:{})}
  const frozen=deepFreeze(migrated)
  if(setpoint&&organizationId&&validValues&&validSetpoints.has(setpoint.id))generatedAlerts.push(...deriveEnvironmentAlerts(frozen,setpoint))
  return frozen
 })
 const existingSetpointIds=new Set(state.environmentSetpoints.map(item=>`${explicitOrganizationId(item)}:${item.id}`)),existingAlertIds=new Set(state.environmentAlerts.map(item=>`${explicitOrganizationId(item)}:${item.id}`))
 state.environmentSetpoints=[...state.environmentSetpoints,...generatedSetpoints.filter(item=>!existingSetpointIds.has(`${explicitOrganizationId(item)}:${item.id}`))]
 state.environmentAlerts=[...state.environmentAlerts,...generatedAlerts.filter(item=>!existingAlertIds.has(`${explicitOrganizationId(item)}:${item.id}`))]
 state.environmentalReadings=canonicalReadings
 return state
}
