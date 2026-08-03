import test from'node:test'
import assert from'node:assert/strict'
import{readFile}from'node:fs/promises'
import{createDomainEvent,DomainEvents}from'../src/core/events/index.js'
import{domainEventToTimelineEntry}from'../src/core/timeline/index.js'

const event=overrides=>createDomainEvent({
 name:DomainEvents.SITE_CREATED,
 aggregateType:'site',
 aggregateId:'site-1',
 organizationId:'company-1',
 siteId:'site-1',
 actorId:'user-1',
 occurredAt:'2026-08-03T13:00:00.000Z',
 eventId:'event-1',
 payload:{label:'Villeta'},
 ...overrides
})

test('AUD-F011: una proyección del Ledger declara fuente canónica',()=>{
 const entry=domainEventToTimelineEntry(event(),{sequence:7,recordedAt:'2026-08-03T13:01:00.000Z'})
 assert.equal(entry.source,'operational-ledger')
 assert.equal(entry.sequence,7)
 assert.equal(entry.recordedAt,'2026-08-03T13:01:00.000Z')
})

test('AUD-F011: la compatibilidad directa declara una fuente distinta y explícita',()=>{
 const entry=domainEventToTimelineEntry(event())
 assert.equal(entry.source,'event-bus')
 assert.equal(entry.sequence,null)
 assert.equal(entry.recordedAt,null)
})

test('AUD-F011: una fuente desconocida se rechaza',()=>{
 assert.throws(()=>domainEventToTimelineEntry(event(),{source:'legacy-implicit'}),/fuente del Timeline no es válida/)
})

test('AUD-F011: el bridge hidrata exclusivamente proyecciones del Ledger',async()=>{
 const source=await readFile(new URL('../src/core/timeline/DomainEventTimelineBridge.jsx',import.meta.url),'utf8')
 assert.match(source,/timeline\.hydrate\(projected\)/)
 assert.match(source,/source:'operational-ledger'/)
 assert.doesNotMatch(source,/historicalById/)
 assert.doesNotMatch(source,/timeline\.hydrate\(\[\.\.\.historical/)
 assert.doesNotMatch(source,/projected\.forEach\(item=>historicalById/)
})

test('AUD-F011: el estado persistido del tenant se reemplaza por la proyección canónica',async()=>{
 const source=await readFile(new URL('../src/core/timeline/DomainEventTimelineBridge.jsx',import.meta.url),'utf8')
 assert.match(source,/const current=\(state\.timelineEntries\|\|\[\]\)\.filter/)
 assert.match(source,/timelineEntries:\[\.\.\.foreign,\.\.\.canonical\]/)
 assert.match(source,/operationalLedgerEntries/)
})
