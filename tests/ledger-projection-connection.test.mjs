import test from'node:test'
import assert from'node:assert/strict'
import{createDomainEvent}from'../src/core/events/index.js'
import{createMemoryLedgerRepository}from'../src/core/ledger/index.js'
import{createProjector,createProjectionEngine,connectLedgerToProjectionEngine}from'../src/core/projectionEngine/index.js'

const event=id=>createDomainEvent({name:'cultivation.plant.updated',aggregateType:'cultivation.plant',aggregateId:id,organizationId:'org-1',eventId:`evt-${id}`})

test('proyecta en orden cada entrada nueva del Ledger y permite flush',async()=>{
 const ledger=createMemoryLedgerRepository(),engine=createProjectionEngine(),calls=[]
 engine.registerProjector(createProjector({id:'audit',supports:()=>true,project:(value,context)=>calls.push([value.eventId,context.ledgerSequence])}))
 const connection=connectLedgerToProjectionEngine(ledger,engine)
 ledger.append(event('1'))
 ledger.append(event('2'))
 const status=await connection.flush()
 assert.deepEqual(calls,[['evt-1',1],['evt-2',2]])
 assert.equal(status.processed,2)
 assert.equal(status.failed,0)
 assert.equal(status.pending,0)
 assert.equal(status.lastSequence,2)
})

test('disconnect es reversible y no afecta la escritura del Ledger',async()=>{
 const ledger=createMemoryLedgerRepository(),engine=createProjectionEngine(),calls=[]
 engine.registerProjector(createProjector({id:'audit',supports:()=>true,project:value=>calls.push(value.eventId)}))
 const connection=connectLedgerToProjectionEngine(ledger,engine)
 assert.equal(connection.disconnect(),true)
 assert.equal(connection.disconnect(),false)
 ledger.append(event('1'))
 await connection.flush()
 assert.deepEqual(calls,[])
 assert.equal(ledger.count(),1)
 assert.equal(connection.status().connected,false)
})

test('un fallo inesperado del motor no bloquea el Ledger y queda observable',async()=>{
 const ledger=createMemoryLedgerRepository(),errors=[]
 const engine={execute:async()=>{throw new Error('motor fuera de servicio')}}
 const connection=connectLedgerToProjectionEngine(ledger,engine,{onError:error=>errors.push(error.message)})
 ledger.append(event('1'))
 const status=await connection.flush()
 assert.equal(ledger.count(),1)
 assert.equal(status.failed,1)
 assert.equal(status.lastError,'motor fuera de servicio')
 assert.deepEqual(errors,['motor fuera de servicio'])
})

test('la idempotencia del Projection Engine se conserva frente a eventos repetidos',async()=>{
 const ledger=createMemoryLedgerRepository(),engine=createProjectionEngine(),calls=[]
 engine.registerProjector(createProjector({id:'audit',supports:()=>true,project:value=>calls.push(value.eventId)}))
 const connection=connectLedgerToProjectionEngine(ledger,engine)
 const value=event('1')
 ledger.append(value)
 ledger.append(value)
 await connection.flush()
 assert.deepEqual(calls,['evt-1'])
 assert.equal(ledger.count(),1)
})
