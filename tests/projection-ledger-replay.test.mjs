import test from'node:test'
import assert from'node:assert/strict'
import{createDomainEvent}from'../src/core/events/index.js'
import{createMemoryLedgerRepository}from'../src/core/ledger/index.js'
import{createProjector,createProjectionEngine,replayLedger}from'../src/core/projectionEngine/index.js'

const event=(id,organizationId,siteId,occurredAt)=>createDomainEvent({eventId:id,name:'cultivation.plant.updated',aggregateType:'cultivation.plant',aggregateId:id,organizationId,siteId,occurredAt,payload:{label:id}})

function fixture(){
 const ledger=createMemoryLedgerRepository(),engine=createProjectionEngine(),calls=[]
 engine.registerProjector(createProjector({id:'passport',supports:()=>true,project:(value,context)=>calls.push({id:value.eventId,mode:context.projectionMode,sequence:context.ledgerSequence})}))
 ledger.append(event('evt-1','org-a','site-1','2026-08-01T10:00:00.000Z'))
 ledger.append(event('evt-2','org-b','site-2','2026-08-01T11:00:00.000Z'))
 ledger.append(event('evt-3','org-a','site-1','2026-08-01T12:00:00.000Z'))
 return{ledger,engine,calls}
}

test('reproduce el Ledger en orden ascendente con filtros de empresa sede y secuencia',async()=>{
 const{ledger,engine,calls}=fixture()
 const result=await replayLedger(ledger,engine,{organizationId:'org-a',siteId:'site-1',fromSequence:2,toSequence:3})
 assert.equal(result.mode,'replay')
 assert.equal(result.selected,1)
 assert.equal(result.succeeded,1)
 assert.deepEqual(calls,[{id:'evt-3',mode:'replay',sequence:3}])
 assert.equal(engine.getHistory({mode:'replay'}).length,1)
})

test('el replay ignora marcas previas sin contaminar la idempotencia normal',async()=>{
 const{ledger,engine,calls}=fixture(),entry=ledger.getBySequence(1)
 await engine.execute(entry.event,{ledgerSequence:1})
 assert.equal(engine.hasProcessed('evt-1','passport',1),true)
 await replayLedger(ledger,engine,{fromSequence:1,toSequence:1})
 await engine.execute(entry.event,{ledgerSequence:1})
 assert.deepEqual(calls.map(item=>item.mode),['live','replay'])
 const live=engine.getHistory({eventId:'evt-1',mode:'live'})
 assert.equal(live.at(-1).status,'skipped')
 assert.equal(live.at(-1).reason,'already-processed')
})

test('un replay de un evento nuevo no lo marca como procesado para ejecución normal',async()=>{
 const{ledger,engine,calls}=fixture(),entry=ledger.getBySequence(3)
 await replayLedger(ledger,engine,{fromSequence:3,toSequence:3})
 assert.equal(engine.hasProcessed('evt-3','passport',1),false)
 const live=await engine.execute(entry.event,{ledgerSequence:3})
 assert.equal(live.results[0].status,'succeeded')
 assert.deepEqual(calls.map(item=>item.mode),['replay','live'])
})

test('valida rangos y permite detenerse ante error del motor',async()=>{
 const{ledger}=fixture(),engine={replay:async()=>{throw new Error('fallo controlado')}}
 const result=await replayLedger(ledger,engine,{stopOnError:true})
 assert.equal(result.processed,1)
 assert.equal(result.failed,1)
 assert.equal(result.results[0].error,'fallo controlado')
 await assert.rejects(()=>replayLedger(ledger,engine,{fromSequence:3,toSequence:1}),/fromSequence/)
})
