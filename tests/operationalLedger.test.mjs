import test from'node:test'
import assert from'node:assert/strict'
import{readFile}from'node:fs/promises'
import{createDomainEvent,createEventBus,DomainEvents}from'../src/core/events/index.js'
import{connectLedgerToEventBus,createLedgerEntry,createMemoryLedgerRepository,isLedgerEntry}from'../src/core/ledger/index.js'

const event=(overrides={})=>createDomainEvent({name:DomainEvents.COMPANY_CREATED,aggregateType:'company',aggregateId:'company-1',organizationId:'company-1',actorId:'user-1',occurredAt:'2026-07-31T22:00:00.000Z',eventId:'event-1',payload:{label:'Canapa'},metadata:{actorName:'Fer'},...overrides})

test('crea una entrada inmutable y trazable del Operational Ledger',()=>{
 const entry=createLedgerEntry(event(),{sequence:1,recordedAt:'2026-07-31T22:00:01.000Z'})
 assert.equal(entry.id,'event-1')
 assert.equal(entry.sequence,1)
 assert.equal(entry.event.name,DomainEvents.COMPANY_CREATED)
 assert.equal(isLedgerEntry(entry),true)
 assert.ok(Object.isFrozen(entry))
})

test('mantiene secuencia, deduplicación y consulta contextual',()=>{
 const ledger=createMemoryLedgerRepository()
 ledger.append(event())
 ledger.append(event())
 ledger.append(event({eventId:'event-2',aggregateId:'company-2',organizationId:'company-2',payload:{label:'Otra empresa'}}))
 assert.equal(ledger.count(),2)
 assert.equal(ledger.getByEventId('event-1').sequence,1)
 assert.equal(ledger.find({organizationId:'company-2'}).length,1)
 assert.equal(ledger.find({search:'otra empresa'}).length,1)
 assert.deepEqual(ledger.find({order:'asc'}).map(item=>item.sequence),[1,2])
})

test('rehidrata entradas preservando secuencia y avanza el contador',()=>{
 const ledger=createMemoryLedgerRepository()
 const stored=createLedgerEntry(event(),{sequence:12,recordedAt:'2026-07-31T22:00:01.000Z'})
 ledger.appendMany([stored])
 const next=ledger.append(event({eventId:'event-2'}))
 assert.equal(next.sequence,13)
})

test('rechaza colisiones de secuencia entre eventos distintos',()=>{
 const ledger=createMemoryLedgerRepository()
 ledger.append(event(),{sequence:7})
 assert.throws(()=>ledger.append(event({eventId:'event-2'}),{sequence:7}),/secuencia 7 ya pertenece/)
 assert.equal(ledger.count(),1)
})

test('recorta índices e historial de forma coherente',()=>{
 const ledger=createMemoryLedgerRepository({maxEntries:2})
 ledger.append(event(),{sequence:1})
 ledger.append(event({eventId:'event-2'}),{sequence:2})
 ledger.append(event({eventId:'event-3'}),{sequence:3})
 assert.equal(ledger.count(),2)
 assert.equal(ledger.getByEventId('event-1'),null)
 assert.deepEqual(ledger.find({order:'asc'}).map(item=>item.id),['event-2','event-3'])
})

test('rechaza límites de retención inválidos',()=>{
 assert.throws(()=>createMemoryLedgerRepository({maxEntries:0}),/entero positivo/)
 assert.throws(()=>createMemoryLedgerRepository({maxEntries:1.5}),/entero positivo/)
})

test('se conecta al Event Bus y puede desconectarse',async()=>{
 const ledger=createMemoryLedgerRepository(),bus=createEventBus()
 const disconnect=connectLedgerToEventBus(ledger,bus)
 await bus.publish(event())
 assert.equal(ledger.count(),1)
 disconnect()
 await bus.publish(event({eventId:'event-2'}))
 assert.equal(ledger.count(),1)
})

test('reporta salud del repositorio',()=>{
 const ledger=createMemoryLedgerRepository()
 ledger.append(event())
 assert.deepEqual(ledger.health(),{status:'ready',driver:'memory',entries:1,nextSequence:2,maxEntries:10000})
})

test('el bridge hidrata, persiste y limita el registro canónico',async()=>{
 const source=await readFile(new URL('../src/core/ledger/OperationalLedgerBridge.jsx',import.meta.url),'utf8')
 assert.match(source,/appendMany\(state\.operationalLedgerEntries/)
 assert.match(source,/operationalLedger\.subscribe/)
 assert.match(source,/connectLedgerToEventBus/)
 assert.match(source,/operationalLedgerEntries:/)
 assert.match(source,/slice\(-10000\)/)
 assert.match(source,/sync:false,audit:false/)
})
