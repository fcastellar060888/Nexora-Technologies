import test from'node:test'
import assert from'node:assert/strict'
import{
 createDomainEvent,getEventBusForScope,releaseEventBusScope,eventBusScopeCount,eventRuntimeKey
}from'../src/core/events/index.js'
import{
 getOperationalLedgerForScope,releaseOperationalLedgerScope,operationalLedgerScopeCount,ledgerRuntimeKey
}from'../src/core/ledger/index.js'
import{
 getTimelineEngineForScope,releaseTimelineScope
}from'../src/core/timeline/index.js'

const scopeA={organizationId:'company-a',actorId:'user-1'}
const scopeB={organizationId:'company-b',actorId:'user-1'}
const scopeA2={organizationId:'company-a',actorId:'user-2'}
const event=({eventId,organizationId,actorId})=>createDomainEvent({
 eventId,name:'cultivation.plant.inspected',aggregateType:'cultivation.plant',aggregateId:'plant-1',
 organizationId,actorId,payload:{status:'ok'},occurredAt:'2026-08-03T12:00:00.000Z'
})

test('AUD3-F002: Event Bus comparte autoridad entre usuarios de la misma empresa',async()=>{
 const before=eventBusScopeCount()
 const busA=getEventBusForScope(scopeA),busA2=getEventBusForScope(scopeA2),busB=getEventBusForScope(scopeB)
 assert.equal(eventRuntimeKey(scopeA),eventRuntimeKey(scopeA2))
 assert.equal(busA,busA2)
 assert.notEqual(busA,busB)
 let delivered=0
 const unsubscribe=busA.subscribe('*',received=>{delivered+=1;assert.equal(received.context.actorId,'user-2')})
 await busA2.publish(event({eventId:'event-a2',organizationId:'company-a',actorId:'user-2'}))
 assert.equal(delivered,1)
 assert.equal(busA.getHistory().at(-1).context.actorId,'user-2')
 unsubscribe()
 assert.equal(releaseEventBusScope(scopeA2),true)
 assert.equal(releaseEventBusScope(scopeB),true)
 assert.equal(eventBusScopeCount(),before)
})

test('AUD3-F002: Ledger comparte secuencia por empresa y conserva actor por evento',()=>{
 const before=operationalLedgerScopeCount()
 const ledgerA=getOperationalLedgerForScope(scopeA),ledgerA2=getOperationalLedgerForScope(scopeA2),ledgerB=getOperationalLedgerForScope(scopeB)
 assert.equal(ledgerRuntimeKey(scopeA),ledgerRuntimeKey(scopeA2))
 assert.equal(ledgerA,ledgerA2)
 assert.notEqual(ledgerA,ledgerB)
 ledgerA.clear();ledgerB.clear()
 ledgerA.append(event({eventId:'ledger-user-1',organizationId:'company-a',actorId:'user-1'}))
 ledgerA2.append(event({eventId:'ledger-user-2',organizationId:'company-a',actorId:'user-2'}))
 ledgerB.append(event({eventId:'ledger-b',organizationId:'company-b',actorId:'user-1'}))
 assert.equal(ledgerA.getBySequence(1).id,'ledger-user-1')
 assert.equal(ledgerA.getBySequence(2).id,'ledger-user-2')
 assert.deepEqual(ledgerA.find({actorId:'user-2',order:'asc'}).map(item=>item.id),['ledger-user-2'])
 assert.equal(ledgerA.find({organizationId:'company-b'}).length,0)
 assert.equal(ledgerB.getBySequence(1).id,'ledger-b')
 assert.equal(releaseOperationalLedgerScope(scopeA2),true)
 assert.equal(releaseOperationalLedgerScope(scopeB),true)
 assert.equal(operationalLedgerScopeCount(),before)
})

test('AUD-F048: Timeline sigue aislando proyecciones de empresas distintas',()=>{
 const timelineA=getTimelineEngineForScope(scopeA),timelineB=getTimelineEngineForScope(scopeB)
 timelineA.clear();timelineB.clear()
 timelineA.record({id:'timeline-a',eventName:'cultivation.plant.inspected',occurredAt:'2026-08-03T12:00:00.000Z',organizationId:'company-a',aggregateType:'cultivation.plant',aggregateId:'plant-1',sequence:1})
 timelineB.record({id:'timeline-b',eventName:'cultivation.plant.inspected',occurredAt:'2026-08-03T12:00:00.000Z',organizationId:'company-b',aggregateType:'cultivation.plant',aggregateId:'plant-1',sequence:1})
 assert.deepEqual(timelineA.query().map(item=>item.id),['timeline-a'])
 assert.deepEqual(timelineB.query().map(item=>item.id),['timeline-b'])
 assert.equal(releaseTimelineScope(scopeA),true)
 assert.equal(releaseTimelineScope(scopeB),true)
})
