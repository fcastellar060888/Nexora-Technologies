import test from'node:test'
import assert from'node:assert/strict'
import{createProjector,createProjectionEngine}from'../src/core/projectionEngine/index.js'

const event=id=>({eventId:id,type:'PlantUpdated'})
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms))

test('AUD-F038: timeout durante supports aborta la señal y nunca inicia project',async()=>{
 const engine=createProjectionEngine();let observedAbort=false,projectCalls=0
 engine.registerProjector(createProjector({
  id:'slow-supports',
  policy:{timeoutMs:5},
  supports:(_,context)=>new Promise(resolve=>context.signal.addEventListener('abort',()=>{observedAbort=true;resolve(true)},{once:true})),
  project:()=>{projectCalls+=1}
 }))
 const result=await engine.execute(event('evt-support-timeout'))
 assert.equal(result.results[0].status,'failed')
 assert.match(result.results[0].error,/Tiempo de espera/)
 assert.equal(observedAbort,true)
 assert.equal(projectCalls,0)
 assert.equal(engine.hasProcessed('evt-support-timeout','slow-supports',1),false)
})

test('AUD-F038: una excepción de supports usa la política de reintentos completa',async()=>{
 const engine=createProjectionEngine(),attempts=[];let projectCalls=0
 engine.registerProjector(createProjector({
  id:'retry-supports',
  policy:{maxAttempts:3},
  supports:(_,context)=>{attempts.push(context.attempt);if(context.attempt<2)throw new Error('selección transitoria');return true},
  project:(_,context)=>{projectCalls+=1;return context.attempt}
 }))
 const result=await engine.execute(event('evt-support-retry'))
 assert.equal(result.results[0].status,'succeeded')
 assert.equal(result.results[0].attempts,2)
 assert.equal(result.results[0].output,2)
 assert.deepEqual(attempts,[1,2])
 assert.equal(projectCalls,1)
})

test('AUD-F038: supports y project consumen un único presupuesto de timeout',async()=>{
 const engine=createProjectionEngine();let lateCommitError=null
 engine.registerProjector(createProjector({
  id:'shared-budget',
  policy:{timeoutMs:30},
  supports:async()=>{await delay(20);return true},
  project:async(_,context)=>{await delay(20);try{context.commit(()=>null)}catch(error){lateCommitError=error};return'late'}
 }))
 const result=await engine.execute(event('evt-shared-budget'))
 assert.equal(result.results[0].status,'failed')
 assert.match(result.results[0].error,/Tiempo de espera/)
 await delay(25)
 assert.match(lateCommitError?.message??'',/Tiempo de espera|ya no está activa/)
})

test('AUD-F038: supports false es una decisión normal y no se reintenta',async()=>{
 const engine=createProjectionEngine();let supportsCalls=0,projectCalls=0
 engine.registerProjector(createProjector({
  id:'unsupported',
  policy:{maxAttempts:3},
  supports:(_,context)=>{supportsCalls+=1;assert.equal(context.attempt,1);return false},
  project:()=>{projectCalls+=1}
 }))
 const result=await engine.execute(event('evt-unsupported'))
 assert.equal(result.results[0].status,'skipped')
 assert.equal(result.results[0].reason,'unsupported')
 assert.equal(result.results[0].attempts,1)
 assert.equal(supportsCalls,1)
 assert.equal(projectCalls,0)
})
