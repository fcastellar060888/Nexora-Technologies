import test from'node:test'
import assert from'node:assert/strict'
import{createTimelineEngine}from'../src/core/timeline/index.js'

const entry=overrides=>({
 id:'event-1',eventName:'cultivation.plant.inspected',source:'operational-ledger',sequence:1,
 occurredAt:'2026-08-03T13:00:00.000Z',recordedAt:'2026-08-03T13:00:01.000Z',
 organizationId:'company-a',aggregateType:'cultivation.plant',aggregateId:'plant-1',
 title:'Inspección',summary:'Sin novedad',payload:{health:{score:90},tags:['ok']},
 metadata:{actor:{id:'user-1',roles:['admin']}},...overrides
})

test('AUD-F014: record clona y congela profundamente sin compartir referencias',()=>{
 const timeline=createTimelineEngine()
 const source=entry()
 const stored=timeline.record(source)
 source.payload.health.score=10
 source.payload.tags.push('mutated')
 source.metadata.actor.roles[0]='viewer'
 assert.equal(stored.payload.health.score,90)
 assert.deepEqual(stored.payload.tags,['ok'])
 assert.deepEqual(stored.metadata.actor.roles,['admin'])
 assert.notEqual(stored.payload,source.payload)
 assert.ok(Object.isFrozen(stored))
 assert.ok(Object.isFrozen(stored.payload))
 assert.ok(Object.isFrozen(stored.payload.health))
 assert.ok(Object.isFrozen(stored.payload.tags))
 assert.throws(()=>{stored.payload.health.score=1},TypeError)
 assert.throws(()=>{stored.payload.tags.push('x')},TypeError)
})

test('AUD-F014: hydrate aísla profundamente cada entrada persistida',()=>{
 const timeline=createTimelineEngine()
 const source=entry()
 timeline.hydrate([source])
 source.metadata.actor.id='attacker'
 const stored=timeline.getById('event-1')
 assert.equal(stored.metadata.actor.id,'user-1')
 assert.throws(()=>{stored.metadata.actor.id='other'},TypeError)
})

test('AUD-F014: query no expone referencias mutables internas',()=>{
 const timeline=createTimelineEngine()
 timeline.record(entry())
 const result=timeline.query({order:'asc'})
 assert.throws(()=>{result[0].payload.health.score=0},TypeError)
 assert.equal(timeline.getById('event-1').payload.health.score,90)
 result.pop()
 assert.equal(timeline.size(),1)
})

test('AUD-F014: ciclos y estructuras no contractuales se rechazan sin modificar estado',()=>{
 const timeline=createTimelineEngine()
 timeline.record(entry())
 const cyclic=entry({id:'event-2',sequence:2,payload:{}})
 cyclic.payload.self=cyclic.payload
 assert.throws(()=>timeline.record(cyclic),/cíclicas/)
 assert.throws(()=>timeline.record(entry({id:'event-3',sequence:3,payload:{map:new Map([['a',1]])}})),/objetos planos/)
 assert.deepEqual(timeline.query({order:'asc'}).map(item=>item.id),['event-1'])
})

test('AUD-F014: hydrate conserva atomicidad ante una entrada anidada inválida',()=>{
 const timeline=createTimelineEngine()
 timeline.record(entry())
 const valid=entry({id:'event-2',sequence:2,aggregateId:'plant-2'})
 const invalid=entry({id:'event-3',sequence:3,aggregateId:'plant-3',payload:{bad:new Set(['x'])}})
 assert.throws(()=>timeline.hydrate([valid,invalid]),/objetos planos/)
 assert.deepEqual(timeline.query({order:'asc'}).map(item=>item.id),['event-1'])
})
