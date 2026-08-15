import test from'node:test'
import assert from'node:assert/strict'
import{createDomainEvent,createEventBus,DomainEvents}from'../src/core/events/index.js'
import{createMemoryLedgerRepository}from'../src/core/ledger/index.js'
import{hydrateAuthoritativeState}from'../src/services/remoteBootstrap.js'
import{commitIncrementalSyncResult}from'../src/services/syncCommit.js'
import{createPersistenceRuntime,recordPersistenceResult}from'../src/services/persistenceHealth.js'

const event=(id,overrides={})=>createDomainEvent({name:DomainEvents.COMPANY_CREATED,aggregateType:'company',aggregateId:'company-1',organizationId:'company-1',actorId:'user-1',occurredAt:'2026-08-03T05:30:00.000Z',eventId:id,payload:{name:'Nexora'},...overrides})

test('reauditoría A3: alta concurrencia conserva una única entrega',async()=>{
 const bus=createEventBus(),item=event('concurrency-stress')
 let calls=0,release
 const gate=new Promise(resolve=>{release=resolve})
 bus.subscribe('*',async()=>{calls+=1;await gate})
 const publications=Array.from({length:25},()=>bus.publish(item))
 release()
 const results=await Promise.all(publications)
 assert.equal(calls,1)
 assert.equal(results.filter(result=>result.duplicate===false).length,25)
 assert.equal(bus.getHistory().length,1)
})

test('reauditoría A3: deduplicación sobrevive a presión de historial',async()=>{
 const bus=createEventBus({maxHistory:3})
 let calls=0
 bus.subscribe('*',()=>{calls+=1})
 const first=event('stress-0')
 await bus.publish(first)
 for(let index=1;index<=1500;index+=1)await bus.publish(event(`stress-${index}`))
 assert.equal(bus.getHistory().length,3)
 assert.equal((await bus.publish(first)).duplicate,true)
 assert.equal(calls,1501)
})

test('reauditoría A3: colisión dentro del mismo lote no deja escritura parcial',()=>{
 const ledger=createMemoryLedgerRepository()
 const original=event('same-batch')
 const collision=event('same-batch',{aggregateId:'company-2'})
 assert.throws(()=>ledger.appendMany([original,event('middle-entry'),collision]),/evento diferente/)
 assert.equal(ledger.count(),0)
})

test('reauditoría A3: reentrancia con contenido distinto falla sin bloquear la entrega original',async()=>{
 const bus=createEventBus({onError:()=>{}}),original=event('reentrant-collision'),collision=event('reentrant-collision',{payload:{name:'Otro'}})
 let nestedError=''
 bus.subscribe('*',async()=>{try{await bus.publish(collision)}catch(error){nestedError=error.message}})
 const result=await Promise.race([bus.publish(original),new Promise((_,reject)=>setTimeout(()=>reject(new Error('deadlock')),100))])
 assert.equal(result.failed,0)
 assert.match(nestedError,/contenido diferente/)
 assert.equal(bus.getHistory().length,1)
})

test('reauditoría A3: bootstrap, sync y persistencia mantienen sus invariantes en secuencia',()=>{
 const base={currentContext:{companyId:'company-1'},sites:[{id:'site-1',name:'Inicial'}],syncQueue:[{id:'q1',status:'pending'}],syncConflicts:[],syncHealthEvents:[],syncDeviceHealth:[],companies:[],users:[],roles:[],memberships:[],userSessions:[],auditLog:[],syncMeta:{}}
 const current={...base,sites:[{id:'site-1',name:'Local'}],syncQueue:[...base.syncQueue,{id:'q2',status:'pending'}]}
 const rows=[{organization_id:'company-1',collection:'sites',record_id:'site-1',payload:{id:'site-1',name:'Remoto'},version:2,updated_at:'2026-08-03T05:31:00.000Z',deleted_at:null}]
 const hydrated=hydrateAuthoritativeState(current,rows,{companyId:'company-1',initialState:base})
 assert.equal(hydrated.sites[0].name,'Local')
 const processed={...base,sites:[{id:'site-1',name:'Servidor'}],syncQueue:[{id:'q1',status:'completed'}],syncMeta:{lastSyncedAt:'2026-08-03T05:32:00.000Z'}}
 const committed=commitIncrementalSyncResult(base,current,processed)
 assert.equal(committed.sites[0].name,'Local')
 assert.deepEqual(committed.syncQueue.map(item=>item.id),['q1','q2'])
 const failed=recordPersistenceResult(createPersistenceRuntime(),{ok:false,error:'quota'})
 const recovered=recordPersistenceResult(failed,{ok:true})
 assert.equal(failed.dirty,true)
 assert.equal(recovered.dirty,false)
})
