import test from'node:test'
import assert from'node:assert/strict'
import{readFile}from'node:fs/promises'
import{DomainEvents}from'../src/core/events/eventCatalog.js'
import{MEASUREMENT_SOURCES}from'../src/domain/environment.js'
import{ENVIRONMENT_OPERATIONS,executeEnvironmentCommand}from'../src/services/environmentCommand.js'
import{applyRemoteRecords,collectionChanges,enqueueChanges,SYNCABLE_COLLECTIONS}from'../src/services/syncEngine.js'

const EVENT_NAME_PATTERN=/^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*){2,}$/

const fixture=()=>({
 companies:[{id:'org-a'},{id:'org-b'}],currentContext:{companyId:'org-a',siteId:'site-shared'},
 users:[{id:'user-1',name:'Ana',activeSession:true,active:true,remote:true}],
 roles:[{id:'administrator',permissions:['manage_settings']}],
 memberships:[{id:'membership-1',userId:'user-1',companyId:'org-a',roleId:'administrator',siteIds:['site-shared'],status:'active'}],
 sites:[{id:'site-shared',organizationId:'org-b',name:'B'},{id:'site-shared',organizationId:'org-a',name:'A'}],
 operationalAreas:[{id:'area-shared',organizationId:'org-b',siteId:'site-shared'},{id:'area-shared',organizationId:'org-a',siteId:'site-shared'}],
 infrastructureElements:[{id:'room-shared',organizationId:'org-b',siteId:'site-shared',areaId:'area-shared',type:'room'},{id:'room-shared',organizationId:'org-a',siteId:'site-shared',areaId:'area-shared',type:'room'}],
 infrastructureAssets:[],assetMaintenances:[],environmentDevices:[],environmentCalibrations:[],environmentSetpoints:[],environmentalReadings:[],environmentAlerts:[]
})

async function run(initial,command){
 let state=initial;const events=[]
 const result=await executeEnvironmentCommand(state,command,{publishEvent:async event=>events.push(event),commit:recipe=>{state=recipe(state)}})
 return{state,events,result}
}

const deviceCommand={operation:ENVIRONMENT_OPERATIONS.REGISTER_DEVICE,entityId:'device-shared',commandId:'environment-device',occurredAt:'2026-08-16T08:00:00.000Z',input:{siteId:'site-shared',elementId:'room-shared',kind:'SENSOR',code:'ENV-01',name:'Sensor activo',variables:['temperature','humidity','co2']}}
const calibrationCommand={operation:ENVIRONMENT_OPERATIONS.RECORD_CALIBRATION,entityId:'calibration-shared',commandId:'environment-calibration',occurredAt:'2026-08-16T08:30:00.000Z',input:{deviceId:'device-shared',performedAt:'2026-08-16T08:30:00.000Z',validUntil:'2026-09-16T08:30:00.000Z',result:'PASS',methodId:'method-1',certificateId:'certificate-1'}}
const setpointCommand={operation:ENVIRONMENT_OPERATIONS.CREATE_SETPOINT,entityId:'setpoint-shared',commandId:'environment-setpoint',occurredAt:'2026-08-16T09:00:00.000Z',input:{siteId:'site-shared',elementId:'room-shared',setpointKey:'site-shared:room-shared:climate',effectiveFrom:'2026-08-16T09:00:00.000Z',targets:{temperature:{minimum:20,maximum:28},humidity:{minimum:50,maximum:70},co2:{maximum:1200}}}}
const readingCommand={operation:ENVIRONMENT_OPERATIONS.RECORD_READING,entityId:'reading-shared',commandId:'environment-reading',occurredAt:'2026-08-16T10:00:00.000Z',input:{siteId:'site-shared',elementId:'room-shared',recordedAt:'2026-08-16T10:00:00.000Z',source:MEASUREMENT_SOURCES.SENSOR,deviceId:'device-shared',setpointKey:'site-shared:room-shared:climate',values:{temperature:31,humidity:40,co2:900}}}

async function authorityState(initial=fixture()){
 let output=await run(initial,deviceCommand)
 output=await run(output.state,calibrationCommand)
 output=await run(output.state,setpointCommand)
 return output.state
}

