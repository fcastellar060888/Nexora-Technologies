import test from'node:test'
import assert from'node:assert/strict'
import{createTimelineEngine}from'../src/core/timeline/index.js'

const entry=overrides=>({
 id:'event-1',
 eventName:'cultivation.plant.inspected',
 source:'event-bus',
 sequence:null,
 occurredAt:'2026-08-03T13:00:00.000Z',
 recordedAt:null,
 organizationId:'company-a',
 aggregateType:'cultivation.plant',
 aggregateId:'plant-1',
 title:'Inspección',
 summary:'Pendiente de Ledger',
 payload:{health:{score:90}},
 metadata:{actorName:'Fer'},
 ...overrides
})

test('AUD-F013: una entrada del Ledger enriquece la versión previa del Event Bus',()=>{
 const timeline=createTimelineEngine()
 timeline.record(entry())
 const enriched=timeline.record(entry({
  source:'operational-ledger',
  sequence:7,
  recordedAt:'2026-08-03T13:00:01.000Z',
  summary:'Confirmada por Ledger',
  metadata:{actorName:'Fer',tone:'success'}
 }))
 assert.equal(timeline.size(),1)
 assert.equal(enriched.source,'operational-ledger')
 assert.equal(enriched.sequence,7)
 assert.equal(enriched.summary,'Confirmada por Ledger')
 assert.equal(timeline.getById('event-1'),enriched)
})

test('AUD-F013: una fuente inferior no degrada evidencia canónica',()=>{
 const timeline=createTimelineEngine()
 const canonical=timeline.record(entry({source:'operational-ledger',sequence:7,recordedAt:'2026-08-03T13:00:01.000Z',summary:'Canónica'}))
 const result=timeline.record(entry({source:'event-bus',summary:'Versión tardía incompleta'}))
 assert.equal(result,canonical)
 assert.equal(timeline.getById('event-1').summary,'Canónica')
})

test('AUD-F013: evidencia más reciente de la misma fuente puede reconciliar contenido',()=>{
 const timeline=createTimelineEngine()
 timeline.record(entry({source:'operational-ledger',sequence:7,recordedAt:'2026-08-03T13:00:01.000Z',summary:'Primera'}))
 timeline.record(entry({source:'operational-ledger',sequence:8,recordedAt:'2026-08-03T13:00:02.000Z',summary:'Enriquecida'}))
 assert.equal(timeline.size(),1)
 assert.equal(timeline.getById('event-1').sequence,8)
 assert.equal(timeline.getById('event-1').summary,'Enriquecida')
})

test('AUD-F013: contradicciones de identidad se rechazan sin modificar el Timeline',()=>{
 const timeline=createTimelineEngine()
 const original=timeline.record(entry({source:'operational-ledger',sequence:7}))
 assert.throws(()=>timeline.record(entry({source:'operational-ledger',sequence:8,aggregateId:'plant-2'})),/contradice su identidad canónica/)
 assert.equal(timeline.size(),1)
 assert.equal(timeline.getById('event-1'),original)
})

test('AUD-F013: hydrate reconcilia duplicados y falla atómicamente ante contradicciones',()=>{
 const timeline=createTimelineEngine()
 const direct=entry()
 const ledger=entry({source:'operational-ledger',sequence:7,recordedAt:'2026-08-03T13:00:01.000Z',summary:'Canónica'})
 assert.equal(timeline.hydrate([direct,ledger]),1)
 assert.equal(timeline.getById('event-1').source,'operational-ledger')
 const before=timeline.getById('event-1')
 assert.throws(()=>timeline.hydrate([ledger,entry({source:'operational-ledger',sequence:8,eventName:'otro.evento'})]),/contradice su identidad canónica/)
 assert.equal(timeline.getById('event-1'),before)
})
