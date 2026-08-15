import test from'node:test'
import assert from'node:assert/strict'
import{createDomainEvent}from'../src/core/events/index.js'
import{createTimelineEngine,domainEventToTimelineEntry}from'../src/core/timeline/index.js'

const event=(id='event-1')=>createDomainEvent({
 eventId:id,
 name:'cultivation.plant.inspected',
 aggregateType:'cultivation.plant',
 aggregateId:`plant-${id}`,
 organizationId:'company-a',
 actorId:'user-a',
 occurredAt:'2026-08-03T16:00:00.000Z',
 payload:{status:'ok'}
})
const entry=(id='event-1',sequence=1)=>domainEventToTimelineEntry(event(id),{
 sequence,
 recordedAt:`2026-08-03T16:00:0${sequence}.000Z`,
 source:'operational-ledger'
})

test('AUD-F015: Event Bus no puede conectarse ni escribir directamente',()=>{
 const timeline=createTimelineEngine()
 assert.throws(()=>timeline.connect({subscribe(){return()=>{}}}),/Operational Ledger/)
 assert.throws(()=>timeline.recordEvent(event()),/Operational Ledger/)
 assert.equal(timeline.size(),0)
 assert.deepEqual(timeline.health().authority,'operational-ledger')
 assert.equal(timeline.disconnect(),false)
})

test('AUD-F015: un observador defectuoso no bloquea otros observadores ni la escritura',()=>{
 const timeline=createTimelineEngine()
 let healthyCalls=0
 timeline.subscribe(()=>{throw new Error('fallo visual')})
 timeline.subscribe(()=>{healthyCalls+=1})
 const recorded=timeline.record(entry())
 assert.equal(recorded.id,'event-1')
 assert.equal(timeline.size(),1)
 assert.equal(healthyCalls,1)
 assert.equal(timeline.health().status,'degraded')
 assert.equal(timeline.health().observerFailures,1)
 assert.match(timeline.health().lastObserverError.message,/fallo visual/)
})

test('AUD-F015: los errores se reportan a diagnóstico sin confiar en su callback',()=>{
 const reported=[]
 const timeline=createTimelineEngine({onObserverError:error=>{
  reported.push(error)
  throw new Error('diagnóstico externo roto')
 }})
 timeline.subscribe(()=>{throw new TypeError('render roto')})
 assert.doesNotThrow(()=>timeline.record(entry()))
 assert.equal(reported.length,1)
 assert.equal(reported[0].name,'TypeError')
 assert.match(reported[0].message,/render roto/)
 assert.equal(Object.isFrozen(reported[0]),true)
 assert.equal(timeline.size(),1)
})

test('AUD-F015: la retención de errores está acotada y el contador es acumulativo',()=>{
 const timeline=createTimelineEngine({maxObserverErrors:2})
 timeline.subscribe(()=>{throw new Error('siempre falla')})
 timeline.record(entry('event-1',1))
 timeline.record(entry('event-2',2))
 timeline.record(entry('event-3',3))
 assert.equal(timeline.health().observerFailures,3)
 assert.equal(timeline.health().retainedObserverErrors,2)
 assert.equal(timeline.getObserverErrors().length,2)
 assert.equal(timeline.getObserverErrors({limit:1}).length,1)
 timeline.clearObserverErrors()
 assert.equal(timeline.getObserverErrors().length,0)
 assert.equal(timeline.health().observerFailures,3)
 assert.equal(timeline.health().status,'degraded')
})

test('AUD-F015: desuscribir elimina solo al observador indicado',()=>{
 const timeline=createTimelineEngine()
 let first=0,second=0
 const unsubscribe=timeline.subscribe(()=>{first+=1})
 timeline.subscribe(()=>{second+=1})
 timeline.record(entry('event-1',1))
 unsubscribe()
 timeline.record(entry('event-2',2))
 assert.equal(first,1)
 assert.equal(second,2)
 assert.equal(timeline.health().observerFailures,0)
 assert.equal(timeline.health().status,'ready')
})