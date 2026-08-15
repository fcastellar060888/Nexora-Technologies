import test from'node:test'
import assert from'node:assert/strict'
import{createDomainEvent,createEventBus,DomainEvents}from'../src/core/events/index.js'
import{createMemoryLedgerRepository}from'../src/core/ledger/index.js'
import{hydrateAuthoritativeState}from'../src/services/remoteBootstrap.js'
import{commitIncrementalSyncResult}from'../src/services/syncCommit.js'
import{createPersistenceRuntime,recordPersistenceResult}from'../src/services/persistenceHealth.js'

const event=(id,payload={name:'Nexora'})=>createDomainEvent({name:DomainEvents.COMPANY_CREATED,aggregateType:'company',aggregateId:'company-1',organizationId:'company-1',actorId:'user-1',occurredAt:'2026-08-03T06:30:00.000Z',eventId:id,payload})

test('reauditoría A5: lifecycle activo no puede limpiarse ni duplicar efectos',async()=>{
 const bus=createEventBus(),item=event('a5-lifecycle')
 let release,calls=0
 const gate=new Promise(resolve=>{release=resolve})
 bus.subscribe('*',async()=>{calls+=1;await gate})
 const first=bus.publish(item)
 await Promise.resolve()
 assert.throws(()=>bus.clear(),/publicaciones activas/)
 const late=await bus.publish(item)
 assert.equal(late.duplicate,true)
 assert.equal(late.inFlight,true)
 assert.equal(late.pending,true)
 release()
 assert.equal((await first).pending,false)
 assert.equal(calls,1)
})

test('reauditoría A5: identidad canónica converge y colisiones reales se rechazan',async()=>{
 const bus=createEventBus()
 const first=event('a5-identity',{nested:{b:2,a:1},label:'Nexora'})
 const equivalent=event('a5-identity',{label:'Nexora',nested:{a:1,b:2}})
 await bus.publish(first)
 assert.equal((await bus.publish(equivalent)).duplicate,true)
 await assert.rejects(()=>bus.publish(event('a5-identity',{nested:{a:1,b:3},label:'Nexora'})),/contenido diferente/)
})

test('reauditoría A5: Event Bus y Ledger conservan una identidad coherente',async()=>{
 const bus=createEventBus(),ledger=createMemoryLedgerRepository()
 bus.subscribe('*',item=>ledger.append(item))
 const item=event('a5-ledger')
 await bus.publish(item)
 assert.equal(ledger.count(),1)
 assert.equal((await bus.publish(item)).duplicate,true)
 assert.equal(ledger.count(),1)
 assert.throws(()=>ledger.append(event('a5-ledger',{name:'Alterado'})),/evento diferente/)
})

test('reauditoría A5: bootstrap, sync y persistencia continúan convergiendo',()=>{
 const initial={currentContext:{companyId:'company-1'},sites:[{id:'site-1',name:'Inicial'}],syncQueue:[{id:'q1',status:'pending'}],syncConflicts:[],syncHealthEvents:[],syncDeviceHealth:[],companies:[],users:[],roles:[],memberships:[],userSessions:[],auditLog:[],syncMeta:{}}
 const current={...initial,sites:[{id:'site-1',name:'Local'}],syncQueue:[...initial.syncQueue,{id:'q2',status:'pending'}]}
 const rows=[{organization_id:'company-1',collection:'sites',record_id:'site-1',payload:{id:'site-1',name:'Remoto'},version:2,updated_at:'2026-08-03T06:31:00.000Z',deleted_at:null}]
 assert.equal(hydrateAuthoritativeState(current,rows,{companyId:'company-1',initialState:initial}).sites[0].name,'Local')
 const processed={...initial,sites:[{id:'site-1',name:'Servidor'}],syncQueue:[{id:'q1',status:'completed'}],syncMeta:{lastSyncedAt:'2026-08-03T06:32:00.000Z'}}
 const committed=commitIncrementalSyncResult(initial,current,processed)
 assert.equal(committed.sites[0].name,'Local')
 assert.deepEqual(committed.syncQueue.map(item=>item.id),['q1','q2'])
 const failed=recordPersistenceResult(createPersistenceRuntime(),{ok:false,error:'quota'})
 assert.equal(recordPersistenceResult(failed,{ok:true}).dirty,false)
})
