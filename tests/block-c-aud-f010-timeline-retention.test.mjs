import test from'node:test'
import assert from'node:assert/strict'
import{createDomainEvent}from'../src/core/events/index.js'
import{createTimelineEngine,domainEventToTimelineEntry}from'../src/core/timeline/index.js'

const entry=({id,occurredAt,recordedAt,sequence})=>domainEventToTimelineEntry(createDomainEvent({
 eventId:id,
 name:'cultivation.plant.inspected',
 aggregateType:'cultivation.plant',
 aggregateId:`plant-${id}`,
 organizationId:'company-1',
 actorId:'user-1',
 occurredAt,
 payload:{label:id}
}),{recordedAt,sequence})

test('AUD-F010: un evento histórico recién confirmado no se elimina por occurredAt',()=>{
 const timeline=createTimelineEngine({maxEntries:2})
 timeline.record(entry({id:'ledger-10',occurredAt:'2026-08-01T10:00:00.000Z',recordedAt:'2026-08-03T10:00:00.000Z',sequence:10}))
 timeline.record(entry({id:'ledger-11',occurredAt:'2026-08-02T10:00:00.000Z',recordedAt:'2026-08-03T10:01:00.000Z',sequence:11}))
 timeline.record(entry({id:'ledger-12-historical',occurredAt:'2020-01-01T00:00:00.000Z',recordedAt:'2026-08-03T10:02:00.000Z',sequence:12}))
 assert.equal(timeline.getById('ledger-10'),null)
 assert.ok(timeline.getById('ledger-11'))
 assert.ok(timeline.getById('ledger-12-historical'))
 assert.deepEqual(timeline.query({order:'asc'}).map(item=>item.id),['ledger-12-historical','ledger-11'])
})

test('AUD-F010: hydrate retiene las secuencias más nuevas sin alterar orden visual',()=>{
 const timeline=createTimelineEngine({maxEntries:2})
 timeline.hydrate([
  entry({id:'seq-21',occurredAt:'2026-08-02T00:00:00.000Z',recordedAt:'2026-08-03T11:01:00.000Z',sequence:21}),
  entry({id:'seq-22-old-date',occurredAt:'2019-01-01T00:00:00.000Z',recordedAt:'2026-08-03T11:02:00.000Z',sequence:22}),
  entry({id:'seq-20',occurredAt:'2026-08-03T00:00:00.000Z',recordedAt:'2026-08-03T11:00:00.000Z',sequence:20})
 ])
 assert.equal(timeline.getById('seq-20'),null)
 assert.deepEqual(timeline.query({order:'asc'}).map(item=>item.id),['seq-22-old-date','seq-21'])
})

test('AUD-F010: recordedAt gobierna retención cuando no existe secuencia',()=>{
 const timeline=createTimelineEngine({maxEntries:1})
 timeline.record(entry({id:'older-ingestion',occurredAt:'2026-08-03T12:00:00.000Z',recordedAt:'2026-08-03T12:00:00.000Z',sequence:null}))
 timeline.record(entry({id:'newer-ingestion-historical',occurredAt:'2018-01-01T00:00:00.000Z',recordedAt:'2026-08-03T12:01:00.000Z',sequence:null}))
 assert.equal(timeline.getById('older-ingestion'),null)
 assert.ok(timeline.getById('newer-ingestion-historical'))
})
