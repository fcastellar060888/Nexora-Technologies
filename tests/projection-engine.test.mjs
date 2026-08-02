import test from'node:test'
import assert from'node:assert/strict'
import{createProjector,createProjectionEngine}from'../src/core/projectionEngine/index.js'

const event={eventId:'evt-1',type:'PlantUpdated'}

test('valida el contrato mínimo de un proyector',()=>{
 assert.throws(()=>createProjector({id:'',supports:()=>true,project:()=>null}),/requiere id/)
 assert.throws(()=>createProjector({id:'a',version:0,supports:()=>true,project:()=>null}),/entero positivo/)
 assert.throws(()=>createProjector({id:'a',dependencies:['a'],supports:()=>true,project:()=>null}),/depender de sí mismo/)
})

test('ordena por dependencias y luego por prioridad e id',async()=>{
 const engine=createProjectionEngine(),calls=[]
 engine.registerProjector(createProjector({id:'timeline',priority:10,supports:()=>true,project:()=>calls.push('timeline')}))
 engine.registerProjector(createProjector({id:'passport',priority:1,dependencies:['timeline'],supports:()=>true,project:()=>calls.push('passport')}))
 engine.registerProjector(createProjector({id:'graph',priority:100,dependencies:['passport'],supports:()=>true,project:()=>calls.push('graph')}))
 assert.deepEqual(engine.listProjectors().map(item=>item.id),['timeline','passport','graph'])
 await engine.execute(event)
 assert.deepEqual(calls,['timeline','passport','graph'])
})

test('rechaza dependencias ausentes y ciclos sin alterar parcialmente el registro',()=>{
 const missing=createProjectionEngine()
 assert.throws(()=>missing.registerProjector(createProjector({id:'graph',dependencies:['passport'],supports:()=>true,project:()=>null})),/Dependencia no registrada/)
 assert.deepEqual(missing.listProjectors(),[])
 const cycle=createProjectionEngine()
 cycle.registerProjector(createProjector({id:'a',supports:()=>true,project:()=>null}))
 cycle.registerProjector(createProjector({id:'b',dependencies:['a'],supports:()=>true,project:()=>null}))
 cycle.unregisterProjector('a')
 assert.throws(()=>cycle.registerProjector(createProjector({id:'a',dependencies:['b'],supports:()=>true,project:()=>null})),/Ciclo de dependencias/)
 assert.equal(cycle.getProjector('a'),null)
 assert.equal(cycle.getProjector('b').id,'b')
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

test('una falla bloquea solo sus dependientes y permite continuar ramas independientes',async()=>{
 const engine=createProjectionEngine(),calls=[]
 engine.registerProjector(createProjector({id:'timeline',supports:()=>true,project:()=>{calls.push('timeline');throw new Error('timeline roto')}}))
 engine.registerProjector(createProjector({id:'passport',dependencies:['timeline'],supports:()=>true,project:()=>calls.push('passport')}))
 engine.registerProjector(createProjector({id:'graph',dependencies:['passport'],supports:()=>true,project:()=>calls.push('graph')}))
 engine.registerProjector(createProjector({id:'audit',supports:()=>true,project:()=>calls.push('audit')}))
 const result=await engine.execute(event)
 const byId=Object.fromEntries(result.results.map(item=>[item.projectorId,item]))
 assert.equal(byId.timeline.status,'failed')
 assert.equal(byId.timeline.error,'timeline roto')
 assert.equal(byId.passport.status,'blocked')
 assert.deepEqual(byId.passport.blockedBy,['timeline'])
 assert.equal(byId.graph.status,'blocked')
 assert.deepEqual(byId.graph.blockedBy,['passport'])
 assert.equal(byId.audit.status,'succeeded')
 assert.deepEqual(calls,['audit','timeline'])
 assert.equal(engine.hasProcessed('evt-1','timeline',1),false)
 assert.equal(engine.hasProcessed('evt-1','audit',1),true)
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