test('M31-F009: commands crean autoridad completa, recibos y eventos causales tenant-aware',async()=>{
 const foreignDevice={id:'device-shared',organizationId:'org-b',siteId:'site-shared',elementId:'room-shared',kind:'SENSOR',name:'Sensor extranjero',variables:['temperature'],status:'ACTIVE'}
 let state={...fixture(),environmentDevices:[foreignDevice]},events=[]
 const deps={publishEvent:async event=>events.push(event),commit:recipe=>{state=recipe(state)}}
 for(const command of[deviceCommand,calibrationCommand,setpointCommand,readingCommand])await executeEnvironmentCommand(state,command,deps)
 const activeDevice=state.environmentDevices.find(item=>item.organizationId==='org-a'),reading=state.environmentalReadings.find(item=>item.organizationId==='org-a')
 assert.equal(state.environmentDevices.find(item=>item.organizationId==='org-b').name,'Sensor extranjero')
 assert.equal(activeDevice.commandReceipts[0].commandId,'environment-device')
 assert.equal(state.environmentCalibrations[0].commandReceipts[0].commandId,'environment-calibration')
 assert.equal(state.environmentSetpoints[0].commandReceipts[0].commandId,'environment-setpoint')
 assert.equal(reading.commandReceipts[0].commandId,'environment-reading')
 assert.equal(reading.deviceId,'device-shared')
 assert.equal(reading.calibrationId,'calibration-shared')
 assert.equal(reading.setpointId,'setpoint-shared')
 assert.deepEqual(state.environmentAlerts.filter(item=>item.organizationId==='org-a').map(item=>item.variable),['temperature','humidity'])
 assert.deepEqual(events.map(event=>event.name),[
  DomainEvents.CORE_OPERATION_REQUESTED,DomainEvents.ENVIRONMENT_DEVICE_REGISTERED,
  DomainEvents.CORE_OPERATION_REQUESTED,DomainEvents.ENVIRONMENT_CALIBRATION_RECORDED,
  DomainEvents.CORE_OPERATION_REQUESTED,DomainEvents.ENVIRONMENT_SETPOINT_CREATED,
  DomainEvents.CORE_OPERATION_REQUESTED,DomainEvents.ENVIRONMENT_READING_RECORDED
 ])
 assert.equal(events.at(-1).correlationId,'environment-reading')
 assert.equal(events.at(-1).causationId,'environment-reading:requested')
 assert.equal(events.at(-1).payload.alertCount,2)
})

test('M31-F009: replay no duplica lectura/alertas y una colisión falla antes de eventos',async()=>{
 let state=await authorityState(),events=[]
 const deps={publishEvent:async event=>events.push(event),commit:recipe=>{state=recipe(state)}}
 await executeEnvironmentCommand(state,readingCommand,deps)
 const replay=await executeEnvironmentCommand(state,readingCommand,deps)
 assert.equal(replay.replay,true)
 assert.equal(state.environmentalReadings.filter(item=>item.organizationId==='org-a').length,1)
 assert.equal(state.environmentAlerts.filter(item=>item.organizationId==='org-a').length,2)
 const before=events.length
 await assert.rejects(()=>executeEnvironmentCommand(state,{...readingCommand,input:{...readingCommand.input,values:{temperature:24}}},deps),/contenido diferente/)
 assert.equal(events.length,before)
})

test('M31-F009: permisos y referencias extranjeras fallan antes de publicar o mutar',async()=>{
 const denied=fixture();denied.roles=[{id:'administrator',permissions:[]}]
 for(const candidate of[
  {state:denied,command:deviceCommand,error:/permiso/},
  {state:{...fixture(),environmentDevices:[{id:'device-shared',organizationId:'org-b',siteId:'site-shared',elementId:'room-shared',kind:'SENSOR',variables:['temperature'],status:'ACTIVE'}]},command:calibrationCommand,error:/no existe/},
  {state:fixture(),command:{...deviceCommand,input:{...deviceCommand.input,organizationId:'org-b'}},error:/otra empresa/},
  {state:{...fixture(),sites:[{id:'site-shared',organizationId:'org-b'}]},command:deviceCommand,error:/sede ambiental no existe/}
 ]){
  let publishes=0,commits=0
  await assert.rejects(()=>executeEnvironmentCommand(candidate.state,candidate.command,{publishEvent:async()=>{publishes+=1},commit:()=>{commits+=1}}),candidate.error)
  assert.equal(publishes,0);assert.equal(commits,0)
 }
})

