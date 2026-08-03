import test from'node:test'
import assert from'node:assert/strict'
import{createDomainEvent,createEventBus,DomainEvents,isKnownDomainEvent}from'../src/core/events/index.js'
import{isDomainEvent}from'../src/core/events/eventContract.js'

const base={
 name:DomainEvents.COMPANY_CREATED,
 aggregateType:'company',
 aggregateId:'company-1',
 organizationId:'company-1',
 actorId:'user-1',
 occurredAt:'2026-07-31T20:00:00.000Z',
 payload:{name:'Canapa',details:{source:'manual'}}
}

test('crea un evento de dominio profundamente inmutable y trazable',()=>{
 const event=createDomainEvent(base)
 assert.equal(event.name,'organization.company.created')
 assert.equal(event.aggregate.id,'company-1')
 assert.equal(event.context.organizationId,'company-1')
 assert.equal(event.occurredAt,'2026-07-31T20:00:00.000Z')
 assert.ok(Object.isFrozen(event));assert.ok(Object.isFrozen(event.aggregate));assert.ok(Object.isFrozen(event.context));assert.ok(Object.isFrozen(event.payload));assert.ok(Object.isFrozen(event.payload.details))
 assert.throws(()=>{event.payload.details.source='altered'},TypeError)
})

test('rechaza eventos sin formato dominio.entidad.accion',()=>{assert.throws(()=>createDomainEvent({...base,name:'companyCreated'}),/formato dominio\.entidad\.accion/)})

test('la validación no completa silenciosamente identidad ni versión faltantes',()=>{
 const valid=createDomainEvent({...base,eventId:'event-1',version:2})
 const{eventId,...withoutId}=valid
 const{version,...withoutVersion}=valid
 assert.equal(isDomainEvent(valid),true);assert.equal(isDomainEvent(withoutId),false);assert.equal(isDomainEvent(withoutVersion),false)
})

test('publica a suscriptores específicos y universales',async()=>{
 const bus=createEventBus(),received=[]
 bus.subscribe(DomainEvents.COMPANY_CREATED,event=>received.push(`specific:${event.aggregate.id}`))
 bus.subscribe('*',event=>received.push(`all:${event.name}`))
 const result=await bus.publish(createDomainEvent(base))
 assert.equal(result.delivered,2);assert.equal(result.failed,0);assert.equal(result.duplicate,false);assert.equal(result.pending,false)
 assert.deepEqual(received,['specific:company-1','all:organization.company.created'])
})

test('un suscriptor puede cancelarse sin afectar a los demás',async()=>{
 const bus=createEventBus(),received=[]
 const unsubscribe=bus.subscribe(DomainEvents.COMPANY_CREATED,()=>received.push('removed'))
 bus.subscribe('*',()=>received.push('active'));unsubscribe();await bus.publish(createDomainEvent(base))
 assert.deepEqual(received,['active'])
})

test('conserva historia filtrable por evento y objeto',async()=>{
 const bus=createEventBus()
 await bus.publish(createDomainEvent({...base,eventId:'event-1'}))
 await bus.publish(createDomainEvent({...base,eventId:'event-2',aggregateId:'company-2',organizationId:'company-2'}))
 assert.equal(bus.getHistory({name:DomainEvents.COMPANY_CREATED}).length,2)
 assert.equal(bus.getHistory({aggregateId:'company-1'}).length,1)
})

test('ignora la republicación del mismo eventId después de una entrega completa',async()=>{
 const bus=createEventBus(),received=[]
 const event=createDomainEvent({...base,eventId:'event-duplicate'})
 bus.subscribe('*',item=>received.push(item.eventId))
 const first=await bus.publish(event),second=await bus.publish(event)
 assert.equal(first.duplicate,false);assert.equal(second.duplicate,true);assert.equal(second.delivered,0)
 assert.deepEqual(received,['event-duplicate']);assert.equal(bus.getHistory().length,1)
})

