import test from'node:test'
import assert from'node:assert/strict'
import{createDomainEvent,createEventBus,DomainEvents}from'../src/core/events/index.js'

const event=(id,payload={name:'Nexora'})=>createDomainEvent({name:DomainEvents.COMPANY_CREATED,aggregateType:'company',aggregateId:'company-1',organizationId:'company-1',actorId:'user-1',occurredAt:'2026-08-03T06:00:00.000Z',eventId:id,payload})

test('reauditoría A4: clear rechaza limpiar mientras una publicación está activa',async()=>{
 const bus=createEventBus()
 let release,calls=0
 const gate=new Promise(resolve=>{release=resolve})
 bus.subscribe('*',async()=>{calls+=1;await gate})
 const item=event('clear-in-flight')
 const running=bus.publish(item)
 await Promise.resolve()
 assert.throws(()=>bus.clear(),/publicaciones activas/)
 const concurrent=bus.publish(item)
 release()
 const[first,second]=await Promise.all([running,concurrent])
 assert.equal(calls,1)
 assert.equal(first.duplicate,false)
 assert.equal(second.duplicate,true)
 assert.equal(second.inFlight,true)
 assert.equal(second.pending,true)
 assert.equal(bus.getHistory().length,1)
 bus.clear()
 assert.equal(bus.getHistory().length,0)
})

test('reauditoría A4: identidad canónica no depende del orden de propiedades',async()=>{
 const bus=createEventBus()
 let calls=0
 bus.subscribe('*',()=>{calls+=1})
 const first=event('canonical-order',{name:'Nexora',details:{site:'Villeta',active:true}})
 const reordered=event('canonical-order',{details:{active:true,site:'Villeta'},name:'Nexora'})
 await bus.publish(first)
 const replay=await bus.publish(reordered)
 assert.equal(replay.duplicate,true)
 assert.equal(calls,1)
})

test('reauditoría A4: identidad distingue tipos y rechaza estructuras no persistibles',async()=>{
 const bus=createEventBus()
 await bus.publish(event('typed-identity',{value:1}))
 await assert.rejects(()=>bus.publish(event('typed-identity',{value:'1'})),/contenido diferente/)
 assert.throws(()=>event('bigint-identity',{value:10n}),/JSON serializables/)
 assert.throws(()=>event('map-identity',{value:new Map([['key','value']])}),/objetos planos/)
 assert.throws(()=>event('set-identity',{value:new Set(['value'])}),/objetos planos/)
})

test('reauditoría A4: una limpieza válida elimina deduplicación y suscripciones',async()=>{
 const bus=createEventBus()
 let calls=0
 bus.subscribe('*',()=>{calls+=1})
 const item=event('clear-completed')
 await bus.publish(item)
 bus.clear()
 const result=await bus.publish(item)
 assert.equal(result.duplicate,false)
 assert.equal(result.delivered,0)
 assert.equal(calls,1)
})