test('M31-F009: calibración vencida/FAIL, tipo contradictorio e identidad duplicada fallan cerrado',async()=>{
 let state=(await run(fixture(),deviceCommand)).state
 const fail=(await run(state,{...calibrationCommand,entityId:'calibration-fail',commandId:'calibration-fail',input:{...calibrationCommand.input,result:'FAIL'}})).state
 let publishes=0,commits=0
 await assert.rejects(()=>executeEnvironmentCommand(fail,readingCommand,{publishEvent:async()=>{publishes+=1},commit:()=>{commits+=1}}),/No existe una calibración/)
 assert.equal(publishes,0);assert.equal(commits,0)
 state=(await run(state,{...calibrationCommand,input:{...calibrationCommand.input,validUntil:'2026-08-16T09:00:00.000Z'}})).state
 await assert.rejects(()=>executeEnvironmentCommand(state,readingCommand,{publishEvent:async()=>{},commit:()=>{}}),/No existe una calibración/)
 const controller={...state.environmentDevices.find(item=>item.organizationId==='org-a'),kind:'CONTROLLER'}
 await assert.rejects(()=>executeEnvironmentCommand({...state,environmentDevices:[...state.environmentDevices,controller]},readingCommand,{publishEvent:async()=>{},commit:()=>{}}),/identidad duplicada/)
})

test('M31-F009: cambio de empresa entre intent y commit no produce completion ni efectos',async()=>{
 const state=await authorityState();let current=state;const events=[]
 await assert.rejects(()=>executeEnvironmentCommand(current,readingCommand,{publishEvent:async event=>events.push(event),commit:recipe=>{current={...current,currentContext:{...current.currentContext,companyId:'org-b'}};current=recipe(current)}}),/empresa activa cambió/)
 assert.deepEqual(events.map(event=>event.name),[DomainEvents.CORE_OPERATION_REQUESTED])
 assert.equal(current.environmentalReadings.length,0)
 assert.equal(current.environmentAlerts.length,0)
})

test('M31-F009: MANUAL/MUESTRA/IMPORTADO/CALCULADO conservan evidencia y causalidad local',async()=>{
 let state=await authorityState()
 const commands=[
  {id:'manual',source:MEASUREMENT_SOURCES.MANUAL,sourceEvidence:{}},
  {id:'sample',source:MEASUREMENT_SOURCES.SAMPLE,sourceEvidence:{sampleId:'sample-1'}},
  {id:'imported',source:MEASUREMENT_SOURCES.IMPORTED,sourceEvidence:{importId:'import-1'}}
 ]
 for(const item of commands){
  state=(await run(state,{operation:ENVIRONMENT_OPERATIONS.RECORD_READING,entityId:item.id,commandId:`command-${item.id}`,occurredAt:'2026-08-16T10:00:00.000Z',input:{siteId:'site-shared',elementId:'room-shared',recordedAt:'2026-08-16T10:00:00.000Z',source:item.source,sourceEvidence:item.sourceEvidence,setpointKey:'site-shared:room-shared:climate',values:{temperature:24}}})).state
 }
 state=(await run(state,{operation:ENVIRONMENT_OPERATIONS.RECORD_READING,entityId:'calculated',commandId:'command-calculated',occurredAt:'2026-08-16T11:00:00.000Z',input:{siteId:'site-shared',elementId:'room-shared',recordedAt:'2026-08-16T11:00:00.000Z',source:MEASUREMENT_SOURCES.CALCULATED,sourceEvidence:{methodId:'average-1',inputReadingIds:['manual','sample']},setpointKey:'site-shared:room-shared:climate',values:{temperature:24}}})).state
 assert.equal(state.environmentalReadings.find(item=>item.id==='manual').sourceEvidence.actorId,'user-1')
 assert.equal(state.environmentalReadings.find(item=>item.id==='sample').sourceEvidence.sampleId,'sample-1')
 assert.equal(state.environmentalReadings.find(item=>item.id==='imported').sourceEvidence.importId,'import-1')
 assert.deepEqual(state.environmentalReadings.find(item=>item.id==='calculated').sourceEvidence.inputReadingIds,['manual','sample'])
 await assert.rejects(()=>run(state,{operation:ENVIRONMENT_OPERATIONS.RECORD_READING,entityId:'future-calculation',commandId:'future-calculation',input:{siteId:'site-shared',elementId:'room-shared',recordedAt:'2026-08-16T09:00:00.000Z',source:MEASUREMENT_SOURCES.CALCULATED,sourceEvidence:{methodId:'average-1',inputReadingIds:['manual']},values:{temperature:24}}}),/evidencia futura/)
})

