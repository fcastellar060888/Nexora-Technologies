import test from'node:test'
import assert from'node:assert/strict'
import{createDomainEvent,createEventBus,DomainEvents}from'../src/core/events/index.js'
import{createMemoryLedgerRepository}from'../src/core/ledger/index.js'
import{hydrateAuthoritativeState}from'../src/services/remoteBootstrap.js'
import{commitIncrementalSyncResult}from'../src/services/syncCommit.js'
import{createPersistenceRuntime,recordPersistenceResult}from'../src/services/persistenceHealth.js'

const event=(id,overrides={})=>createDomainEvent({name:DomainEvents.COMPANY_CREATED,aggregateType:'company',aggregateId:'company-1',organizationId:'company-1',actorId:'user-1',occurredAt:'2026-08-03T07:30:00.000Z',eventId:id,payload:{name:'Nexora',nested:{values:[0,1.5,null,true]}},...overrides})

test('reauditoría A8: evento canónico converge tras veinte ciclos de persistencia',async()=>{
 const original=event('twenty-roundtrips')
 let restored=original
 for(let index=0;index<20;index+=1)restored=JSON.parse(JSON.stringify(restored))
 assert.deepEqual(restored,JSON.parse(JSON.stringify(original)))
 const bus=createEventBus({maxHistory:1})
 const ledger=createMemoryLedgerRepository()
 let calls=0
 bus.subscribe('*',item=>{calls+=1;ledger.append(item)})
 await bus.publish(original)
 assert.equal((await bus.publish(restored)).duplicate,true)
 assert.equal(calls,1)
 assert.equal(ledger.count(),1)
})

test('reauditoría A8: entradas hostiles no ejecutan código durante validación',()=>{
 let effects=0
 const hostileId={toString(){effects+=1;return'event-hostile'}}
 const hostileDate={toString(){effects+=1;return'2026-08-03T07:30:00.000Z'}}
 const hostilePayload={}
 Object.defineProperty(hostilePayload,'value',{enumerable:true,get(){effects+=1;return'Nexora'}})
 assert.throws(()=>event('hostile-id',{eventId:hostileId}),/debe ser texto/)
 assert.throws(()=>event('hostile-date',{occurredAt:hostileDate}),/debe ser texto/)
 assert.throws(()=>event('hostile-payload',{payload:hostilePayload}),/propiedad accesora/)
 assert.equal(effects,0)
})

test('reauditoría A8: concurrencia, limpieza y reintento conservan invariantes',async()=>{
 const bus=createEventBus({onError:()=>{}})
 let release,calls=0,fail=true
 const gate=new Promise(resolve=>{release=resolve})
 bus.subscribe('*',async()=>{calls+=1;await gate;if(fail)throw new Error('temporal')})
 const item=event('lifecycle-final')
 const first=bus.publish(item)
 await Promise.resolve()
 assert.throws(()=>bus.clear(),/publicaciones activas/)
 const concurrent=await bus.publish(item)
 assert.equal(concurrent.duplicate,true)
 assert.equal(concurrent.inFlight,true)
 assert.equal(concurrent.pending,true)
 release()
 const failed=await first
 assert.equal(failed.failed,1)
 assert.equal(failed.pending,true)
 fail=false
 const recovered=await bus.publish(item)
 assert.equal(recovered.retry,true)
 assert.equal(recovered.failed,0)
 assert.equal(calls,2)
 assert.equal((await bus.publish(item)).duplicate,true)
})

test('reauditoría A8: bootstrap, sync y persistencia convergen sin pérdida local',()=>{
 const base={currentContext:{companyId:'company-1'},sites:[{id:'site-1',name:'Inicial'}],syncQueue:[{id:'q1',status:'pending'}],syncConflicts:[],syncHealthEvents:[],syncDeviceHealth:[],companies:[],users:[],roles:[],memberships:[],userSessions:[],auditLog:[],syncMeta:{}}
 const current={...base,sites:[{id:'site-1',name:'Local'}],syncQueue:[...base.syncQueue,{id:'q2',status:'pending'}]}
 const rows=[{organization_id:'company-1',collection:'sites',record_id:'site-1',payload:{id:'site-1',name:'Remoto'},version:2,updated_at:'2026-08-03T07:31:00.000Z',deleted_at:null}]
 const hydrated=hydrateAuthoritativeState(current,rows,{companyId:'company-1',initialState:base})
 assert.equal(hydrated.sites[0].name,'Local')
 const processed={...base,sites:[{id:'site-1',name:'Servidor'}],syncQueue:[{id:'q1',status:'completed'}],syncMeta:{lastSyncedAt:'2026-08-03T07:32:00.000Z'}}
 const committed=commitIncrementalSyncResult(base,current,processed)
 assert.equal(committed.sites[0].name,'Local')
 assert.deepEqual(committed.syncQueue.map(item=>item.id),['q1','q2'])
 const failed=recordPersistenceResult(createPersistenceRuntime(),{ok:false,error:'quota'})
 const recovered=recordPersistenceResult(failed,{ok:true})
 assert.equal(failed.dirty,true)
 assert.equal(recovered.dirty,false)
})