test('reintenta solo los suscriptores fallidos antes de confirmar la deduplicación',async()=>{
 const reported=[],calls={stable:0,transient:0};let fail=true
 const bus=createEventBus({onError:(error,event)=>{reported.push(`${event.eventId}:${error.message}`);throw new Error('telemetría caída')}})
 bus.subscribe('*',()=>{calls.stable+=1})
 bus.subscribe('*',()=>{calls.transient+=1;if(fail)throw new Error('Ledger temporalmente indisponible')})
 const event=createDomainEvent({...base,eventId:'event-retry'})
 const first=await bus.publish(event)
 assert.equal(first.failed,1);assert.equal(first.pending,true);assert.equal(first.retry,false);assert.equal(bus.getHistory().length,0);assert.equal(bus.getPendingFailures()[0].failedHandlers,1)
 assert.deepEqual(calls,{stable:1,transient:1})
 fail=false
 const second=await bus.publish(event)
 assert.equal(second.failed,0);assert.equal(second.pending,false);assert.equal(second.retry,true);assert.equal(second.delivered,1)
 assert.deepEqual(calls,{stable:1,transient:2});assert.equal(bus.getHistory().length,1);assert.equal(bus.getPendingFailures().length,0)
 const duplicate=await bus.publish(event)
 assert.equal(duplicate.duplicate,true);assert.deepEqual(calls,{stable:1,transient:2});assert.deepEqual(reported,['event-retry:Ledger temporalmente indisponible'])
})

test('comparte una sola ejecución para publicaciones concurrentes del mismo evento',async()=>{
 const bus=createEventBus(),event=createDomainEvent({...base,eventId:'event-concurrent'})
 let calls=0,release
 const gate=new Promise(resolve=>{release=resolve})
 bus.subscribe('*',async()=>{calls+=1;await gate})
 const first=bus.publish(event),second=bus.publish(event)
 release();const[a,b]=await Promise.all([first,second])
 assert.equal(calls,1);assert.deepEqual(a,b);assert.equal(bus.getHistory().length,1)
})

test('rechaza reutilizar un eventId pendiente con contenido diferente',async()=>{
 const bus=createEventBus({onError:()=>{}})
 bus.subscribe('*',()=>{throw new Error('fallo persistente')})
 const first=createDomainEvent({...base,eventId:'event-collision'})
 await bus.publish(first)
 const altered=createDomainEvent({...base,eventId:'event-collision',aggregateId:'company-2'})
 await assert.rejects(()=>bus.publish(altered),/contenido diferente/)
})

test('limita el historial sin reducir la deduplicación',async()=>{
 const bus=createEventBus({maxHistory:2})
 const first=createDomainEvent({...base,eventId:'event-1'})
 await bus.publish(first)
 await bus.publish(createDomainEvent({...base,eventId:'event-2'}))
 await bus.publish(createDomainEvent({...base,eventId:'event-3'}))
 assert.deepEqual(bus.getHistory({limit:10}).map(item=>item.eventId),['event-2','event-3'])
 const replay=await bus.publish(first)
 assert.equal(replay.duplicate,true)
 assert.deepEqual(bus.getHistory({limit:10}).map(item=>item.eventId),['event-2','event-3'])
})

test('valida configuración y permite desactivar el historial',async()=>{
 assert.throws(()=>createEventBus({maxHistory:-1}),/límite de historial/)
 assert.throws(()=>createEventBus({onError:'invalid'}),/onError debe ser una función/)
 const bus=createEventBus({maxHistory:0})
 const event=createDomainEvent({...base,eventId:'event-without-history'})
 await bus.publish(event)
 assert.equal((await bus.publish(event)).duplicate,true)
 assert.equal(bus.getHistory().length,0)
})

test('el catálogo reconoce únicamente eventos registrados',()=>{
 assert.equal(isKnownDomainEvent(DomainEvents.MIPE_FINDING_RECORDED),true)
 assert.equal(isKnownDomainEvent('unknown.entity.changed'),false)
})
