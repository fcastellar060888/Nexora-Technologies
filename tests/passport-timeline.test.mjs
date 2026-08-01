import test from'node:test'
import assert from'node:assert/strict'
import{composePassportTimeline}from'../src/core/passport/passportTimeline.js'

const canonical={id:'event-1',eventName:'mipe.finding.recorded',occurredAt:'2026-08-01T10:00:00.000Z',organizationId:'company-1',aggregateType:'cultivation.materialplant',aggregateId:'plant-1',title:'Hallazgo MIPE registrado',category:'MIPE',payload:{findingId:'finding-1'}}
const legacy={id:'mipe:finding-1',sourceId:'finding-1',occurredAt:'2026-08-01T10:00:00.000Z',title:'Botrytis',category:'MIPE'}

test('prioriza el Timeline canónico y elimina el respaldo heredado equivalente',()=>{
 const result=composePassportTimeline({canonical:[canonical],legacy:[legacy],aggregateId:'plant-1'})
 assert.equal(result.length,1)
 assert.equal(result[0].id,'event-1')
 assert.equal(result[0].source,'canonical')
})

test('conserva eventos heredados cuando aún no existe proyección canónica',()=>{
 const result=composePassportTimeline({canonical:[],legacy:[legacy],aggregateId:'plant-1'})
 assert.equal(result.length,1)
 assert.equal(result[0].id,'mipe:finding-1')
 assert.equal(result[0].source,'legacy')
})

test('aísla el historial canónico por objeto y ordena de forma estable',()=>{
 const other={...canonical,id:'event-other',aggregateId:'plant-2'}
 const older={id:'plant:observation-1',sourceId:'observation-1',occurredAt:'2026-07-31T10:00:00.000Z',title:'Observación',category:'Cultivo'}
 const result=composePassportTimeline({canonical:[other,canonical],legacy:[older],aggregateId:'plant-1'})
 assert.deepEqual(result.map(item=>item.id),['event-1','plant:observation-1'])
 assert.ok(Object.isFrozen(result))
})
