import test from'node:test'
import assert from'node:assert/strict'
import{readFile}from'node:fs/promises'
import{initialState}from'../src/services/storage.js'
import{CURRENT_SCHEMA_VERSION,migrateState}from'../src/services/stateMigration.js'
import{compactCompanyState,readLightweightCache,writeLightweightCache}from'../src/services/lightweightCache.js'
import{SYNCABLE_COLLECTIONS,applyRemoteRecords,collectionChanges,enqueueChanges}from'../src/services/syncEngine.js'
import{hydrateAuthoritativeState}from'../src/services/remoteBootstrap.js'
import{executeMipeCommand,mipeCommandSignature,MIPE_OPERATIONS}from'../src/services/mipeCommand.js'

const receipt=(organizationId,commandId,extra={})=>({id:commandId,commandId,organizationId,signature:'sig',operation:'CREATE_INCIDENT',aggregateId:commandId,occurredAt:'2026-08-17T10:00:00.000Z',actor:{id:'u',name:'U'},...extra})
const intervention=(organizationId,id,extra={})=>({id,organizationId,siteId:organizationId==='org-a'?'site-a':'site-b',findingId:'finding-shared',type:'Seguimiento',responsible:'A',outcome:'Estable',performedAt:'2026-08-17T10:00:00.000Z',nextReviewAt:null,findingSnapshot:{id:'finding-shared',targetType:'POSITION',targetId:'plant-shared',plantPositionId:'plant-shared'},assignmentHistory:[{id:`${id}:assignment:created`,kind:'ASSIGNED',responsible:'A',actor:{id:'u',name:'U'},occurredAt:'2026-08-17T10:00:00.000Z'}],createdAt:'2026-08-17T10:00:00.000Z',updatedAt:'2026-08-17T10:00:00.000Z',...extra})

function memoryStorage(){const data=new Map();return{getItem:key=>data.has(key)?data.get(key):null,setItem:(key,value)=>data.set(key,String(value)),removeItem:key=>data.delete(key),data}}
function base(){return migrateState({
 companies:[{id:'org-a'},{id:'org-b'}],currentContext:{companyId:'org-a',siteId:'site-a'},users:[{id:'user-a',name:'Agrónomo',role:'Encargado MIPE',activeSession:true,active:true,remote:false}],roles:[],memberships:[],
 sites:[{id:'site-a',organizationId:'org-a',companyId:'org-a'},{id:'site-b',organizationId:'org-b',companyId:'org-b'}],houses:[],beds:[],plantPositions:[],grandmotherPlants:[],motherPlants:[],genetics:[],products:[],inventoryLots:[],inventoryMovements:[],costEntries:[],plantEvents:[],
 incidents:[{id:'incident-shared',organizationId:'org-a',name:'A',active:true},{id:'incident-shared',organizationId:'org-b',name:'B',active:true}],
 findings:[{id:'finding-shared',organizationId:'org-a',siteId:'site-a',plantPositionId:'plant-shared',targetType:'POSITION',targetId:'plant-shared',incidentId:'incident-shared',status:'Seguimiento',reportedAt:'2026-08-17T08:00:00.000Z'},{id:'finding-shared',organizationId:'org-b',siteId:'site-b',plantPositionId:'plant-shared',targetType:'POSITION',targetId:'plant-shared',incidentId:'incident-shared',status:'Seguimiento',reportedAt:'2026-08-17T08:00:00.000Z'}],
 treatments:[],mipeInterventions:[intervention('org-a','intervention-shared'),intervention('org-b','intervention-shared')],mipeCommandReceipts:[receipt('org-a','command-shared'),receipt('org-b','command-shared')],syncQueue:[],syncConflicts:[],syncHealthEvents:[],syncDeviceHealth:[]
})}

test('M32-F008: schema/defaults materialize Intervention and command receipt collections',()=>{
 assert.ok(CURRENT_SCHEMA_VERSION>=15)
 assert.ok(Array.isArray(initialState.mipeInterventions))
 assert.ok(Array.isArray(initialState.mipeCommandReceipts))
 const migrated=migrateState({companies:[{id:'org-a'}],currentContext:{companyId:'org-a'},sites:[{id:'site-a',organizationId:'org-a'}],incidents:[{id:'i',organizationId:'org-a'}],findings:[{id:'f',organizationId:'org-a',siteId:'site-a',incidentId:'i',plantPositionId:'p'}],mipeInterventions:[{id:'x',findingId:'f',siteId:'site-a'}],mipeCommandReceipts:[{commandId:'cmd',organizationId:'org-a',signature:'s'}]})
 assert.equal(migrated.mipeInterventions[0].organizationId,'org-a')
 assert.equal(migrated.mipeCommandReceipts[0].id,'cmd')
 assert.equal(migrated.mipeCommandReceipts[0].commandId,'cmd')
})

