import test from'node:test'
import assert from'node:assert/strict'
import{
 createDrainageMeasurement,createIrrigationAssignment,createIrrigationEmitter,createIrrigationMeasurement,createIrrigationPulse,createIrrigationSector,
 IRRIGATION_EMITTER_KINDS,IRRIGATION_PULSE_STATUSES,IRRIGATION_TARGET_TYPES,MEASUREMENT_SOURCES
}from'../src/domain/irrigationMirfe.js'
import{CANONICAL_IRRIGATION_COLLECTIONS}from'../src/domain/irrigationMirfeTenancy.js'
import{initialState}from'../src/services/storage.js'
import{CURRENT_SCHEMA_VERSION,migrateState}from'../src/services/stateMigration.js'
import{applyRemoteRecords,collectionChanges,enqueueChanges,SYNCABLE_COLLECTIONS}from'../src/services/syncEngine.js'
import{readLightweightCache,writeLightweightCache}from'../src/services/lightweightCache.js'
import{hydrateAuthoritativeState,operationalCollections,overlayConcurrentChanges}from'../src/services/remoteBootstrap.js'

const ACTIVE='org-a',FOREIGN='org-b',SITE='site-shared',AT='2026-08-16T12:00:00.000Z'

class MemoryStorage{
 constructor(){this.values=new Map()}
 getItem(key){return this.values.has(key)?this.values.get(key):null}
 setItem(key,value){this.values.set(key,String(value))}
 removeItem(key){this.values.delete(key)}
}

function records(organizationId,label){
 const emitter=createIrrigationEmitter({id:'emitter-shared',organizationId,siteId:SITE,name:`Emitter ${label}`,kind:IRRIGATION_EMITTER_KINDS.RING,flowLitersPerHour:4,outletCount:2,stakesPerPlant:1,plantsPerEmitter:2,metadata:{tenant:label}})
 const sector=createIrrigationSector({id:'sector-shared',organizationId,siteId:SITE,name:`Sector ${label}`,metadata:{tenant:label}})
 const assignment=createIrrigationAssignment({id:'assignment-shared',organizationId,siteId:SITE,sectorId:sector.id,emitterId:emitter.id,targetType:IRRIGATION_TARGET_TYPES.POSITION,targetId:'position-shared',emitterCount:1,plantsServed:2,validFrom:AT})
 const pulse=createIrrigationPulse({id:'pulse-shared',organizationId,siteId:SITE,sectorId:sector.id,source:MEASUREMENT_SOURCES.CONTROLLER,status:IRRIGATION_PULSE_STATUSES.COMPLETED,startedAt:AT,completedAt:'2026-08-16T12:05:00.000Z',durationSeconds:300,plannedVolumeLiters:10,actualVolumeLiters:9.8,deviceId:`controller-${label}`})
 const measurement=createIrrigationMeasurement({id:'measurement-shared',organizationId,siteId:SITE,sectorId:sector.id,pulseId:pulse.id,measuredAt:'2026-08-16T12:05:00.000Z',source:MEASUREMENT_SOURCES.SENSOR,deviceId:`sensor-${label}`,values:{pressureBar:1.7,flowLitersPerMinute:2.1},units:{pressureBar:'bar',flowLitersPerMinute:'L/min'},notes:`Evidence ${label}`})
 const drainage=createDrainageMeasurement({id:'drainage-shared',organizationId,siteId:SITE,sectorId:sector.id,pulseId:pulse.id,measuredAt:'2026-08-16T12:20:00.000Z',source:MEASUREMENT_SOURCES.SAMPLE,appliedVolumeLiters:9.8,drainedVolumeLiters:1.96,inputEc:1.8,drainEc:2.2,inputPh:5.8,drainPh:6.1})
 return{irrigationEmitters:[emitter],irrigationSectors:[sector],irrigationAssignments:[assignment],irrigationPulses:[pulse],irrigationMeasurements:[measurement],drainageMeasurements:[drainage]}
}

function twoTenantState(companyId=ACTIVE){
 const active=records(ACTIVE,'A'),foreign=records(FOREIGN,'B'),state={
  companies:[{id:ACTIVE},{id:FOREIGN}],currentContext:{companyId},
  sites:[{id:SITE,organizationId:ACTIVE},{id:SITE,organizationId:FOREIGN}]
 }
 for(const collection of CANONICAL_IRRIGATION_COLLECTIONS)state[collection]=[...active[collection],...foreign[collection]]
 return migrateState(state)
}

