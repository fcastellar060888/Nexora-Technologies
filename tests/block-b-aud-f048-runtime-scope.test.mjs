import test from'node:test'
import assert from'node:assert/strict'
import{
 createDomainEvent,getEventBusForScope,releaseEventBusScope,eventBusScopeCount
}from'../src/core/events/index.js'
import{
 getOperationalLedgerForScope,releaseOperationalLedgerScope,operationalLedgerScopeCount
}from'../src/core/ledger/index.js'
import{
 getTimelineEngineForScope,releaseTimelineScope,timelineScopeCount
}from'../src/core/timeline/index.js'

const scopeA={organizationId:'company-a',actorId:'user-1'}
const scopeB={organizationId:'company-b',actorId:'user-1'}
const scopeA2={organizationId:'company-a',actorId:'user-2'}
const event=({eventId,organizationId,actorId})=>createDomainEvent({
 eventId,name:'cultivation.plant.inspected',aggregateType:'cultivation.plant',aggregateId:'plant-1',
 organizationId,actorId,payload:{status:'ok'},occurredAt:'2026-08-03T12:00:00.000Z'
})

test('AUD-F048: Event Bus se particiona por empresa y usuario',async()=>{
 const busA=getEventBusForScope(scopeA),busB=getEventBusForScope(scopeB),busA2=getEventBusForScope(scopeA2)
 assert.equal(getEventBusForScope(scopeA),busA)
 assert.notEqual(busA,busB)
 assert.notEqual(busA,busA2)
 let deliveredA=0,deliveredB=0
 busA.subscribe('*',()=>{deliveredA+=1})
 busB.subscribe('*',()=>{deliveredB+=1})
 await busA.publish(event({eventId:'event-a',organizationId:'company-a',actorId:'user-1'}))
 assert.equal(deliveredA,1)
 assert.equal(deliveredB,0)
 assert.equal(busA.getHistory().length,1)
 assert.equal(busB.getHistory().length,0)
})

test('AUD-F048: Ledger conserva secuencias e historia independientes',()=>{
 const ledgerA=getOperationalLedgerForScope(scopeA),ledgerB=getOperationalLedgerForScope(scopeB)
 ledgerA.clear();ledgerB.clear()
 ledgerA.append(event({eventId:'ledger-a',organizationId:'company-a',actorId:'user-1'}))
 ledgerB.append(event({eventId:'ledger-b',organizationId:'company-b',actorId:'user-1'}))
 assert.equal(ledgerA.getBySequence(1).id,'ledger-a')
 assert.equal(ledgerB.getBySequence(1).id,'ledger-b')
 assert.equal(ledgerA.find({organizationId:'company-b'}).length,0)
 assert.equal(ledgerB.find({organizationId:'company-a'}).length,0)
})

test('AUD-F048: Timeline no conserva proyecciones de otro workspace',()=>{
 const timelineA=getTimelineEngineForScope(scopeA),timelineB=getTimelineEngineForScope(scopeB)
 timelineA.clear();timelineB.clear()
 timelineA.record({id:'timeline-a',eventName:'cultivation.plant.inspected',occurredAt:'2026-08-03T12:00:00.000Z',organizationId:'company-a',aggregateType:'cultivation.plant',aggregateId:'plant-1',sequence:1})
 timelineB.record({id:'timeline-b',eventName:'cultivation.plant.inspected',occurredAt:'2026-08-03T12:00:00.000Z',organizationId:'company-b',aggregateType:'cultivation.plant',aggregateId:'plant-1',sequence:1})
 assert.deepEqual(timelineA.query().map(item=>item.id),['timeline-a'])
 assert.deepEqual(timelineB.query().map(item=>item.id),['timeline-b'])
})

test('AUD-F048: liberar un scope elimina únicamente sus motores',()=>{
 const before={bus:eventBusScopeCount(),ledger:operationalLedgerScopeCount(),timeline:timelineScopeCount()}
 assert.equal(releaseEventBusScope(scopeA2),true)
 getOperationalLedgerForScope(scopeA2)
 getTimelineEngineForScope(scopeA2)
 assert.equal(releaseOperationalLedgerScope(scopeA2),true)
 assert.equal(releaseTimelineScope(scopeA2),true)
 assert.equal(eventBusScopeCount(),before.bus-1)
 assert.equal(operationalLedgerScopeCount(),before.ledger)
 assert.equal(timelineScopeCount(),before.timeline)
})
