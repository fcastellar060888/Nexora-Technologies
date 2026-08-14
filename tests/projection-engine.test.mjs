import test from'node:test'
import assert from'node:assert/strict'
import{createProjector,createVolatileProjectionEngine}from'../src/core/projectionEngine/index.js'

const event={eventId:'evt-1',type:'PlantUpdated'}

test('valida el contrato mínimo de un proyector',()=>{
 assert.throws(()=>createProjector({id:'',supports:()=>true,project:()=>null}),/requiere id/)
 assert.throws(()=>createProjector({id:'a',version:0,supports:()=>true,project:()=>null}),/entero positivo/)
 assert.throws(()=>createProjector({id:'a',dependencies:['a'],supports:()=>true,project:()=>null}),/depender de sí mismo/)
 assert.throws(()=>createProjector({id:'a',supports:()=>true,project:()=>null,policy:{maxAttempts:0}}),/entero positivo/)
 assert.throws(()=>createProjector({id:'a',supports:()=>true,project:()=>null,policy:{failStrategy:'invalid'}}),/no es válida/)
})

test('ordena por dependencias y luego por prioridad e id',async()=>{
 const engine=createVolatileProjectionEngine(),calls=[]
 engine.registerProjector(createProjector({id:'timeline',priority:10,supports:()=>true,project:()=>calls.push('timeline')}))
 engine.registerProjector(createProjector({id:'passport',priority:1,dependencies:['timeline'],supports:()=>true,project:()=>calls.push('passport')}))
 engine.registerProjector(createProjector({id:'graph',priority:100,dependencies:['passport'],supports:()=>true,project:()=>calls.push('graph')}))
 assert.deepEqual(engine.listProjectors().map(item=>item.id),['timeline','passport','graph'])
 await engine.execute(event)
 assert.deepEqual(calls,['timeline','passport','graph'])
})

test('rechaza dependencias ausentes y ciclos sin alterar parcialmente el registro',()=>{
 const missing=createVolatileProjectionEngine()
 assert.throws(()=>missing.registerProjector(createProjector({id:'graph',dependencies:['passport'],supports:()=>true,project:()=>null})),/Dependencia no registrada/)
 assert.deepEqual(missing.listProjectors(),[])
 const cycle=createVolatileProjectionEngine()
 const a=createProjector({id:'a',supports:()=>true,project:()=>null})
 cycle.registerProjector(a)
 cycle.registerProjector(createProjector({id:'b',dependencies:['a'],supports:()=>true,project:()=>null}))
 assert.throws(()=>cycle.registerProjector(createProjector({id:'a',dependencies:['b'],supports:()=>true,project:()=>null})),/ya está registrado/)
 assert.equal(cycle.getProjector('a'),a)
 assert.equal(cycle.getProjector('b').id,'b')
})

test('AUD-F035: impide retirar un proyector requerido sin alterar el grafo',()=>{
 const engine=createVolatileProjectionEngine()
 const timeline=createProjector({id:'timeline',supports:()=>true,project:()=>null})
 const passport=createProjector({id:'passport',dependencies:['timeline'],supports:()=>true,project:()=>null})
 const graph=createProjector({id:'graph',dependencies:['passport'],supports:()=>true,project:()=>null})
 engine.registerProjector(timeline);engine.registerProjector(passport);engine.registerProjector(graph)
 const before=engine.listProjectors()
 assert.throws(()=>engine.unregisterProjector('timeline'),/todavía es requerido por: passport/)
 assert.deepEqual(engine.listProjectors(),before)
 assert.equal(engine.getProjector('timeline'),timeline)
})

test('AUD-F035: permite retirar en orden inverso de dependencias y no deja referencias huérfanas',()=>{
 const engine=createVolatileProjectionEngine()
 engine.registerProjector(createProjector({id:'timeline',supports:()=>true,project:()=>null}))
 engine.registerProjector(createProjector({id:'passport',dependencies:['timeline'],supports:()=>true,project:()=>null}))
 engine.registerProjector(createProjector({id:'graph',dependencies:['passport'],supports:()=>true,project:()=>null}))
 assert.equal(engine.unregisterProjector('graph'),true)
 assert.equal(engine.unregisterProjector('passport'),true)
 assert.equal(engine.unregisterProjector('timeline'),true)
 assert.deepEqual(engine.listProjectors(),[])
 assert.equal(engine.unregisterProjector('timeline'),false)
})

test('es idempotente por evento proyector y versión',async()=>{
 const engine=createVolatileProjectionEngine(),calls=[]
 engine.registerProjector(createProjector({id:'passport',version:2,supports:()=>true,project:()=>calls.push('run')}))
 const first=await engine.execute(event),second=await engine.execute(event)
 assert.equal(first.results[0].status,'succeeded')
 assert.equal(second.results[0].status,'skipped')
 assert.equal(second.results[0].reason,'already-processed')
 assert.deepEqual(calls,['run'])
 assert.equal(engine.hasProcessed('evt-1','passport',2),true)
})

