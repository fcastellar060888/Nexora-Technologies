import test from'node:test'
import assert from'node:assert/strict'
import{createDomainEvent,createEventBus,DomainEvents}from'../src/core/events/index.js'

const base={name:DomainEvents.COMPANY_CREATED,aggregateType:'company',aggregateId:'company-1',organizationId:'company-1',actorId:'user-1',occurredAt:'2026-08-03T06:30:00.000Z'}

test('reauditoría A6: el contrato copia y congela profundamente datos JSON',()=>{
 const source={name:'Nexora',sites:[{id:'site-1',active:true}]}
 const event=createDomainEvent({...base,eventId:'immutable-json',payload:source})
 source.name='Alterado'
 source.sites[0].active=false
 source.sites.push({id:'site-2',active:true})
 assert.deepEqual(event.payload,{name:'Nexora',sites:[{id:'site-1',active:true}]})
 assert.ok(Object.isFrozen(event.payload.sites))
 assert.ok(Object.isFrozen(event.payload.sites[0]))
 assert.throws(()=>{event.payload.sites[0].active=false},TypeError)
})

test('reauditoría A6: rechaza mutabilidad oculta y valores que divergen al persistir',()=>{
 const cycle={};cycle.self=cycle
 const invalid=[
  {payload:{value:new Map()}},
  {payload:{value:new Set()}},
  {payload:{value:10n}},
  {payload:{value:undefined}},
  {payload:{value:Number.NaN}},
  {payload:{value:Number.POSITIVE_INFINITY}},
  {payload:cycle}
 ]
 for(const [index,overrides]of invalid.entries())assert.throws(()=>createDomainEvent({...base,eventId:`invalid-${index}`,...overrides}))
})

test('reauditoría A6: todo evento aceptado conserva identidad tras roundtrip JSON',async()=>{
 const bus=createEventBus()
 let calls=0
 bus.subscribe('*',()=>{calls+=1})
 const original=createDomainEvent({...base,eventId:'json-roundtrip',payload:{name:'Nexora',nested:[1,true,null,{site:'Villeta'}]}})
 const serialized=JSON.parse(JSON.stringify(original))
 await bus.publish(original)
 const replay=await bus.publish(serialized)
 assert.equal(replay.duplicate,true)
 assert.equal(calls,1)
})
