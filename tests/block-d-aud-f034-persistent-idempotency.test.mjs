import test from'node:test'
import assert from'node:assert/strict'
import{createProjector,createProjectionEngine,createProjectionCheckpointStore}from'../src/core/projectionEngine/index.js'

const event={eventId:'evt-persisted',type:'PlantUpdated'}
const projector=calls=>createProjector({id:'passport',version:2,supports:()=>true,project:async()=>{calls.push('run');return'OK'}})

test('AUD3-F003: el motor persistente no acepta autoridad implícita en memoria',()=>{
 assert.throws(()=>createProjectionEngine(),/checkpointStore explícito/)
})

test('AUD-F034: un checkpoint hidratado sobrevive al reinicio del motor',async()=>{
 const calls=[]
 const firstStore=createProjectionCheckpointStore()
 const first=createProjectionEngine({checkpointStore:firstStore})
 first.registerProjector(projector(calls))
 assert.equal((await first.execute(event)).results[0].status,'succeeded')
 const persisted=firstStore.snapshot().completed
 const restarted=createProjectionEngine({checkpointStore:createProjectionCheckpointStore({checkpoints:persisted})})
 restarted.registerProjector(projector(calls))
 const duplicate=await restarted.execute(event)
 assert.equal(duplicate.results[0].status,'skipped')
 assert.equal(duplicate.results[0].reason,'persistent-checkpoint')
 assert.deepEqual(calls,['run'])
 assert.equal(restarted.hasProcessed(event.eventId,'passport',2),true)
})

test('AUD-F034: dos motores con backend compartido no proyectan simultáneamente el mismo evento',async()=>{
 const calls=[],store=createProjectionCheckpointStore()
 let release
 const gate=new Promise(resolve=>{release=resolve})
 const create=()=>{const engine=createProjectionEngine({checkpointStore:store});engine.registerProjector(createProjector({id:'graph',supports:()=>true,project:async()=>{calls.push('run');await gate}}));return engine}
 const a=create(),b=create()
 const running=a.execute({...event,eventId:'evt-concurrent'})
 await Promise.resolve()
 const duplicate=await b.execute({...event,eventId:'evt-concurrent'})
 assert.equal(duplicate.results[0].status,'skipped')
 assert.equal(duplicate.results[0].reason,'checkpoint-claimed')
 release();await running
 assert.deepEqual(calls,['run'])
})

test('AUD-F034: una ejecución fallida libera el claim para reintento posterior',async()=>{
 const store=createProjectionCheckpointStore();let attempts=0
 const engine=createProjectionEngine({checkpointStore:store})
 engine.registerProjector(createProjector({id:'timeline',supports:()=>true,project:()=>{attempts++;if(attempts===1)throw new Error('temporal')}}))
 const first=await engine.execute({...event,eventId:'evt-retry-persistent'})
 assert.equal(first.results[0].status,'failed')
 assert.deepEqual(store.snapshot().activeClaims,[])
 const second=await engine.execute({...event,eventId:'evt-retry-persistent'})
 assert.equal(second.results[0].status,'succeeded')
 assert.equal(attempts,2)
})

test('AUD-F034: replay permanece explícito y no consume checkpoints live',async()=>{
 const calls=[],store=createProjectionCheckpointStore(),engine=createProjectionEngine({checkpointStore:store})
 engine.registerProjector(projector(calls))
 assert.equal((await engine.replay({...event,eventId:'evt-replay'})).results[0].status,'succeeded')
 assert.equal(store.snapshot().completed.length,0)
 assert.equal((await engine.execute({...event,eventId:'evt-replay'})).results[0].status,'succeeded')
 assert.deepEqual(calls,['run','run'])
})
