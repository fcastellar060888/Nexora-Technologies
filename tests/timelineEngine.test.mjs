import test from'node:test'
import assert from'node:assert/strict'
import{readFile}from'node:fs/promises'
import{createDomainEvent,DomainEvents}from'../src/core/events/index.js'
import{createLedgerEntry}from'../src/core/ledger/index.js'
import{createTimelineEngine,domainEventToTimelineEntry}from'../src/core/timeline/index.js'
import{migrateState,CURRENT_SCHEMA_VERSION}from'../src/services/stateMigration.js'

const event=(overrides={})=>createDomainEvent({name:DomainEvents.SITE_CREATED,aggregateType:'site',aggregateId:'site-1',organizationId:'company-1',siteId:'site-1',actorId:'user-1',occurredAt:'2026-07-31T21:00:00.000Z',eventId:'event-1',payload:{label:'Canapa · Villeta'},metadata:{actorName:'Fer'},...overrides})
const ledgerTimelineEntry=(domainEvent,sequence=1)=>domainEventToTimelineEntry(domainEvent,{sequence,recordedAt:new Date(Date.parse(domainEvent.occurredAt)+1000).toISOString(),source:'operational-ledger'})

test('proyecta eventos a entradas legibles del timeline',()=>{
 const entry=domainEventToTimelineEntry(event(),{sequence:4,recordedAt:'2026-07-31T21:00:01.000Z'})
 assert.equal(entry.title,'Sede creada')
 assert.equal(entry.category,'Organización')
 assert.equal(entry.summary,'Canapa · Villeta')
 assert.equal(entry.actorName,'Fer')
 assert.equal(entry.aggregateId,'site-1')
 assert.equal(entry.sequence,4)
 assert.equal(entry.recordedAt,'2026-07-31T21:00:01.000Z')
 assert.ok(Object.isFrozen(entry))
})

test('registra entradas del Ledger sin duplicar por eventId',()=>{
 const timeline=createTimelineEngine(),entry=ledgerTimelineEntry(event())
 timeline.record(entry)
 timeline.record(entry)
 assert.equal(timeline.size(),1)
 assert.equal(timeline.getById('event-1').id,'event-1')
})

test('consulta por empresa, sede, objeto, texto y rango de fechas',()=>{
 const timeline=createTimelineEngine()
 timeline.record(ledgerTimelineEntry(event(),1))
 timeline.record(ledgerTimelineEntry(event({eventId:'event-2',aggregateId:'site-2',siteId:'site-2',occurredAt:'2026-08-01T10:00:00.000Z',payload:{label:'Canapa · Villa de Leyva'}}),2))
 assert.equal(timeline.query({organizationId:'company-1'}).length,2)
 assert.equal(timeline.query({siteId:'site-1'}).length,1)
 assert.equal(timeline.query({aggregateId:'site-2'}).length,1)
 assert.equal(timeline.query({search:'villa de leyva'}).length,1)
 assert.equal(timeline.query({from:'2026-08-01T00:00:00.000Z'}).length,1)
})

test('ordena por fecha y usa secuencia como desempate estable',()=>{
 const timeline=createTimelineEngine()
 timeline.record(domainEventToTimelineEntry(event(),{sequence:2}))
 timeline.record(domainEventToTimelineEntry(event({eventId:'event-2'}),{sequence:1}))
 assert.deepEqual(timeline.query({order:'asc'}).map(item=>item.id),['event-2','event-1'])
 assert.equal(timeline.query({limit:1})[0].id,'event-1')
})

test('rechaza la conexión directa y declara autoridad del Ledger',()=>{
 const timeline=createTimelineEngine()
 assert.throws(()=>timeline.connect({subscribe(){}}),/deprecada/)
 assert.throws(()=>timeline.recordEvent(event()),/deprecada/)
 assert.equal(timeline.health().connected,false)
 assert.equal(timeline.health().authority,'operational-ledger')
})

