import test from'node:test'
import assert from'node:assert/strict'
import{createProjector,createProjectionEngine}from'../src/core/projectionEngine/index.js'

const projector=createProjector({id:'audit',supports:()=>true,project:event=>event.eventId})

test('AUD-F036: recortar historial no reutiliza executionId',async()=>{
 const engine=createProjectionEngine({historyLimit:2})
 engine.registerProjector(projector)
 const ids=[]
 for(let index=1;index<=5;index++){
  await engine.execute({eventId:`evt-${index}`,type:'AuditEvent'})
  ids.push(engine.getHistory().at(-1).executionId)
 }
 assert.equal(new Set(ids).size,5)
 assert.deepEqual(ids.map(id=>Number(id.split(':').at(-1))),[1,2,3,4,5])
 assert.equal(engine.getHistory().length,2)
 assert.equal(engine.snapshot().executionSequence,5)
})

test('AUD-F036: execute y replay comparten una secuencia de auditoría única',async()=>{
 const engine=createProjectionEngine({historyLimit:1})
 engine.registerProjector(projector)
 await engine.execute({eventId:'live-1',type:'AuditEvent'})
 const first=engine.getHistory().at(-1).executionId
 await engine.replay({eventId:'replay-1',type:'AuditEvent'})
 const second=engine.getHistory().at(-1).executionId
 await engine.execute({eventId:'live-2',type:'AuditEvent'})
 const third=engine.getHistory().at(-1).executionId
 assert.deepEqual([first,second,third].map(id=>Number(id.split(':').at(-1))),[1,2,3])
 assert.equal(new Set([first,second,third]).size,3)
 assert.equal(engine.snapshot().executionSequence,3)
})

test('AUD-F036: varios proyectores reciben identidades distintas dentro del mismo evento',async()=>{
 const engine=createProjectionEngine({historyLimit:1})
 engine.registerProjector(createProjector({id:'a',priority:2,supports:()=>true,project:()=>null}))
 engine.registerProjector(createProjector({id:'b',priority:1,supports:()=>true,project:()=>null}))
 await engine.execute({eventId:'evt-shared',type:'AuditEvent'})
 const retained=engine.getHistory().at(-1)
 assert.equal(retained.projectorId,'b')
 assert.equal(retained.executionId,'evt-shared:b:1:2')
 assert.equal(engine.snapshot().executionSequence,2)
})
