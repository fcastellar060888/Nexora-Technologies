import test from'node:test'
import assert from'node:assert/strict'
import{createDomainEvent,createEventBus,DomainEvents}from'../src/core/events/index.js'
import{createMemoryLedgerRepository}from'../src/core/ledger/index.js'

const makeEvent=(eventId,overrides={})=>createDomainEvent({
 name:DomainEvents.COMPANY_CREATED,
 aggregateType:'company',aggregateId:'company-1',organizationId:'company-1',actorId:'user-1',
 occurredAt:'2026-08-03T05:20:00.000Z',eventId,payload:{name:'Nexora'},...overrides
})

test('reauditoría A2: recortar el historial no elimina la deduplicación',async()=>{
 const bus=createEventBus({maxHistory:1}),received=[]
 bus.subscribe('*',event=>received.push(event.eventId))
 const first=makeEvent('event-retained')
 await bus.publish(first)
 await bus.publish(makeEvent('event-visible'))
 assert.deepEqual(bus.getHistory().map(event=>event.eventId),['event-visible'])
 const replay=await bus.publish(first)
 assert.equal(replay.duplicate,true)
 assert.deepEqual(received,['event-retained','event-visible'])
})

test('reauditoría A2: desactivar historial no desactiva deduplicación',async()=>{
 const bus=createEventBus({maxHistory:0})
 let calls=0
 bus.subscribe('*',()=>{calls+=1})
 const event=makeEvent('event-no-history')
 await bus.publish(event)
 const replay=await bus.publish(event)
 assert.equal(replay.duplicate,true)
 assert.equal(calls,1)
 assert.equal(bus.getHistory().length,0)
})

test('reauditoría A2: Event Bus rechaza colisiones después del éxito y durante vuelo',async()=>{
 const bus=createEventBus()
 let release
 const gate=new Promise(resolve=>{release=resolve})
 bus.subscribe('*',()=>gate)
 const first=makeEvent('event-collision')
 const altered=makeEvent('event-collision',{aggregateId:'company-2'})
 const running=bus.publish(first)
 await assert.rejects(()=>bus.publish(altered),/contenido diferente/)
 release();await running
 await assert.rejects(()=>bus.publish(altered),/contenido diferente/)
})

test('reauditoría A2: Ledger rechaza colisiones en append y lotes sin alterar estado',()=>{
 const ledger=createMemoryLedgerRepository()
 const first=makeEvent('ledger-collision')
 const altered=makeEvent('ledger-collision',{aggregateId:'company-2'})
 ledger.append(first)
 assert.throws(()=>ledger.append(altered),/evento diferente/)
 assert.throws(()=>ledger.appendMany([makeEvent('ledger-new'),altered]),/evento diferente/)
 assert.equal(ledger.getByEventId('ledger-new'),null)
 assert.equal(ledger.count(),1)
})

test('reauditoría A2: reconciliación rechaza colisiones sin modificar snapshot canónico',()=>{
 const ledger=createMemoryLedgerRepository()
 const first=makeEvent('ledger-existing')
 ledger.append(first,{sequence:1})
 const altered=makeEvent('ledger-existing',{payload:{name:'Alterado'}})
 assert.throws(()=>ledger.reconcileMany([makeEvent('ledger-historical'),altered]),/evento diferente/)
 assert.deepEqual(ledger.find({order:'asc'}).map(entry=>entry.id),['ledger-existing'])
})
