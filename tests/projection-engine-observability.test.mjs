import test from'node:test'
import assert from'node:assert/strict'
import{createProjector,createProjectionEngine}from'../src/core/projectionEngine/index.js'

function clock(){let value=Date.parse('2026-08-02T18:00:00.000Z');return()=>{const current=value;value+=5;return current}}

test('registra historial limitado y permite filtrarlo',async()=>{
 const engine=createProjectionEngine({historyLimit:2,now:clock()})
 engine.registerProjector(createProjector({id:'timeline',supports:()=>true,project:()=>null}))
 await engine.execute({eventId:'evt-1'})
 await engine.execute({eventId:'evt-2'})
 await engine.execute({eventId:'evt-3'})
 const history=engine.getHistory()
 assert.equal(history.length,2)
 assert.deepEqual(history.map(item=>item.eventId),['evt-2','evt-3'])
 assert.equal(engine.getHistory({eventId:'evt-3'}).length,1)
 assert.equal(Object.isFrozen(history),true)
 assert.equal(Object.isFrozen(history[0]),true)
})

test('acumula métricas de éxito reintento y fallo',async()=>{
 const engine=createProjectionEngine({now:clock()}),attempts=new Map()
 engine.registerProjector(createProjector({id:'passport',policy:{maxAttempts:2},supports:()=>true,project:event=>{const count=(attempts.get(event.eventId)??0)+1;attempts.set(event.eventId,count);if(event.eventId==='retry'&&count===1)throw new Error('temporal');if(event.eventId==='fail')throw new Error('permanente')}}))
 await engine.execute({eventId:'ok'})
 await engine.execute({eventId:'retry'})
 await engine.execute({eventId:'fail'})
 const metrics=engine.getMetrics('passport')
 assert.equal(metrics.processed,3)
 assert.equal(metrics.succeeded,2)
 assert.equal(metrics.failed,1)
 assert.equal(metrics.retried,2)
 assert.equal(metrics.lastSuccess!==null,true)
 assert.equal(metrics.lastFailure!==null,true)
 assert.equal(metrics.maxDurationMs>=metrics.avgDurationMs,true)
})

test('registra timeout y degrada la salud',async()=>{
 const engine=createProjectionEngine({now:clock()})
 engine.registerProjector(createProjector({id:'slow',policy:{timeoutMs:5},supports:()=>true,project:()=>new Promise(resolve=>setTimeout(resolve,20))}))
 await engine.execute({eventId:'evt-timeout'})
 const metrics=engine.getMetrics('slow'),health=engine.health(),record=engine.getHistory()[0]
 assert.equal(metrics.timedOut,1)
 assert.equal(record.timedOut,true)
 assert.equal(record.status,'failed')
 assert.equal(health.status,'critical')
 assert.equal(health.totals.failed,1)
})

test('reporta healthy sin fallos y degraded con bloqueos parciales',async()=>{
 const healthy=createProjectionEngine({now:clock()})
 healthy.registerProjector(createProjector({id:'ok',supports:()=>true,project:()=>null}))
 await healthy.execute({eventId:'evt-ok'})
 assert.equal(healthy.health().status,'healthy')
 const degraded=createProjectionEngine({now:clock()})
 degraded.registerProjector(createProjector({id:'root',supports:()=>true,project:()=>{throw new Error('fallo')}}))
 degraded.registerProjector(createProjector({id:'child',dependencies:['root'],supports:()=>true,project:()=>null}))
 degraded.registerProjector(createProjector({id:'audit',supports:()=>true,project:()=>null}))
 await degraded.execute({eventId:'evt-degraded'})
 assert.equal(degraded.health().status,'degraded')
 assert.equal(degraded.health().totals.blocked,1)
})

test('incluye observabilidad inmutable en snapshot',async()=>{
 const engine=createProjectionEngine({now:clock()})
 engine.registerProjector(createProjector({id:'timeline',supports:()=>true,project:()=>null}))
 await engine.execute({eventId:'evt-1'})
 const snapshot=engine.snapshot()
 assert.equal(Object.isFrozen(snapshot),true)
 assert.equal(Object.isFrozen(snapshot.history),true)
 assert.equal(Object.isFrozen(snapshot.metrics),true)
 assert.equal(snapshot.health.status,'healthy')
})