test('M32-F008: segmented cache preserves nested MIPE evidence and excludes foreign homonyms',()=>{
 const state=base(),storage=memoryStorage()
 writeLightweightCache(state,storage)
 const cached=readLightweightCache(storage)
 assert.equal(cached.mipeInterventions.length,1)
 assert.equal(cached.mipeInterventions[0].organizationId,'org-a')
 assert.equal(cached.mipeInterventions[0].assignmentHistory[0].id,'intervention-shared:assignment:created')
 assert.equal(cached.mipeCommandReceipts.length,1)
 assert.equal(cached.mipeCommandReceipts[0].commandId,'command-shared')
 const compacted=compactCompanyState(state,'org-a')
 assert.equal(compacted.collections.mipeInterventions.length,1)
 assert.equal(compacted.collections.mipeCommandReceipts.length,1)
})

test('M32-F008: sync allowlist queues MIPE Interventions and receipts with stable tenant identity',()=>{
 assert.ok(SYNCABLE_COLLECTIONS.includes('mipeInterventions'))
 assert.ok(SYNCABLE_COLLECTIONS.includes('mipeCommandReceipts'))
 const prev={mipeInterventions:[],mipeCommandReceipts:[]},next={mipeInterventions:[intervention('org-a','int-a')],mipeCommandReceipts:[receipt('org-a','cmd-a')]}
 const changes=collectionChanges(prev,next,['mipeInterventions','mipeCommandReceipts'])
 assert.deepEqual(changes.map(item=>[item.collection,item.recordId,item.organizationId]).sort(),[['mipeCommandReceipts','cmd-a','org-a'],['mipeInterventions','int-a','org-a']])
 const queued=enqueueChanges({syncQueue:[]},changes,{companyId:'org-a',userId:'u',deviceId:'d'})
 assert.equal(queued.syncQueue.length,2)
 assert.ok(queued.syncQueue.every(item=>item.companyId==='org-a'&&item.recordId))
})

test('M32-F008: remote upsert and tombstone affect only active-tenant MIPE homonym',()=>{
 let state=base()
 state=applyRemoteRecords(state,[{companyId:'org-a',collection:'mipeInterventions',recordId:'intervention-shared',payload:{...intervention('org-a','intervention-shared'),outcome:'Remoto A'},version:7,updatedAt:'2026-08-18T10:00:00.000Z',deletedAt:''}],{companyId:'org-a'})
 assert.equal(state.mipeInterventions.length,2)
 assert.equal(state.mipeInterventions.find(item=>item.organizationId==='org-b').outcome,'Estable')
 assert.equal(state.mipeInterventions.find(item=>item._organizationId==='org-a').outcome,'Remoto A')
 state=applyRemoteRecords(state,[{companyId:'org-a',collection:'mipeInterventions',recordId:'intervention-shared',payload:null,version:8,updatedAt:'2026-08-18T11:00:00.000Z',deletedAt:'2026-08-18T11:00:00.000Z'}],{companyId:'org-a'})
 assert.equal(state.mipeInterventions.length,1)
 assert.equal(state.mipeInterventions[0].organizationId,'org-b')
})

test('M32-F008: authoritative bootstrap replaces A and preserves B for interventions and receipts',()=>{
 const local=base(),rows=[
  {organization_id:'org-a',collection:'mipeInterventions',record_id:'intervention-shared',payload:{...intervention('org-a','intervention-shared'),outcome:'Bootstrap A'},version:3,updated_at:'2026-08-18T10:00:00.000Z',deleted_at:null},
  {organization_id:'org-a',collection:'mipeCommandReceipts',record_id:'command-shared',payload:{...receipt('org-a','command-shared'),signature:'remote-signature'},version:4,updated_at:'2026-08-18T10:00:00.000Z',deleted_at:null}
 ]
 const hydrated=hydrateAuthoritativeState(local,rows,{companyId:'org-a',initialState:local,hydratedAt:'2026-08-18T12:00:00.000Z'})
 assert.equal(hydrated.mipeInterventions.length,2)
 assert.equal(hydrated.mipeInterventions.find(item=>item.organizationId==='org-b').outcome,'Estable')
 assert.equal(hydrated.mipeInterventions.find(item=>item._organizationId==='org-a').outcome,'Bootstrap A')
 assert.equal(hydrated.mipeCommandReceipts.length,2)
 assert.equal(hydrated.mipeCommandReceipts.find(item=>item.organizationId==='org-b').signature,'sig')
 assert.equal(hydrated.mipeCommandReceipts.find(item=>item._organizationId==='org-a').signature,'remote-signature')
})

