import test from'node:test'
import assert from'node:assert/strict'
import{createActionEngine,defineAction,registerUniversalActions}from'../src/core/actions/index.js'

function publisher({failName=null}={}){
 const published=[]
 return{
  published,
  publishEvent:async event=>{
   published.push(event)
   if(event.name===failName)return{event:{eventId:event.eventId},failed:1,pending:true,duplicate:false}
   return{event:{eventId:event.eventId},failed:0,pending:false,duplicate:false}
  }
 }
}

test('Action Engine registra intención antes de mutar y luego publica su evento de dominio',async()=>{
 const bus=publisher()
 const order=[]
 const engine=createActionEngine({publishEvent:async event=>{order.push(event.name);return bus.publishEvent(event)}})
 engine.register(defineAction({
  id:'plant.move',label:'Mover planta',targetTypes:['material-plant'],eventName:'cultivation.plant.moved',
  validate:({input})=>input.destinationId?true:'Destino obligatorio',
  execute:({target,input})=>{order.push('execute');return{plantId:target.id,destinationId:input.destinationId}}
 }))
 const result=await engine.execute('plant.move',{
  target:{type:'material-plant',id:'plant-1',organizationId:'org-1',siteId:'site-1'},
  input:{destinationId:'bed-9'}
 })
 assert.equal(result.actionId,'plant.move')
 assert.equal(result.result.destinationId,'bed-9')
 assert.deepEqual(order,['core.action.requested','execute','cultivation.plant.moved'])
 assert.equal(bus.published.length,2)
 assert.equal(bus.published[1].aggregateId,'plant-1')
 assert.equal(bus.published[1].payload.executionId,result.executionId)
 assert.equal(bus.published[1].causationId,bus.published[0].eventId)
})

test('Action Engine bloquea tipos de objeto no permitidos antes de mutar',async()=>{
 let executions=0
 const bus=publisher()
 const engine=createActionEngine({publishEvent:bus.publishEvent})
 engine.register(defineAction({
  id:'plant.observe',label:'Observar',targetTypes:['material-plant'],eventName:'cultivation.plant.observed',
  execute:()=>{executions+=1;return{ok:true}}
 }))
 await assert.rejects(()=>engine.execute('plant.observe',{target:{type:'lot',id:'lot-1',organizationId:'org-1'}}),/no aplica/)
 assert.equal(executions,0)
 assert.equal(bus.published.length,0)
})

test('Action Engine aplica autorización y validación antes de persistir o ejecutar',async()=>{
 let executions=0
 const bus=publisher()
 const engine=createActionEngine({publishEvent:bus.publishEvent})
 engine.register(defineAction({
  id:'plant.harvest',label:'Cosechar',eventName:'cultivation.plant.harvested',
  authorize:({actor})=>actor.role==='operator'||'Permiso insuficiente',
  validate:({input})=>input.weight>0||'Peso inválido',
  execute:()=>{executions+=1;return{ok:true}}
 }))
 await assert.rejects(()=>engine.execute('plant.harvest',{target:{type:'material-plant',id:'p1',organizationId:'o1'},actor:{role:'viewer'},input:{weight:2}}),/Permiso insuficiente/)
 await assert.rejects(()=>engine.execute('plant.harvest',{target:{type:'material-plant',id:'p1',organizationId:'o1'},actor:{role:'operator'},input:{weight:0}}),/Peso inválido/)
 assert.equal(executions,0)
 assert.equal(bus.published.length,0)
})

test('acciones universales exponen mover, cambiar estado, cosechar y observar',async()=>{
 const calls=[]
 const bus=publisher()
 const commands={
  move:args=>{calls.push(['move',args]);return{destinationId:args.input.destinationId}},
  changeStatus:args=>{calls.push(['changeStatus',args]);return{status:args.input.status}},
  harvest:args=>{calls.push(['harvest',args]);return{harvested:true}},
  observe:args=>{calls.push(['observe',args]);return{title:args.input.title}}
 }
 const engine=createActionEngine({publishEvent:bus.publishEvent})
 registerUniversalActions(engine,commands)
 const target={type:'material-plant',id:'p1',organizationId:'o1'}
 assert.deepEqual(engine.list().map(item=>item.id),['object.move','object.change-status','object.harvest','object.observe'])
 await engine.execute('object.move',{target,input:{destinationId:'bed-2'}})
 await engine.execute('object.change-status',{target,input:{status:'flowering'}})
 await engine.execute('object.harvest',{target,input:{}})
 await engine.execute('object.observe',{target,input:{title:'Sin novedad'}})
 assert.deepEqual(calls.map(([name])=>name),['move','changeStatus','harvest','observe'])
 assert.equal(bus.published.length,8)
})

