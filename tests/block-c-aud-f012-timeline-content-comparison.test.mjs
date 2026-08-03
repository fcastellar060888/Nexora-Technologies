import test from'node:test'
import assert from'node:assert/strict'
import{readFile}from'node:fs/promises'
import{timelineEntryFingerprint,timelineEntriesEqual}from'../src/core/timeline/index.js'

const entry=overrides=>({
 id:'event-1',
 eventName:'cultivation.plant.inspected',
 source:'operational-ledger',
 sequence:7,
 occurredAt:'2026-08-03T13:00:00.000Z',
 recordedAt:'2026-08-03T13:00:01.000Z',
 organizationId:'company-a',
 siteId:undefined,
 aggregateType:'cultivation.plant',
 aggregateId:'plant-1',
 correlationId:undefined,
 title:'Inspección',
 summary:'Sin novedad',
 payload:{health:{score:90,status:'healthy'}},
 metadata:{actorName:'Fer',tone:'success'},
 ...overrides
})

test('AUD-F012: el orden de propiedades no altera la identidad de contenido',()=>{
 const left=entry({siteId:'site-1',correlationId:'corr-1'})
 const right={
  metadata:{tone:'success',actorName:'Fer'},
  payload:{health:{status:'healthy',score:90}},
  summary:'Sin novedad',title:'Inspección',correlationId:'corr-1',aggregateId:'plant-1',aggregateType:'cultivation.plant',
  siteId:'site-1',organizationId:'company-a',recordedAt:'2026-08-03T13:00:01.000Z',occurredAt:'2026-08-03T13:00:00.000Z',
  sequence:7,source:'operational-ledger',eventName:'cultivation.plant.inspected',id:'event-1'
 }
 assert.equal(timelineEntryFingerprint(left),timelineEntryFingerprint(right))
 assert.equal(timelineEntriesEqual([left],[right]),true)
})

test('AUD-F012: cambios de payload se detectan aunque id y sequence sean iguales',()=>{
 const current=entry()
 const canonical=entry({payload:{health:{score:40,status:'critical'}}})
 assert.equal(current.id,canonical.id)
 assert.equal(current.sequence,canonical.sequence)
 assert.equal(timelineEntriesEqual([current],[canonical]),false)
})

test('AUD-F012: cambios de metadata y presentación también invalidan el snapshot',()=>{
 const current=entry()
 assert.equal(timelineEntriesEqual([current],[entry({metadata:{actorName:'Otro',tone:'danger'}})]),false)
 assert.equal(timelineEntriesEqual([current],[entry({summary:'Hallazgo crítico'})]),false)
 assert.equal(timelineEntriesEqual([current],[entry({title:'Inspección actualizada'})]),false)
})

test('AUD-F012: longitud y orden forman parte de la colección canónica',()=>{
 const first=entry()
 const second=entry({id:'event-2',sequence:8,aggregateId:'plant-2'})
 assert.equal(timelineEntriesEqual([first],[first,second]),false)
 assert.equal(timelineEntriesEqual([first,second],[second,first]),false)
})

test('AUD-F012: campos undefined convergen tras persistencia JSON sin escrituras repetidas',()=>{
 const canonical=entry()
 const persisted=JSON.parse(JSON.stringify(canonical))
 assert.equal(Object.hasOwn(persisted,'siteId'),false)
 assert.equal(Object.hasOwn(persisted,'correlationId'),false)
 assert.equal(timelineEntriesEqual([canonical],[persisted]),true)
})

test('AUD-F012: null explícito sigue siendo distinto de una propiedad ausente',()=>{
 const absent=JSON.parse(JSON.stringify(entry()))
 const explicitNull={...absent,siteId:null}
 assert.equal(timelineEntriesEqual([absent],[explicitNull]),false)
})

test('AUD-F012: el bridge usa comparación estructural y no JSON.stringify directo',async()=>{
 const source=await readFile(new URL('../src/core/timeline/DomainEventTimelineBridge.jsx',import.meta.url),'utf8')
 assert.match(source,/timelineEntriesEqual\(current,canonical\)/)
 assert.doesNotMatch(source,/JSON\.stringify\(item\)/)
})
