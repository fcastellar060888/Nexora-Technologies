import test from'node:test'
import assert from'node:assert/strict'
import{createActionEngine,defineAction,registerUniversalActions}from'../src/core/actions/index.js'

test('Action Engine registra y ejecuta una acción publicando su evento de dominio',async()=>{
 const published=[]
 const engine=createActionEngine({publishEvent:async event=>{published.push(event);return{eventId:'evt-1'}}})
 engine.register(defineAction({
  id:'plant.move',label:'Mover planta',targetTypes:['material-plant'],eventName:'cultivation.plant.moved',
  validate:({input})=>input.destinationId?true:'Destino obligatorio',
  execute:({target,input})=>({plantId:target.id,destinationId:input.destinationId})
 }))
 const result=await engine.execute('plant.move',{
  target:{type:'material-plant',id:'plant-1',organizationId:'org-1',siteId:'site-1'},
  input:{destinationId:'bed-9'}
 })
 assert.equal(result.actionId,'plant.move')
 assert.equal(result.result.destinationId,'bed-9')
 assert.equal(published.length,1)
 assert.equal(published[0].name,'cultivation.plant.moved')
 assert.equal(published[0].aggregateId,'plant-1')
 assert.equal(published[0].payload.executionId,result.executionId)
})

test('Action Engine bloquea tipos de objeto no permitidos antes de mutar',async()=>{
 let executions=0
 const engine=createActionEngine()
 engine.register(defineAction({
  id:'plant.observe',label:'Observar',targetTypes:['material-plant'],eventName:'cultivation.plant.observed',
  execute:()=>{executions+=1;return{ok:true}}
 }))
 await assert.rejects(()=>engine.execute('plant.observe',{target:{type:'lot',id:'lot-1',organizationId:'org-1'}}),/no aplica/)
 assert.equal(executions,0)
})

test('Action Engine aplica autorización y validación antes de execute',async()=>{
 let executions=0
 const engine=createActionEngine()
 engine.register(defineAction({
  id:'plant.harvest',label:'Cosechar',eventName:'cultivation.plant.harvested',
  authorize:({actor})=>actor.role==='operator'||'Permiso insuficiente',
  validate:({input})=>input.weight>0||'Peso inválido',
  execute:()=>{executions+=1;return{ok:true}}
 }))
 await assert.rejects(()=>engine.execute('plant.harvest',{target:{type:'material-plant',id:'p1',organizationId:'o1'},actor:{role:'viewer'},input:{weight:2}}),/Permiso insuficiente/)
 await assert.rejects(()=>engine.execute('plant.harvest',{target:{type:'material-plant',id:'p1',organizationId:'o1'},actor:{role:'operator'},input:{weight:0}}),/Peso inválido/)
 assert.equal(executions,0)
})

test('acciones universales exponen mover, cambiar estado, cosechar y observar',async()=>{
 const calls=[]
 const commands={
  move:args=>{calls.push(['move',args]);return{destinationId:args.input.destinationId}},
  changeStatus:args=>{calls.push(['changeStatus',args]);return{status:args.input.status}},
  harvest:args=>{calls.push(['harvest',args]);return{harvested:true}},
  observe:args=>{calls.push(['observe',args]);return{title:args.input.title}}
 }
 const engine=createActionEngine()
 registerUniversalActions(engine,commands)
 const target={type:'material-plant',id:'p1',organizationId:'o1'}
 assert.deepEqual(engine.list().map(item=>item.id),['object.move','object.change-status','object.harvest','object.observe'])
 await engine.execute('object.move',{target,input:{destinationId:'bed-2'}})
 await engine.execute('object.change-status',{target,input:{status:'flowering'}})
 await engine.execute('object.harvest',{target,input:{}})
 await engine.execute('object.observe',{target,input:{title:'Sin novedad'}})
 assert.deepEqual(calls.map(([name])=>name),['move','changeStatus','harvest','observe'])
})

test('el resultado ejecutado queda desacoplado de mutaciones posteriores',async()=>{
 const source={nested:{value:1}}
 const engine=createActionEngine()
 engine.register(defineAction({id:'object.snapshot',label:'Snapshot',eventName:'core.object.snapshotted',execute:()=>source}))
 const result=await engine.execute('object.snapshot',{target:{type:'object',id:'1',organizationId:'org'}})
 source.nested.value=2
 assert.equal(result.result.nested.value,1)
 assert.equal(Object.isFrozen(result.result),true)
 assert.equal(Object.isFrozen(result.result.nested),true)
})
