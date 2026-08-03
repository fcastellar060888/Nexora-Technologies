import test from'node:test'
import assert from'node:assert/strict'
import{readFile}from'node:fs/promises'
import{createDomainEvent,getEventBusForScope,releaseEventBusScope}from'../src/core/events/index.js'
import{getOperationalLedgerForScope,releaseOperationalLedgerScope}from'../src/core/ledger/index.js'
import{getTimelineEngineForScope,releaseTimelineScope}from'../src/core/timeline/timelineEngine.js'
import{domainEventToTimelineEntry}from'../src/core/timeline/timelineProjection.js'
import{getKnowledgeGraphForScope,releaseKnowledgeGraphScope,createGraphNode}from'../src/core/knowledgeGraph/index.js'

const at='2026-08-03T15:00:00.000Z'
const scope=(organizationId,actorId)=>({organizationId,actorId})
const event=({organizationId='company-a',actorId='user-1',eventId='event-abc-1',payload={status:'healthy'}}={})=>createDomainEvent({eventId,name:'cultivation.plant.inspected',aggregateType:'cultivation.plant',aggregateId:'plant-1',organizationId,actorId,occurredAt:at,payload})

function release(value){
 releaseEventBusScope(value)
 releaseOperationalLedgerScope(value)
 releaseTimelineScope(value)
 releaseKnowledgeGraphScope(value)
}

test('reauditoría A+B+C: un evento confirmado conserva identidad desde Bus hasta Ledger y Timeline',async()=>{
 const active=scope('company-a','user-1')
 const bus=getEventBusForScope(active),ledger=getOperationalLedgerForScope(active),timeline=getTimelineEngineForScope(active)
 const original=event()
 await bus.publish(original)
 const entry=ledger.append(original,{recordedAt:at})
 const projected=domainEventToTimelineEntry(entry.event,{sequence:entry.sequence,recordedAt:entry.recordedAt,source:'operational-ledger'})
 timeline.record(projected)
 assert.equal(bus.getHistory()[0].eventId,original.eventId)
 assert.equal(ledger.getByEventId(original.eventId).event,original)
 assert.equal(timeline.getById(original.eventId).source,'operational-ledger')
 assert.equal(timeline.getById(original.eventId).organizationId,'company-a')
 release(active)
})

test('reauditoría A+B+C: reutilizar eventId con contenido distinto no altera Ledger Timeline ni Graph',async()=>{
 const active=scope('company-a','user-1')
 const bus=getEventBusForScope(active),ledger=getOperationalLedgerForScope(active),timeline=getTimelineEngineForScope(active),graph=getKnowledgeGraphForScope(active)
 const original=event()
 await bus.publish(original)
 const ledgerEntry=ledger.append(original,{recordedAt:at})
 timeline.record(domainEventToTimelineEntry(ledgerEntry.event,{sequence:ledgerEntry.sequence,recordedAt:ledgerEntry.recordedAt,source:'operational-ledger'}))
 graph.addNode(createGraphNode({nodeId:'company-a:cultivation.plant:plant-1',nodeType:'cultivation.plant',organizationId:'company-a',label:'Plant 1',createdAt:at,updatedAt:at,metadata:{source:'ledger'}}))
 const before={ledger:ledger.count(),timeline:timeline.snapshot(),graph:graph.snapshot()}
 await assert.rejects(bus.publish(event({payload:{status:'corrupt'}})),/contenido diferente/)
 assert.equal(ledger.count(),before.ledger)
 assert.deepEqual(timeline.snapshot(),before.timeline)
 assert.deepEqual(graph.snapshot(),before.graph)
 release(active)
})

test('reauditoría A+B+C: un mismo identificador permanece aislado entre workspaces en los cuatro motores',async()=>{
 const a=scope('company-a','user-1'),b=scope('company-b','user-1')
 const eventA=event({organizationId:'company-a',eventId:'shared-event'}),eventB=event({organizationId:'company-b',eventId:'shared-event',payload:{status:'different-tenant'}})
 const busA=getEventBusForScope(a),busB=getEventBusForScope(b)
 const ledgerA=getOperationalLedgerForScope(a),ledgerB=getOperationalLedgerForScope(b)
 const timelineA=getTimelineEngineForScope(a),timelineB=getTimelineEngineForScope(b)
 const graphA=getKnowledgeGraphForScope(a),graphB=getKnowledgeGraphForScope(b)
 await busA.publish(eventA);await busB.publish(eventB)
 const entryA=ledgerA.append(eventA,{recordedAt:at}),entryB=ledgerB.append(eventB,{recordedAt:at})
 timelineA.record(domainEventToTimelineEntry(entryA.event,{sequence:entryA.sequence,recordedAt:entryA.recordedAt,source:'operational-ledger'}))
 timelineB.record(domainEventToTimelineEntry(entryB.event,{sequence:entryB.sequence,recordedAt:entryB.recordedAt,source:'operational-ledger'}))
 graphA.addNode(createGraphNode({nodeId:'company-a:cultivation.plant:plant-1',nodeType:'cultivation.plant',organizationId:'company-a',label:'A',createdAt:at,updatedAt:at,metadata:{source:'ledger'}}))
 graphB.addNode(createGraphNode({nodeId:'company-b:cultivation.plant:plant-1',nodeType:'cultivation.plant',organizationId:'company-b',label:'B',createdAt:at,updatedAt:at,metadata:{source:'ledger'}}))
 assert.equal(busA.getHistory()[0].context.organizationId,'company-a')
 assert.equal(busB.getHistory()[0].context.organizationId,'company-b')
 assert.equal(ledgerA.find({organizationId:'company-b'}).length,0)
 assert.equal(ledgerB.find({organizationId:'company-a'}).length,0)
 assert.equal(timelineA.query({organizationId:'company-b'}).length,0)
 assert.equal(timelineB.query({organizationId:'company-a'}).length,0)
 assert.equal(graphA.snapshot().nodes[0].organizationId,'company-a')
 assert.equal(graphB.snapshot().nodes[0].organizationId,'company-b')
 release(a);release(b)
})

test('reauditoría A+B+C: bridges y provider resuelven runtimes por el mismo scope activo',async()=>{
 const files=[
  ['../src/core/ledger/OperationalLedgerBridge.jsx',/getEventBusForScope\(scope\)/,/getOperationalLedgerForScope\(scope\)/],
  ['../src/core/timeline/DomainEventTimelineBridge.jsx',/getOperationalLedgerForScope\(scope\)/,/getTimelineEngineForScope\(scope\)/],
  ['../src/core/knowledgeGraph/KnowledgeGraphRuntimeProvider.jsx',/getKnowledgeGraphForScope\(scope\)/]
 ]
 for(const[path,...patterns]of files){
  const source=await readFile(new URL(path,import.meta.url),'utf8')
  patterns.forEach(pattern=>assert.match(source,pattern))
 }
 const main=await readFile(new URL('../src/main.jsx',import.meta.url),'utf8')
 assert.ok(main.indexOf('<StoreProvider>')<main.indexOf('<KnowledgeGraphRuntimeProvider>'))
})