test('omite proyectores que no soportan el evento sin marcarlos procesados',async()=>{
 const engine=createVolatileProjectionEngine()
 engine.registerProjector(createProjector({id:'inventory',supports:value=>value.type==='InventoryMoved',project:()=>null}))
 const result=await engine.execute(event)
 assert.equal(result.results[0].status,'skipped')
 assert.equal(result.results[0].reason,'unsupported')
 assert.equal(engine.hasProcessed('evt-1','inventory',1),false)
})

test('una falla bloquea solo sus dependientes y permite continuar ramas independientes',async()=>{
 const engine=createVolatileProjectionEngine(),calls=[]
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

test('reintenta hasta éxito sin romper idempotencia',async()=>{
 const engine=createVolatileProjectionEngine();let attempts=0
 engine.registerProjector(createProjector({id:'retry',supports:()=>true,policy:{maxAttempts:3},project:()=>{attempts++;if(attempts<3)throw new Error('temporal');return'OK'}}))
 const result=await engine.execute({...event,eventId:'evt-retry'})
 assert.equal(result.results[0].status,'succeeded')
 assert.equal(result.results[0].attempts,3)
 assert.equal(result.results[0].output,'OK')
 assert.equal(engine.hasProcessed('evt-retry','retry',1),true)
})

test('aplica timeout y no marca el proyector como procesado',async()=>{
 const engine=createVolatileProjectionEngine()
 engine.registerProjector(createProjector({id:'slow',supports:()=>true,policy:{timeoutMs:5},project:()=>new Promise(resolve=>setTimeout(()=>resolve('late'),30))}))
 const result=await engine.execute({...event,eventId:'evt-timeout'})
 assert.equal(result.results[0].status,'failed')
 assert.match(result.results[0].error,/Tiempo de espera/)
 assert.equal(engine.hasProcessed('evt-timeout','slow',1),false)
})

test('AUD-F032: el timeout aborta la señal antes de devolver el fallo',async()=>{
 const engine=createVolatileProjectionEngine();let observedAbort=false
 engine.registerProjector(createProjector({id:'abort-aware',supports:()=>true,policy:{timeoutMs:5},project:(_,context)=>new Promise(resolve=>{
  context.signal.addEventListener('abort',()=>{observedAbort=true;resolve('aborted')},{once:true})
 })}))
 const result=await engine.execute({...event,eventId:'evt-abort-aware'})
 assert.equal(result.results[0].status,'failed')
 assert.equal(observedAbort,true)
 assert.equal(engine.hasProcessed('evt-abort-aware','abort-aware',1),false)
})

test('AUD-F032: un commit tardío queda invalidado después del timeout',async()=>{
 const engine=createVolatileProjectionEngine(),writes=[];let lateError=null
 engine.registerProjector(createProjector({id:'late-writer',supports:()=>true,policy:{timeoutMs:5},project:(_,context)=>new Promise(resolve=>setTimeout(()=>{
  try{context.commit(()=>writes.push('corrupt'))}catch(error){lateError=error}
  resolve('late')
 },25))}))
 const result=await engine.execute({...event,eventId:'evt-late-writer'})
 assert.equal(result.results[0].status,'failed')
 await new Promise(resolve=>setTimeout(resolve,35))
 assert.deepEqual(writes,[])
 assert.match(lateError?.message??'',/Tiempo de espera|ya no está activa/)
 assert.equal(engine.hasProcessed('evt-late-writer','late-writer',1),false)
})

test('continue permite ejecutar dependientes pese al fallo',async()=>{
 const engine=createVolatileProjectionEngine(),calls=[]
 engine.registerProjector(createProjector({id:'optional',supports:()=>true,policy:{failStrategy:'continue'},project:()=>{throw new Error('optional failed')}}))
 engine.registerProjector(createProjector({id:'after',dependencies:['optional'],supports:()=>true,project:()=>calls.push('after')}))
 const result=await engine.execute({...event,eventId:'evt-continue'})
 assert.equal(result.results.find(item=>item.projectorId==='optional').status,'failed')
 assert.equal(result.results.find(item=>item.projectorId==='after').status,'succeeded')
 assert.deepEqual(calls,['after'])
})

test('stop-all bloquea toda ejecución posterior',async()=>{
 const engine=createVolatileProjectionEngine(),calls=[]
 engine.registerProjector(createProjector({id:'critical',priority:100,supports:()=>true,policy:{failStrategy:'stop-all'},project:()=>{throw new Error('critical')}}))
 engine.registerProjector(createProjector({id:'independent',supports:()=>true,project:()=>calls.push('independent')}))
 const result=await engine.execute({...event,eventId:'evt-stop-all'})
 assert.equal(result.results[0].status,'failed')
 assert.equal(result.results[1].status,'blocked')
 assert.equal(result.results[1].reason,'execution-stopped')
 assert.deepEqual(calls,[])
})

test('expone snapshots inmutables y registro reversible',()=>{
 const engine=createVolatileProjectionEngine(),projector=createProjector({id:'timeline',supports:()=>true,project:()=>null})
 engine.registerProjector(projector)
 assert.equal(engine.getProjector('timeline'),projector)
 const snapshot=engine.snapshot()
 assert.equal(Object.isFrozen(snapshot),true)
 assert.equal(Object.isFrozen(snapshot.projectors),true)
 assert.equal(engine.unregisterProjector('timeline'),true)
 assert.equal(engine.getProjector('timeline'),null)
})