test('el resultado ejecutado queda desacoplado de mutaciones posteriores',async()=>{
 const source={nested:{value:1}}
 const bus=publisher()
 const engine=createActionEngine({publishEvent:bus.publishEvent})
 engine.register(defineAction({id:'object.snapshot',label:'Snapshot',eventName:'core.object.snapshotted',execute:()=>source}))
 const result=await engine.execute('object.snapshot',{target:{type:'object',id:'1',organizationId:'org'}})
 source.nested.value=2
 assert.equal(result.result.nested.value,1)
 assert.equal(Object.isFrozen(result.result),true)
 assert.equal(Object.isFrozen(result.result.nested),true)
})

test('bloquea la mutación si la intención no puede persistirse',async()=>{
 let executions=0
 const bus=publisher({failName:'core.action.requested'})
 const engine=createActionEngine({publishEvent:bus.publishEvent})
 engine.register(defineAction({id:'plant.harvest',label:'Cosechar',eventName:'cultivation.plant.harvested',execute:()=>{executions+=1;return{ok:true}}}))
 await assert.rejects(()=>engine.execute('plant.harvest',{target:{type:'material-plant',id:'p1',organizationId:'o1'}}),/intención/)
 assert.equal(executions,0)
})

test('requiere infraestructura de publicación antes de ejecutar',async()=>{
 let executions=0
 const engine=createActionEngine()
 engine.register(defineAction({id:'plant.observe',label:'Observar',eventName:'cultivation.plant.observed',execute:()=>{executions+=1;return{ok:true}}}))
 await assert.rejects(()=>engine.execute('plant.observe',{target:{type:'material-plant',id:'p1',organizationId:'o1'}}),/requiere publishEvent/)
 assert.equal(executions,0)
})

test('deduplica ejecuciones concurrentes con la misma clave',async()=>{
 let executions=0
 const bus=publisher()
 const engine=createActionEngine({publishEvent:bus.publishEvent})
 engine.register(defineAction({
  id:'plant.observe',label:'Observar',eventName:'cultivation.plant.observed',
  execute:async()=>{executions+=1;await new Promise(resolve=>setTimeout(resolve,10));return{ok:true}}
 }))
 const options={target:{type:'material-plant',id:'p1',organizationId:'o1'},input:{title:'A'},actionIdempotencyKey:'tap-1'}
 const[a,b]=await Promise.all([engine.execute('plant.observe',options),engine.execute('plant.observe',options)])
 assert.equal(executions,1)
 assert.strictEqual(a,b)
 assert.equal(bus.published.length,2)
})

test('rechaza reutilizar una clave con datos diferentes',async()=>{
 const bus=publisher()
 const engine=createActionEngine({publishEvent:bus.publishEvent})
 engine.register(defineAction({id:'plant.move',label:'Mover',eventName:'cultivation.plant.moved',execute:({input})=>({destinationId:input.destinationId})}))
 const base={target:{type:'material-plant',id:'p1',organizationId:'o1'},actionIdempotencyKey:'move-1'}
 await engine.execute('plant.move',{...base,input:{destinationId:'bed-1'}})
 await assert.rejects(()=>engine.execute('plant.move',{...base,input:{destinationId:'bed-2'}}),/datos diferentes/)
})

test('reporta fallo del evento final sin perder la intención previa',async()=>{
 let executions=0
 const bus=publisher({failName:'cultivation.plant.harvested'})
 const engine=createActionEngine({publishEvent:bus.publishEvent})
 engine.register(defineAction({id:'plant.harvest',label:'Cosechar',eventName:'cultivation.plant.harvested',execute:()=>{executions+=1;return{harvested:true}}}))
 await assert.rejects(()=>engine.execute('plant.harvest',{target:{type:'material-plant',id:'p1',organizationId:'o1'}}),/evento final/)
 assert.equal(executions,1)
 assert.equal(bus.published[0].name,'core.action.requested')
 assert.equal(bus.published[1].name,'cultivation.plant.harvested')
})

test('acota la retención de resultados idempotentes',async()=>{
 const bus=publisher()
 const engine=createActionEngine({publishEvent:bus.publishEvent,maxIdempotencyEntries:2})
 engine.register(defineAction({id:'object.observe',label:'Observar',eventName:'core.object.observed',execute:()=>({ok:true})}))
 const target={type:'object',id:'1',organizationId:'org'}
 await engine.execute('object.observe',{target,actionIdempotencyKey:'1'})
 await engine.execute('object.observe',{target,actionIdempotencyKey:'2'})
 await engine.execute('object.observe',{target,actionIdempotencyKey:'3'})
 assert.equal(engine.status().idempotencyEntries,2)
})
