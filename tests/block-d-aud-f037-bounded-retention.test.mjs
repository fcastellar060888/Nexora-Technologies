import test from'node:test'
import assert from'node:assert/strict'
import{createDomainEvent}from'../src/core/events/index.js'
import{createMemoryLedgerRepository}from'../src/core/ledger/index.js'
import{createProjectionCheckpointStore,createReplaySessionManager}from'../src/core/projectionEngine/index.js'

const complete=(store,key)=>{const token=store.claim(key);assert.ok(token);store.complete(token)}
const event=id=>createDomainEvent({eventId:id,name:'cultivation.plant.updated',aggregateType:'cultivation.plant',aggregateId:id,organizationId:'org-a',occurredAt:'2026-08-03T20:00:00.000Z',payload:{id}})
const ledgerWith=(...ids)=>{const ledger=createMemoryLedgerRepository();ids.forEach(id=>ledger.append(event(id)));return ledger}

test('AUD-F037: checkpoints bloquean crecimiento antes de perder idempotencia',()=>{
 const store=createProjectionCheckpointStore({maxCompleted:2})
 complete(store,'checkpoint-1');complete(store,'checkpoint-2')
 const token=store.claim('checkpoint-3')
 assert.throws(()=>store.complete(token),/alcanzó maxCompleted/)
 assert.equal(store.has('checkpoint-1'),true)
 assert.equal(store.has('checkpoint-2'),true)
 assert.equal(store.has('checkpoint-3'),false)
 assert.equal(store.release(token),true)
 assert.deepEqual(store.snapshot().remainingCapacity,0)
})

test('AUD-F037: compactación de checkpoints es explícita, auditable y permite continuar',()=>{
 const store=createProjectionCheckpointStore({checkpoints:['checkpoint-1','checkpoint-2'],maxCompleted:2})
 const report=store.compact({remove:['checkpoint-1','missing']})
 assert.deepEqual(report,{removed:1,remaining:1,maxCompleted:2})
 assert.equal(store.has('checkpoint-1'),false)
 assert.equal(store.has('checkpoint-2'),true)
 complete(store,'checkpoint-3')
 assert.deepEqual(store.snapshot().completed,['checkpoint-2','checkpoint-3'])
})

test('AUD-F037: hidratación que excede capacidad falla atómicamente',()=>{
 const store=createProjectionCheckpointStore({checkpoints:['checkpoint-1'],maxCompleted:2})
 assert.throws(()=>store.hydrate(['checkpoint-2','checkpoint-3']),/excede maxCompleted/)
 assert.deepEqual(store.snapshot().completed,['checkpoint-1'])
})

test('AUD-F037: sesiones terminales antiguas se compactan y las activas se preservan',async()=>{
 const ledger=ledgerWith('evt-1')
 let next=0
 const manager=createReplaySessionManager(ledger,{replay:async event=>({eventId:event.eventId})},{maxSessions:2,idFactory:()=>`session-${++next}`})
 await manager.start().completion
 await manager.start().completion
 const third=manager.start()
 assert.equal(manager.getSession('session-1'),null)
 assert.ok(manager.getSession('session-2'))
 await third.completion
 assert.deepEqual(manager.status(),{sessions:2,maxSessions:2,active:0,terminal:2})
})

test('AUD-F037: capacidad llena con sesiones activas rechaza una nueva sin expulsarlas',async()=>{
 const ledger=ledgerWith('evt-1')
 let release,started,next=0
 const waiting=new Promise(resolve=>{started=resolve})
 const engine={replay:async()=>{started();await new Promise(resolve=>{release=resolve});return{}}}
 const manager=createReplaySessionManager(ledger,engine,{maxSessions:1,idFactory:()=>`active-${++next}`})
 const first=manager.start();await waiting
 assert.throws(()=>manager.start(),/sesiones activas/)
 assert.equal(manager.getSession('active-1').status,'running')
 release();await first.completion
})
