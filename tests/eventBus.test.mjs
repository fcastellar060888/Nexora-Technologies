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
 assert.ok(Object.isFrozen(event))
 assert.ok(Object.isFrozen(event.aggregate))
 assert.ok(Object.isFrozen(event.context))
 assert.ok(Object.isFrozen(event.payload))
 assert.ok(Object.isFrozen(event.payload.details))
 assert.throws(()=>{event.payload.details.source='altered'},TypeError)
})

test('rechaza eventos sin formato dominio.entidad.accion',()=>{
 assert.throws(()=>createDomainEvent({...base,name:'companyCreated'}),/formato dominio\.entidad\.accion/)
})

test('la validación no completa silenciosamente identidad ni versión faltantes',()=>{
 const valid=createDomainEvent({...base,eventId:'event-1',version:2})
 const{eventId,...withoutId}=valid
 const{version,...withoutVersion}=valid
 assert.equal(isDomainEvent(valid),true)
 assert.equal(isDomainEvent(withoutId),false)
 assert.equal(isDomainEvent(withoutVersion),false)
})

test('publica a suscriptores específicos y universales',async()=>{
 const bus=createEventBus(),received=[]
 bus.subscribe(DomainEvents.COMPANY_CREATED,event=>received.push(`specific:${event.aggregate.id}`))
 bus.subscribe('*',event=>received.push(`all:${event.name}`))
 const result=await bus.publish(createDomainEvent(base))
 assert.equal(result.delivered,2)
 assert.equal(result.failed,0)
 assert.deepEqual(received,['specific:company-1','all:organization.company.created'])
})

test('un suscriptor puede cancelarse sin afectar a los demás',async()=>{
 const bus=createEventBus(),received=[]
 const unsubscribe=bus.subscribe(DomainEvents.COMPANY_CREATED,()=>received.push('removed'))
 bus.subscribe('*',()=>received.push('active'))
 unsubscribe()
 await bus.publish(createDomainEvent(base))
 assert.deepEqual(received,['active'])
})

test('conserva historia filtrable por evento y objeto',async()=>{
 const bus=createEventBus()
 await bus.publish(createDomainEvent(base))
 await bus.publish(createDomainEvent({...base,eventId:'event-2',aggregateId:'company-2',organizationId:'company-2'}))
 assert.equal(bus.getHistory({name:DomainEvents.COMPANY_CREATED}).length,2)
 assert.equal(bus.getHistory({aggregateId:'company-1'}).length,1)
})

test('el catálogo reconoce únicamente eventos registrados',()=>{
 assert.equal(isKnownDomainEvent(DomainEvents.MIPE_FINDING_RECORDED),true)
 assert.equal(isKnownDomainEvent('unknown.entity.changed'),false)
})
