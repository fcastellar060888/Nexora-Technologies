import test from'node:test'
import assert from'node:assert/strict'
import{createDomainEvent}from'../src/core/events/index.js'
import{createMemoryLedgerRepository}from'../src/core/ledger/index.js'
import{createReplaySessionManager}from'../src/core/projectionEngine/index.js'

const domainEvent=id=>createDomainEvent({eventId:id,name:'cultivation.plant.updated',aggregateType:'cultivation.plant',aggregateId:id,organizationId:'org-a',siteId:'site-1',occurredAt:`2026-08-01T10:0${id.at(-1)}:00.000Z`,payload:{label:id}})
const ledgerWith=(...ids)=>{const ledger=createMemoryLedgerRepository();ids.forEach(id=>ledger.append(domainEvent(id)));return ledger}

test('crea una sesión auditable y reporta progreso hasta completarse',async()=>{
 const ledger=ledgerWith('evt-1','evt-2'),calls=[]
 const engine={replay:async(event,context)=>{calls.push({id:event.eventId,sessionId:context.replaySessionId});return{eventId:event.eventId}}}
 const manager=createReplaySessionManager(ledger,engine,{idFactory:()=> 'replay-1'})
 const handle=manager.start({organizationId:'org-a'})
 assert.equal(handle.sessionId,'replay-1')
 assert.equal(handle.status().status,'running')
 const completed=await handle.completion
 assert.equal(completed.status,'completed')
 assert.equal(completed.processed,2)
 assert.equal(completed.succeeded,2)
 assert.equal(completed.remaining,0)
 assert.deepEqual(calls,[{id:'evt-1',sessionId:'replay-1'},{id:'evt-2',sessionId:'replay-1'}])
 assert.equal(Object.isFrozen(manager.getSession('replay-1')),true)
 assert.equal(manager.listSessions().length,1)
})

test('cancela de forma segura después de terminar la entrada en curso',async()=>{
 const ledger=ledgerWith('evt-1','evt-2','evt-3')
 let releaseFirst,startedFirst
 const firstStarted=new Promise(resolve=>{startedFirst=resolve})
 const engine={replay:async event=>{
  if(event.eventId==='evt-1'){startedFirst();await new Promise(resolve=>{releaseFirst=resolve})}
  return{eventId:event.eventId}
 }}
 const manager=createReplaySessionManager(ledger,engine,{idFactory:()=> 'replay-cancel'})
 const handle=manager.start()
 await firstStarted
 assert.equal(handle.cancel(),true)
 assert.equal(handle.status().status,'cancelling')
 assert.equal(handle.cancel(),false)
 releaseFirst()
 const completed=await handle.completion
 assert.equal(completed.status,'cancelled')
 assert.equal(completed.processed,1)
 assert.equal(completed.remaining,2)
 assert.equal(manager.cancelSession('replay-cancel'),false)
})

test('rechaza identificadores duplicados y conserva una sesión fallida para auditoría',async()=>{
 const ledger=ledgerWith('evt-1'),engine={replay:async()=>null}
 const manager=createReplaySessionManager(ledger,engine,{idFactory:()=> 'same-id'})
 const first=manager.start({fromSequence:3,toSequence:1})
 assert.throws(()=>manager.start(),/ya existe/)
 await assert.rejects(first.completion,/fromSequence/)
 const failed=manager.getSession('same-id')
 assert.equal(failed.status,'failed')
 assert.match(failed.error,/fromSequence/)
 assert.ok(failed.finishedAt)
})