test('rehidrata entradas persistidas sin duplicados y de forma atómica',()=>{
 const timeline=createTimelineEngine()
 const first=domainEventToTimelineEntry(event(),{sequence:1})
 const second=domainEventToTimelineEntry(event({eventId:'event-2',occurredAt:'2026-08-01T10:00:00.000Z'}),{sequence:2})
 assert.equal(timeline.hydrate([second,first,first]),2)
 assert.deepEqual(timeline.query({order:'asc'}).map(item=>item.id),['event-1','event-2'])
 assert.throws(()=>timeline.hydrate([first,{id:'invalid'}]),/contrato requerido/)
 assert.deepEqual(timeline.query({order:'asc'}).map(item=>item.id),['event-1','event-2'])
})

test('incrementa revisión aunque el snapshot conserve el mismo tamaño',()=>{
 const timeline=createTimelineEngine()
 const first=domainEventToTimelineEntry(event(),{sequence:1})
 const replacement=domainEventToTimelineEntry(event({eventId:'event-2',aggregateId:'site-2'}),{sequence:2})
 timeline.hydrate([first])
 const before=timeline.getVersion()
 timeline.hydrate([replacement])
 assert.equal(timeline.size(),1)
 assert.ok(timeline.getVersion()>before)
 assert.equal(timeline.getById('event-1'),null)
 assert.equal(timeline.getById('event-2').aggregateId,'site-2')
})

test('recorta historial e índice de forma coherente',()=>{
 const timeline=createTimelineEngine({maxEntries:2})
 timeline.record(domainEventToTimelineEntry(event(),{sequence:1}))
 timeline.record(domainEventToTimelineEntry(event({eventId:'event-2',occurredAt:'2026-08-01T10:00:00.000Z'}),{sequence:2}))
 timeline.record(domainEventToTimelineEntry(event({eventId:'event-3',occurredAt:'2026-08-02T10:00:00.000Z'}),{sequence:3}))
 assert.equal(timeline.size(),2)
 assert.equal(timeline.getById('event-1'),null)
 assert.deepEqual(timeline.query({order:'asc'}).map(item=>item.id),['event-2','event-3'])
})

test('rechaza límites y entradas inválidas',()=>{
 assert.throws(()=>createTimelineEngine({maxEntries:0}),/entero positivo/)
 assert.throws(()=>createTimelineEngine({maxObserverErrors:0}),/entero positivo/)
 assert.throws(()=>createTimelineEngine({onObserverError:'invalid'}),/debe ser una función/)
 const timeline=createTimelineEngine()
 assert.throws(()=>timeline.record({id:'event-x'}),/contrato requerido/)
})

test('migra Timeline y Operational Ledger al esquema persistente actual',()=>{
 const domainEvent=event()
 const entry=domainEventToTimelineEntry(domainEvent)
 const ledgerEntry=createLedgerEntry(domainEvent,{sequence:4,recordedAt:'2026-07-31T21:00:01.000Z'})
 const state=migrateState({timelineEntries:[entry,entry],operationalLedgerEntries:[ledgerEntry,ledgerEntry]})
 assert.equal(CURRENT_SCHEMA_VERSION,10)
 assert.equal(state.schemaVersion,10)
 assert.equal(state.timelineEntries.length,1)
 assert.equal(state.operationalLedgerEntries.length,1)
 assert.equal(state.operationalLedgerEntries[0].sequence,4)
})

test('el Timeline se reconcilia desde el Ledger del workspace activo',async()=>{
 const source=await readFile(new URL('../src/core/timeline/DomainEventTimelineBridge.jsx',import.meta.url),'utf8')
 assert.match(source,/getOperationalLedgerForScope\(scope\)/)
 assert.match(source,/getTimelineEngineForScope\(scope\)/)
 assert.match(source,/ledger\.subscribe/)
 assert.match(source,/timeline\.hydrate/)
 assert.match(source,/organizationId===companyId/)
 assert.match(source,/timelineEntries:\[\.\.\.foreign,\.\.\.canonical\]/)
 assert.match(source,/projectLedgerEntry/)
 assert.match(source,/sequence:ledgerEntry\.sequence/)
 assert.doesNotMatch(source,/import\{[^}]*operationalLedger[^}]*\}/)
 assert.doesNotMatch(source,/import\{[^}]*timelineEngine[^}]*\}/)
 assert.doesNotMatch(source,/eventBus\.subscribe/)
 assert.match(source,/sync:false,audit:false/)
 assert.match(source,/limit:2000/)
})