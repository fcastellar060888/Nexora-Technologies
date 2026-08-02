import test from'node:test'
import assert from'node:assert/strict'
import{createProjector,createProjectionEngine}from'../src/core/projectionEngine/index.js'

const event={eventId:'evt-1',type:'PlantUpdated'}

test('valida el contrato mínimo de un proyector',()=>{
 assert.throws(()=>createProjector({id:'',supports:()=>true,project:()=>null}),/requiere id/)
 assert.throws(()=>createProjector({id:'a',version:0,supports:()=>true,project:()=>null}),/entero positivo/)
 assert.throws(()=>createProjector({id:'a',dependencies:['a'],supports:()=>true,project:()=>null}),/depender de sí mismo/)
})

test('ordena por dependencias y luego por prioridad e id',()=>{
 const engine=createProjectionEngine(),calls=[]
 engine.registerProjector(createProjector({id:'graph',priority:100,dependencies:['passport'],supports:()=>true,project:()=>calls.push('graph')}))
 engine.registerProjector(createProjector({id:'timeline',priority:10,supports:()=>true,project:()=>calls.push('timeline')}))
 engine.registerProjector(createProjector({id:'passport',priority:1,dependencies:['timeline'],supports:()=>true,project:()=>calls.push('passport')}))
 assert.deepEqual(engine.listProjectors().map(item=>item.id),['timeline','passport','graph'])
 return engine.execute(event).then(()=>assert.deepEqual(calls,['timeline','passport','graph']))
})

test('rechaza dependencias ausentes y ciclos',()=>{
 const missing=createProjectionEngine()
 assert.throws(()=>missing.registerProjector(createProjector({id:'graph',dependencies:['passport'],supports:()=>true,project:()=>null})),/Dependencia no registrada/)
 const cycle=createProjectionEngine()
 cycle.registerProjector(createProjector({id:'a',supports:()=>true,project:()=>null}))
 cycle.registerProjector(createProjector({id:'b',dependencies:['a'],supports:()=>true,project:()=>null}))
 assert.throws(()=>cycle.registerProjector(createProjector({id:'a',dependencies:['b'],supports:()=>true,project:()=>null})),/ya está registrado/)
})

test('es idempotente por evento proyector y versión',async()=>{
 const engine=createProjectionEngine(),calls=[]
 engine.registerProjector(createProjector({id:'passport',version:2,supports:()=>true,project:()=>calls.push('run')}))
 const first=await engine.execute(event),second=await engine.execute(event)
 assert.equal(first.results[0].status,'succeeded')
 assert.equal(second.results[0].status,'skipped')
 assert.equal(second.results[0].reason,'already-processed')
 assert.deepEqual(calls,['run'])
 assert.equal(engine.hasProcessed('evt-1','passport',2),true)
})

test('omite proyectores que no soportan el evento sin marcarlos procesados',async()=>{
 const engine=createProjectionEngine()
 engine.registerProjector(createProjector({id:'inventory',supports:value=>value.type==='InventoryMoved',project:()=>null}))
 const result=await engine.execute(event)
 assert.equal(result.results[0].status,'skipped')
 assert.equal(result.results[0].reason,'unsupported')
 assert.equal(engine.hasProcessed('evt-1','inventory',1),false)
})

test('expone snapshots inmutables y registro reversible',()=>{
 const engine=createProjectionEngine(),projector=createProjector({id:'timeline',supports:()=>true,project:()=>null})
 engine.registerProjector(projector)
 assert.equal(engine.getProjector('timeline'),projector)
 const snapshot=engine.snapshot()
 assert.equal(Object.isFrozen(snapshot),true)
 assert.equal(Object.isFrozen(snapshot.projectors),true)
 assert.equal(engine.unregisterProjector('timeline'),true)
 assert.equal(engine.getProjector('timeline'),null)
})