function remoteRows(source=records(ACTIVE,'REMOTE')){
 return CANONICAL_IRRIGATION_COLLECTIONS.map(collection=>({
  organization_id:ACTIVE,collection,record_id:source[collection][0].id,
  payload:{...source[collection][0],remoteEvidence:{source:'postgres',nested:{verified:true}}},
  version:7,updated_at:'2026-08-16T13:00:00.000Z',deleted_at:null
 }))
}

test('M31-F011: schema v14 e initialState incorporan las seis colecciones canónicas',()=>{
 const fresh=migrateState({})
 assert.equal(CURRENT_SCHEMA_VERSION,14)
 assert.deepEqual(CANONICAL_IRRIGATION_COLLECTIONS,[
  'irrigationEmitters','irrigationSectors','irrigationAssignments','irrigationPulses','irrigationMeasurements','drainageMeasurements'
 ])
 for(const collection of CANONICAL_IRRIGATION_COLLECTIONS){
  assert.deepEqual(initialState[collection],[],`initialState:${collection}`)
  assert.deepEqual(fresh[collection],[],`migrateState:${collection}`)
  assert.ok(operationalCollections(fresh).includes(collection),`bootstrap:${collection}`)
  assert.ok(SYNCABLE_COLLECTIONS.includes(collection),`sync:${collection}`)
 }
})

test('M31-F011: el backfill causal asigna ownership y deja ambigüedad multiempresa fail-closed',()=>{
 const migrated=migrateState({
  companies:[{id:ACTIVE},{id:FOREIGN}],currentContext:{companyId:ACTIVE},
  sites:[{id:'site-a',organizationId:ACTIVE},{id:SITE,organizationId:ACTIVE},{id:SITE,organizationId:FOREIGN}],
  irrigationEmitters:[{id:'legacy-emitter',siteId:'site-a'},{id:'ambiguous-emitter',siteId:SITE}],
  irrigationSectors:[{id:'legacy-sector',siteId:'site-a'}],
  irrigationAssignments:[{id:'legacy-assignment',siteId:'site-a',sectorId:'legacy-sector',emitterId:'legacy-emitter'}],
  irrigationPulses:[{id:'legacy-pulse',siteId:'site-a',sectorId:'legacy-sector'}],
  irrigationMeasurements:[{id:'legacy-measurement',siteId:'site-a',sectorId:'legacy-sector',pulseId:'legacy-pulse'}],
  drainageMeasurements:[{id:'legacy-drainage',siteId:'site-a',sectorId:'legacy-sector',pulseId:'legacy-pulse'}]
 })
 for(const collection of CANONICAL_IRRIGATION_COLLECTIONS){
  const owned=migrated[collection].find(record=>record.id.startsWith('legacy-'))
  assert.equal(owned.organizationId,ACTIVE,collection)
 }
 assert.equal(migrated.irrigationEmitters.find(record=>record.id==='ambiguous-emitter').organizationId,undefined)
})

test('M31-F011: la caché offline conserva evidencia anidada y particiona IDs repetidos',()=>{
 const storage=new MemoryStorage(),active=twoTenantState(ACTIVE)
 writeLightweightCache(active,storage)
 const restoredActive=readLightweightCache(storage)
 for(const collection of CANONICAL_IRRIGATION_COLLECTIONS){
  assert.equal(restoredActive[collection].length,1,collection)
  assert.equal(restoredActive[collection][0].organizationId,ACTIVE,collection)
 }
 assert.deepEqual(restoredActive.irrigationMeasurements[0].values,{pressureBar:1.7,flowLitersPerMinute:2.1})
 assert.deepEqual(restoredActive.irrigationEmitters[0].metadata,{tenant:'A'})

 const foreign={...active,currentContext:{...active.currentContext,companyId:FOREIGN}}
 writeLightweightCache(foreign,storage)
 const restoredForeign=readLightweightCache(storage)
 for(const collection of CANONICAL_IRRIGATION_COLLECTIONS){
  assert.equal(restoredForeign[collection].length,1,collection)
  assert.equal(restoredForeign[collection][0].organizationId,FOREIGN,collection)
 }
 assert.equal(restoredForeign.irrigationMeasurements[0].notes,'Evidence B')
})