test('M32-F008: pending local MIPE mutation survives authoritative bootstrap for the same tenant',()=>{
 const local=base(),pending={...intervention('org-a','intervention-shared'),outcome:'Offline más nuevo',_organizationId:'org-a'}
 local.syncQueue=[{id:'q1',companyId:'org-a',collection:'mipeInterventions',recordId:'intervention-shared',operation:'upsert',payload:pending,status:'pending'}]
 const rows=[{organization_id:'org-a',collection:'mipeInterventions',record_id:'intervention-shared',payload:{...intervention('org-a','intervention-shared'),outcome:'Servidor viejo'},version:2,updated_at:'2026-08-18T09:00:00.000Z',deleted_at:null}]
 const hydrated=hydrateAuthoritativeState(local,rows,{companyId:'org-a',initialState:local,hydratedAt:'2026-08-18T12:00:00.000Z'})
 assert.equal(hydrated.mipeInterventions.find(item=>item.organizationId==='org-a'||item._organizationId==='org-a').outcome,'Offline más nuevo')
 assert.equal(hydrated.mipeInterventions.find(item=>item.organizationId==='org-b').outcome,'Estable')
})

test('M32-F008: hydrated command receipt preserves replay idempotency after device reload',async()=>{
 const commandId='replay-after-bootstrap',input={name:'Incidencia sincronizada',category:'Plaga',risk:'Medio'},signature=mipeCommandSignature({operation:MIPE_OPERATIONS.CREATE_INCIDENT,aggregateId:commandId,input})
 const local=base();local.incidents=local.incidents.filter(item=>item.organizationId!=='org-a')
 const rows=[
  {organization_id:'org-a',collection:'incidents',record_id:commandId,payload:{id:commandId,organizationId:'org-a',name:input.name,category:'Plaga',risk:'Medio',active:true,createdAt:'2026-08-17T10:00:00.000Z'},version:1,updated_at:'2026-08-17T10:00:00.000Z',deleted_at:null},
  {organization_id:'org-a',collection:'mipeCommandReceipts',record_id:commandId,payload:{commandId,organizationId:'org-a',signature,operation:MIPE_OPERATIONS.CREATE_INCIDENT,aggregateId:commandId,occurredAt:'2026-08-17T10:00:00.000Z',actor:{id:'user-a',name:'Agrónomo'}},version:1,updated_at:'2026-08-17T10:00:00.000Z',deleted_at:null}
 ]
 let state=hydrateAuthoritativeState(local,rows,{companyId:'org-a',initialState:local}),commits=0
 const deps={publishEvent:async()=>{},commit:recipe=>{state=recipe(state);commits++}}
 await executeMipeCommand(state,{operation:MIPE_OPERATIONS.CREATE_INCIDENT,input,commandId,occurredAt:'2026-08-17T10:00:00.000Z'},deps)
 assert.equal(state.incidents.filter(item=>(item.organizationId||item._organizationId)==='org-a'&&item.id===commandId).length,1)
 assert.equal(state.mipeCommandReceipts.filter(item=>(item.organizationId||item._organizationId)==='org-a'&&item.commandId===commandId).length,1)
 assert.equal(commits,1)
})

test('M32-F008: generic receipt sync does not expand the five-consequence F004 transaction',async()=>{
 const source=await readFile('src/services/mipeTreatmentTransaction.js','utf8'),command=await readFile('src/services/mipeCommand.js','utf8')
 assert.match(source,/CANONICAL_COLLECTIONS=Object\.freeze\(\['inventoryLots','inventoryMovements','treatments','findings','costEntries'\]\)/)
 assert.doesNotMatch(source,/mipeCommandReceipts/)
 assert.match(command,/remoteTreatment\?\{sync:false\}/)
})
