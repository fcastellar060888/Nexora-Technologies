import test from'node:test'
import assert from'node:assert/strict'
import{availableTransitions,createWorkflowInstance,defineWorkflow,transitionWorkflow,verifyWorkflowHistory}from'../src/domain/workflowCore.js'

const productionWorkflow=defineWorkflow({
 id:'production-lot',initialState:'planned',states:['planned','active','harvest-ready','harvested','closed','cancelled'],terminalStates:['closed','cancelled'],
 transitions:[
  {name:'start',from:'planned',to:'active'},
  {name:'mark-harvest-ready',from:'active',to:'harvest-ready',guard:({context})=>context.openFindings===0,guardMessage:'El lote tiene hallazgos abiertos'},
  {name:'harvest',from:'harvest-ready',to:'harvested'},
  {name:'close',from:'harvested',to:'closed'},
  {name:'cancel',from:['planned','active'],to:'cancelled'}
 ]
})

test('crea una instancia con evento inicial e historial inmutable',()=>{
 const instance=createWorkflowInstance(productionWorkflow,{entityType:'productionLot',entityId:'LOT-001',actor:{id:'user-1'}})
 assert.equal(instance.state,'planned');assert.equal(instance.version,1);assert.equal(instance.history.length,1)
 assert.equal(instance.history[0].type,'workflow.created');assert.equal(Object.isFrozen(instance),true);assert.equal(Object.isFrozen(instance.history),true)
})

test('ejecuta transiciones válidas sin mutar la instancia previa',()=>{
 const initial=createWorkflowInstance(productionWorkflow,{entityType:'productionLot',entityId:'LOT-002'})
 const active=transitionWorkflow(productionWorkflow,initial,'start',{actor:{name:'Operador'}})
 assert.equal(initial.state,'planned');assert.equal(active.state,'active');assert.equal(active.version,2)
 assert.equal(active.history.at(-1).from,'planned');assert.equal(active.history.at(-1).to,'active')
})

test('rechaza transiciones fuera de secuencia',()=>{
 const initial=createWorkflowInstance(productionWorkflow,{entityType:'productionLot',entityId:'LOT-003'})
 assert.throws(()=>transitionWorkflow(productionWorkflow,initial,'harvest'),/no está permitida/)
})

test('aplica guards operativos y expone transiciones disponibles',()=>{
 const active=transitionWorkflow(productionWorkflow,createWorkflowInstance(productionWorkflow,{entityType:'productionLot',entityId:'LOT-004'}),'start')
 assert.deepEqual(availableTransitions(productionWorkflow,active,{openFindings:2}),['cancel'])
 assert.throws(()=>transitionWorkflow(productionWorkflow,active,'mark-harvest-ready',{context:{openFindings:2}}),/hallazgos abiertos/)
 assert.equal(transitionWorkflow(productionWorkflow,active,'mark-harvest-ready',{context:{openFindings:0}}).state,'harvest-ready')
})

test('impide modificar workflows cerrados',()=>{
 let instance=createWorkflowInstance(productionWorkflow,{entityType:'productionLot',entityId:'LOT-005'})
 instance=transitionWorkflow(productionWorkflow,instance,'start')
 instance=transitionWorkflow(productionWorkflow,instance,'mark-harvest-ready',{context:{openFindings:0}})
 instance=transitionWorkflow(productionWorkflow,instance,'harvest')
 instance=transitionWorkflow(productionWorkflow,instance,'close')
 assert.throws(()=>transitionWorkflow(productionWorkflow,instance,'close'),/está cerrado/)
})

test('verifica continuidad, versión y estado del historial',()=>{
 let instance=createWorkflowInstance(productionWorkflow,{entityType:'productionLot',entityId:'LOT-006'})
 instance=transitionWorkflow(productionWorkflow,instance,'start')
 assert.deepEqual(verifyWorkflowHistory(productionWorkflow,instance),{valid:true,errors:[]})
 const invalid=verifyWorkflowHistory(productionWorkflow,{...instance,state:'harvested'})
 assert.equal(invalid.valid,false);assert.match(invalid.errors.join(' '),/estado actual/)
})