test('M31-F011: cambios locales de las seis colecciones generan cola tenant-aware',()=>{
 const before=twoTenantState(),after={...before}
 for(const collection of CANONICAL_IRRIGATION_COLLECTIONS)after[collection]=before[collection].map(record=>record.organizationId===ACTIVE?{...record,localRevision:2}:record)
 const changes=collectionChanges(before,after)
 assert.deepEqual(changes.map(change=>change.collection),CANONICAL_IRRIGATION_COLLECTIONS)
 assert.ok(changes.every(change=>change.organizationId===ACTIVE&&change.previousPayload?.organizationId===ACTIVE))
 const queued=enqueueChanges({...after,syncQueue:[]},changes,{companyId:ACTIVE,userId:'user-a',deviceId:'device-a'})
 assert.equal(queued.syncQueue.length,6)
 assert.ok(queued.syncQueue.every(entry=>entry.companyId===ACTIVE&&entry.payload.organizationId===ACTIVE&&entry.payload._organizationId===ACTIVE))
 assert.ok(queued.syncQueue.every(entry=>entry.payload.localRevision===2))
})

test('M31-F011: pull remoto actualiza y elimina solo la identidad compuesta del tenant activo',()=>{
 const initial=twoTenantState()
 const mapped=remoteRows().map(row=>({companyId:row.organization_id,collection:row.collection,recordId:row.record_id,payload:row.payload,version:row.version,updatedAt:row.updated_at,deletedAt:row.deleted_at}))
 const updated=applyRemoteRecords(initial,mapped,{companyId:ACTIVE})
 for(const collection of CANONICAL_IRRIGATION_COLLECTIONS){
  assert.equal(updated[collection].length,2,collection)
  assert.equal(updated[collection].find(record=>record.organizationId===ACTIVE).remoteEvidence.nested.verified,true,collection)
  assert.equal(updated[collection].find(record=>record.organizationId===FOREIGN).remoteEvidence,undefined,collection)
 }
 const deleted=applyRemoteRecords(updated,mapped.map(row=>({...row,payload:null,deletedAt:'2026-08-16T14:00:00.000Z'})),{companyId:ACTIVE})
 for(const collection of CANONICAL_IRRIGATION_COLLECTIONS){
  assert.equal(deleted[collection].length,1,collection)
  assert.equal(deleted[collection][0].organizationId,FOREIGN,collection)
 }
})

test('M31-F011: sync rechaza filas y payloads de otra empresa antes de hidratar',()=>{
 const state=twoTenantState()
 assert.throws(()=>applyRemoteRecords(state,[{companyId:FOREIGN,collection:'irrigationEmitters',recordId:'x',payload:{organizationId:FOREIGN}}],{companyId:ACTIVE}),/otra empresa/)
 assert.throws(()=>applyRemoteRecords(state,[{companyId:ACTIVE,collection:'irrigationEmitters',recordId:'x',payload:{organizationId:FOREIGN}}],{companyId:ACTIVE}),/payload perteneciente a otra empresa/)
})

test('M31-F011: bootstrap autoritativo reemplaza A y preserva los seis homónimos de B',()=>{
 const local=twoTenantState(),hydrated=hydrateAuthoritativeState(local,remoteRows(),{companyId:ACTIVE,initialState:local,hydratedAt:'2026-08-16T13:01:00.000Z'})
 for(const collection of CANONICAL_IRRIGATION_COLLECTIONS){
  assert.equal(hydrated[collection].length,2,collection)
  assert.equal(hydrated[collection].find(record=>record.organizationId===ACTIVE).remoteEvidence.source,'postgres',collection)
  assert.equal(hydrated[collection].find(record=>record.organizationId===FOREIGN).remoteEvidence,undefined,collection)
 }
 assert.equal(hydrated.syncMeta.hydratedCompanyId,ACTIVE)
 assert.throws(()=>hydrateAuthoritativeState(local,[{...remoteRows()[0],organization_id:FOREIGN}],{companyId:ACTIVE,initialState:local}),/otra empresa/)
})

test('M31-F011: bootstrap conserva deltas offline concurrentes por organización e ID',()=>{
 const initial=twoTenantState(),current={...initial},remote={...initial}
 for(const collection of CANONICAL_IRRIGATION_COLLECTIONS){
  current[collection]=initial[collection].map(record=>record.organizationId===ACTIVE?{...record,revision:'offline'}:record)
  remote[collection]=initial[collection].map(record=>record.organizationId===ACTIVE?{...record,revision:'postgres'}:record)
 }
 const overlaid=overlayConcurrentChanges(initial,current,remote,{companyId:ACTIVE})
 for(const collection of CANONICAL_IRRIGATION_COLLECTIONS){
  assert.equal(overlaid[collection].find(record=>record.organizationId===ACTIVE).revision,'offline',collection)
  assert.equal(overlaid[collection].find(record=>record.organizationId===FOREIGN).revision,undefined,collection)
 }
})