test('M31-F009: nuevas colecciones persisten/sincronizan y conservan homónimos extranjeros',async()=>{
 let state=await authorityState();state=(await run(state,readingCommand)).state
 const collections=['environmentDevices','environmentCalibrations','environmentSetpoints','environmentalReadings','environmentAlerts']
 for(const collection of collections)assert.ok(SYNCABLE_COLLECTIONS.includes(collection),collection)
 const active=Object.fromEntries(collections.map(collection=>[collection,state[collection].filter(item=>item.organizationId==='org-a')]))
 const empty=Object.fromEntries(collections.map(collection=>[collection,[]])),changes=collectionChanges(empty,active,collections)
 assert.equal(changes.length,6)
 const queued=enqueueChanges({syncQueue:[]},changes,{companyId:'org-a',userId:'user-1',deviceId:'browser-1'})
 assert.equal(queued.syncQueue.length,6)
 assert.ok(queued.syncQueue.every(item=>item.payload._organizationId==='org-a'))
 const foreign=Object.fromEntries(collections.map(collection=>[collection,active[collection].map(item=>({...item,organizationId:'org-b',_organizationId:'org-b'}))]))
 const rows=changes.map((change,index)=>({companyId:'org-a',collection:change.collection,recordId:change.recordId,payload:change.payload,version:index+1,updatedAt:'2026-08-16T12:00:00.000Z'}))
 const hydrated=applyRemoteRecords({currentContext:{companyId:'org-a'},...foreign},rows,{companyId:'org-a'})
 for(const collection of collections)assert.equal(hydrated[collection].length,active[collection].length*2,collection)
 assert.equal(hydrated.environmentalReadings.find(item=>item.organizationId==='org-a').calibrationId,'calibration-shared')
 assert.equal(hydrated.environmentAlerts.find(item=>item.organizationId==='org-b')._organizationId,'org-b')
})

test('M31-F009: UI usa command boundary y expone fuente, dispositivos, calibración, versiones y alertas',async()=>{
 const page=await readFile(new URL('../src/pages/InfrastructureOperationsPage.jsx',import.meta.url),'utf8')
 const panel=await readFile(new URL('../src/components/EnvironmentMeasurementsPanel.jsx',import.meta.url),'utf8')
 const store=await readFile(new URL('../src/services/environmentCommandStore.js',import.meta.url),'utf8')
 assert.match(page,/useEnvironmentCommandStore/)
 assert.match(page,/EnvironmentMeasurementsPanel/)
 assert.doesNotMatch(page,/targetTempMin|targetHumidityMax|outOfRange/)
 assert.doesNotMatch(page,/environmentalReadings:\s*\[/)
 assert.match(panel,/MEASUREMENT_SOURCES/)
 assert.match(panel,/ENVIRONMENT_OPERATIONS\.REGISTER_DEVICE/)
 assert.match(panel,/ENVIRONMENT_OPERATIONS\.RECORD_CALIBRATION/)
 assert.match(panel,/ENVIRONMENT_OPERATIONS\.CREATE_SETPOINT/)
 assert.match(panel,/ENVIRONMENT_OPERATIONS\.RECORD_READING/)
 assert.match(panel,/Alertas ambientales canónicas/)
 assert.match(panel,/Historial de setpoints/)
 assert.match(store,/publishDomainEvent/)
})

test('M31-F009: eventos ambientales cumplen dominio.entidad.acción',()=>{
 for(const[name,value]of Object.entries(DomainEvents).filter(([name])=>name.startsWith('ENVIRONMENT_')))assert.match(value,EVENT_NAME_PATTERN,name)
})
