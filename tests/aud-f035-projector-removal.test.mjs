import test from'node:test'
import assert from'node:assert/strict'
import{createProjector,createProjectionEngine,createProjectionCheckpointStore}from'../src/core/projectionEngine/index.js'

const projector=(id,dependencies=[])=>createProjector({id,dependencies,supports:()=>true,project:()=>id})

test('AUD-F035: reporta todos los dependientes directos de forma determinista y no altera el registro',()=>{
 const engine=createProjectionEngine()
 const root=projector('root'),beta=projector('beta',['root']),alpha=projector('alpha',['root'])
 engine.registerProjector(root);engine.registerProjector(beta);engine.registerProjector(alpha)
 const before=engine.snapshot()
 assert.throws(()=>engine.unregisterProjector('root'),/root todavía es requerido por: alpha, beta/)
 const after=engine.snapshot()
 assert.deepEqual(after.projectors,before.projectors)
 assert.deepEqual(after.metrics,before.metrics)
 assert.deepEqual(after.processed,before.processed)
 assert.deepEqual(after.history,before.history)
 assert.equal(after.executionSequence,before.executionSequence)
})

test('AUD-F035: una cadena transitiva solo puede retirarse desde las hojas',()=>{
 const engine=createProjectionEngine()
 engine.registerProjector(projector('timeline'))
 engine.registerProjector(projector('passport',['timeline']))
 engine.registerProjector(projector('graph',['passport']))
 assert.throws(()=>engine.unregisterProjector('timeline'),/passport/)
 assert.throws(()=>engine.unregisterProjector('passport'),/graph/)
 assert.equal(engine.unregisterProjector('graph'),true)
 assert.equal(engine.unregisterProjector('passport'),true)
 assert.equal(engine.unregisterProjector('timeline'),true)
 assert.deepEqual(engine.listProjectors(),[])
})

test('AUD-F035: la fachada persistente conserva checkpoints y firma cuando la retirada es rechazada',async()=>{
 const checkpointStore=createProjectionCheckpointStore()
 const engine=createProjectionEngine({checkpointStore})
 engine.registerProjector(projector('timeline'))
 engine.registerProjector(projector('passport',['timeline']))
 await engine.execute({eventId:'evt-f035'})
 const checkpointsBefore=checkpointStore.snapshot()
 const snapshotBefore=engine.snapshot()
 assert.throws(()=>engine.unregisterProjector('timeline'),/passport/)
 assert.deepEqual(checkpointStore.snapshot(),checkpointsBefore)
 assert.deepEqual(engine.snapshot().projectors,snapshotBefore.projectors)
 assert.equal(engine.hasProcessed('evt-f035','timeline',1),true)
 assert.equal(engine.hasProcessed('evt-f035','passport',1),true)
})

test('AUD-F035: retirar una hoja cambia el registro sin dejar una dependencia huérfana',()=>{
 const engine=createProjectionEngine()
 engine.registerProjector(projector('timeline'))
 engine.registerProjector(projector('passport',['timeline']))
 assert.equal(engine.unregisterProjector('passport'),true)
 assert.deepEqual(engine.listProjectors().map(item=>item.id),['timeline'])
 assert.doesNotThrow(()=>engine.listProjectors())
 assert.equal(engine.unregisterProjector('timeline'),true)
})
