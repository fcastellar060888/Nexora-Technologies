import test from'node:test'
import assert from'node:assert/strict'
import{createDomainEvent,createEventBus,DomainEvents}from'../src/core/events/index.js'

const base={name:DomainEvents.COMPANY_CREATED,aggregateType:'company',aggregateId:'company-1',organizationId:'company-1',actorId:'user-1',occurredAt:'2026-08-03T07:00:00.000Z'}

test('reauditoría A7: conserva una clave propia __proto__ sin alterar el prototipo',async()=>{
 const payload=Object.create(null)
 Object.defineProperty(payload,'__proto__',{value:{polluted:true},enumerable:true,writable:true,configurable:true})
 payload.name='Nexora'
 const event=createDomainEvent({...base,eventId:'proto-key',payload})
 assert.equal(Object.getPrototypeOf(event.payload),Object.prototype)
 assert.equal(Object.hasOwn(event.payload,'__proto__'),true)
 assert.deepEqual(event.payload.__proto__,{polluted:true})
 assert.equal({}.polluted,undefined)
 const roundtrip=JSON.parse(JSON.stringify(event))
 const bus=createEventBus()
 await bus.publish(event)
 assert.equal((await bus.publish(roundtrip)).duplicate,true)
})

test('reauditoría A7: rechaza getters en objetos sin ejecutarlos',()=>{
 let reads=0
 const payload={name:'Nexora'}
 Object.defineProperty(payload,'dynamic',{enumerable:true,get(){reads+=1;return reads}})
 assert.throws(()=>createDomainEvent({...base,eventId:'object-getter',payload}),/propiedad accesora/)
 assert.equal(reads,0)
})

test('reauditoría A7: rechaza getters en posiciones de arreglos sin ejecutarlos',()=>{
 let reads=0
 const values=[]
 Object.defineProperty(values,'0',{enumerable:true,configurable:true,get(){reads+=1;return reads}})
 values.length=1
 assert.throws(()=>createDomainEvent({...base,eventId:'array-getter',payload:{values}}),/propiedad accesora/)
 assert.equal(reads,0)
})

test('reauditoría A7: múltiples roundtrips JSON conservan identidad y deduplicación',async()=>{
 const original=createDomainEvent({...base,eventId:'multi-roundtrip',payload:{name:'Nexora',nested:{values:[0,-0,1.5,null,true]}}})
 let restored=original
 for(let index=0;index<5;index+=1)restored=JSON.parse(JSON.stringify(restored))
 assert.deepEqual(restored,JSON.parse(JSON.stringify(original)))
 const bus=createEventBus()
 let calls=0
 bus.subscribe('*',()=>{calls+=1})
 await bus.publish(original)
 assert.equal((await bus.publish(restored)).duplicate,true)
 assert.equal(calls,1)
})

test('reauditoría A7: rechaza coerción silenciosa de identificadores',()=>{
 const invalid=[
  {eventId:{}},
  {aggregateId:['company-1']},
  {organizationId:42},
  {actorId:Symbol('user')},
  {siteId:{}},
  {correlationId:99},
  {causationId:[]}
 ]
 for(const [index,overrides]of invalid.entries())assert.throws(()=>createDomainEvent({...base,eventId:`strict-${index}`,...overrides}),/debe ser texto/)
})

test('reauditoría A7: normaliza únicamente texto contractual',()=>{
 const event=createDomainEvent({...base,eventId:'  event-trimmed  ',siteId:'  site-1  ',correlationId:'  corr-1  ',causationId:'  cause-1  '})
 assert.equal(event.eventId,'event-trimmed')
 assert.equal(event.context.siteId,'site-1')
 assert.equal(event.correlationId,'corr-1')
 assert.equal(event.causationId,'cause-1')
})
