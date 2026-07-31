import test from'node:test'
import assert from'node:assert/strict'
import{readFile}from'node:fs/promises'
import{createDomainEvent,createEventBus,DomainEvents}from'../src/core/events/index.js'
import{createTimelineEngine,domainEventToTimelineEntry}from'../src/core/timeline/index.js'
import{migrateState,CURRENT_SCHEMA_VERSION}from'../src/services/stateMigration.js'

const event=(overrides={})=>createDomainEvent({
 name:DomainEvents.SITE_CREATED,
 aggregateType:'site',
 aggregateId:'site-1',
 organizationId:'company-1',
 siteId:'site-1',
 actorId:'user-1',
 occurredAt:'2026-07-31T21:00:00.000Z',
 eventId:'event-1',
 payload:{label:'Canapa · Villeta'},
 metadata:{actorName:'Fer'},
 ...overrides
})

test('proyecta eventos a entradas legibles del timeline',()=>{
 const entry=domainEventToTimelineEntry(event())
 assert.equal(entry.title,'Sede creada')
 assert.equal(entry.category,'Organización')
 assert.equal(entry.summary,'Canapa · Villeta')
 assert.equal(entry.actorName,'Fer')
 assert.equal(entry.aggregateId,'site-1')
 assert.ok(Object.isFrozen(entry))
})

test('registra eventos sin duplicar por eventId',()=>{
 const timeline=createTimelineEngine()
 timeline.recordEvent(event())
 timeline.recordEvent(event())
 assert.equal(timeline.size(),1)
})

test('consulta por empresa, sede, objeto, texto y rango de fechas',()=>{
 const timeline=createTimelineEngine()
 timeline.recordEvent(event())
 timeline.recordEvent(event({eventId:'event-2',aggregateId:'site-2',siteId:'site-2',occurredAt:'2026-08-01T10:00:00.000Z',payload:{label:'Canapa · Villa de Leyva'}}))
 assert.equal(timeline.query({organizationId:'company-1'}).length,2)
 assert.equal(timeline.query({siteId:'site-1'}).length,1)
 assert.equal(timeline.query({aggregateId:'site-2'}).length,1)
 assert.equal(timeline.query({search:'villa de leyva'}).length,1)
 assert.equal(timeline.query({from:'2026-08-01T00:00:00.000Z'}).length,1)
})

test('ordena por fecha y limita resultados',()=>{
 const timeline=createTimelineEngine()
 timeline.recordEvent(event())
 timeline.recordEvent(event({eventId:'event-2',occurredAt:'2026-08-01T10:00:00.000Z'}))
 assert.equal(timeline.query({limit:1})[0].id,'event-2')
 assert.equal(timeline.query({order:'asc',limit:1})[0].id,'event-1')
})

test('se conecta y desconecta del Event Bus',async()=>{
 const bus=createEventBus(),timeline=createTimelineEngine()
 const disconnect=timeline.connect(bus)
 await bus.publish(event())
 assert.equal(timeline.size(),1)
 disconnect()
 await bus.publish(event({eventId:'event-2'}))
 assert.equal(timeline.size(),1)
})

test('rehidrata entradas persistidas sin duplicados',()=>{
 const timeline=createTimelineEngine()
 const first=domainEventToTimelineEntry(event())
 const second=domainEventToTimelineEntry(event({eventId:'event-2',occurredAt:'2026-08-01T10:00:00.000Z'}))
 assert.equal(timeline.hydrate([second,first,first]),2)
 assert.deepEqual(timeline.query({order:'asc'}).map(item=>item.id),['event-1','event-2'])
})

test('migra timelineEntries al esquema persistente actual',()=>{
 const entry=domainEventToTimelineEntry(event())
 const state=migrateState({timelineEntries:[entry,entry]})
 assert.equal(CURRENT_SCHEMA_VERSION,8)
 assert.equal(state.schemaVersion,8)
 assert.equal(state.timelineEntries.length,1)
 assert.equal(state.timelineEntries[0].id,'event-1')
})

test('el bridge persiste sin sincronización ni auditoría recursiva',async()=>{
 const source=await readFile(new URL('../src/core/timeline/DomainEventTimelineBridge.jsx',import.meta.url),'utf8')
 assert.match(source,/timelineEngine\.hydrate\(state\.timelineEntries/)
 assert.match(source,/timelineEntries:/)
 assert.match(source,/sync:false,audit:false/)
 assert.match(source,/slice\(-2000\)/)
})
