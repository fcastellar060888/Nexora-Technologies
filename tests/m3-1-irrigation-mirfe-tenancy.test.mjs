import test from'node:test'
import assert from'node:assert/strict'
import{
 backfillIrrigationMirfeOwnership,
 findIrrigationMirfeRecord,
 mutateIrrigationMirfeState,
 scopeIrrigationMirfeState
}from'../src/domain/irrigationMirfeTenancy.js'
import{createTankPreparation,executeTankPreparation,registerIrrigationApplication}from'../src/domain/irrigationExecution.js'

const companies=[{id:'org-a'},{id:'org-b'}]
const sites=[
 {id:'site-1',organizationId:'org-a',name:'A'},
 {id:'site-1',organizationId:'org-b',name:'B'}
]

function baseState(organizationId='org-a'){
 return{companies,currentContext:{companyId:organizationId},sites,
  houses:[],beds:[],plantPositions:[],genetics:[],products:[],inventoryLots:[],inventoryMovements:[],
  waterAnalyses:[],nutrientProducts:[],nutrientObjectives:[],irrigationPlans:[],formulations:[],tankPreparations:[],
  irrigationApplications:[],workOrders:[],costEntries:[],mirfePrograms:[],mirfeMonitoring:[],mirfeReinforcements:[],irrigationCorrections:[],irrigationHistory:[]}
}

test('M31-F002: la vista tenant separa ids repetidos y la búsqueda elige la empresa activa',()=>{
 const state={...baseState(),waterAnalyses:[
  {id:'water-1',organizationId:'org-b',siteId:'site-1',laboratory:'B'},
  {id:'water-1',organizationId:'org-a',siteId:'site-1',laboratory:'A'},
  {id:'legacy-ambiguous',siteId:'site-1',laboratory:'sin dueño'}
 ]}
 const view=scopeIrrigationMirfeState(state)
 assert.deepEqual(view.waterAnalyses.map(item=>item.laboratory),['A'])
 assert.equal(findIrrigationMirfeRecord(state,'waterAnalyses','water-1').laboratory,'A')
 assert.throws(()=>findIrrigationMirfeRecord(state,'waterAnalyses','legacy-ambiguous'),/ownership inequívoco/)
})

test('M31-F002: merge tenant conserva homónimos extranjeros y fija organizationId',()=>{
 const state={...baseState(),waterAnalyses:[
  {id:'water-1',organizationId:'org-b',siteId:'site-1',status:'Vigente'},
  {id:'water-1',organizationId:'org-a',siteId:'site-1',status:'Pendiente'}
 ]}
 const next=mutateIrrigationMirfeState(state,tenant=>({...tenant,waterAnalyses:[
  ...tenant.waterAnalyses.map(item=>({...item,status:'Histórico'})),
  {id:'water-2',siteId:'site-1',status:'Vigente'}
 ]}))
 assert.equal(next.waterAnalyses.find(item=>item.organizationId==='org-b').status,'Vigente')
 assert.equal(next.waterAnalyses.find(item=>item.id==='water-1'&&item.organizationId==='org-a').status,'Histórico')
 assert.equal(next.waterAnalyses.find(item=>item.id==='water-2').organizationId,'org-a')
})

test('M31-F002: mutaciones extranjeras y referencias a otra empresa fallan cerrado',()=>{
 const state={...baseState(),sites:[{id:'site-b',organizationId:'org-b'}],formulations:[]}
 assert.throws(()=>mutateIrrigationMirfeState(state,tenant=>({...tenant,waterAnalyses:[{id:'w',organizationId:'org-b',siteId:'site-b'}]})),/otra empresa/)
 assert.throws(()=>mutateIrrigationMirfeState(state,tenant=>({...tenant,formulations:[{id:'f',siteId:'site-b',items:[]}]})),/sede pertenece a otra empresa/)
})

test('M31-F002: backfill conserva lo ambiguo y migra ownership causal seguro',()=>{
 const state={...baseState(),
  sites:[{id:'site-a',organizationId:'org-a'},{id:'shared',organizationId:'org-a'},{id:'shared',organizationId:'org-b'}],
  genetics:[{id:'g-a',organizationId:'org-a'}],products:[{id:'p-a',organizationId:'org-a'}],
  waterAnalyses:[{id:'w-a',siteId:'site-a'},{id:'w-shared',siteId:'shared'}],
  nutrientProducts:[{id:'n-a',inventoryProductId:'p-a'}],nutrientObjectives:[{id:'o-a',geneticId:'g-a'}],
  irrigationPlans:[{id:'plan-a',siteId:'site-a'}],
  formulations:[{id:'f-a',siteId:'site-a',items:[]}],
  tankPreparations:[{id:'prep-a',formulationId:'f-a',siteId:'site-a',items:[]}],
  irrigationApplications:[{id:'app-a',preparationId:'prep-a',formulationId:'f-a',siteId:'site-a'}]
 }
 const migrated=backfillIrrigationMirfeOwnership(state)
 for(const collection of['waterAnalyses','nutrientProducts','nutrientObjectives','irrigationPlans','formulations','tankPreparations','irrigationApplications']){
  const record=migrated[collection].find(item=>item.id!=='w-shared')
  assert.equal(record.organizationId,'org-a',collection)
 }
 assert.equal(migrated.waterAnalyses.find(item=>item.id==='w-shared').organizationId,undefined)
})

test('M31-F002: creación de preparación usa fórmula y productos del tenant activo',()=>{
 const state={...baseState(),products:[
  {id:'p-1',organizationId:'org-b',unit:'kg'},{id:'p-1',organizationId:'org-a',unit:'kg'}
 ],nutrientProducts:[
  {id:'n-1',organizationId:'org-b',inventoryProductId:'foreign'},
  {id:'n-1',organizationId:'org-a',inventoryProductId:'p-1'}
 ],formulations:[
  {id:'f-1',organizationId:'org-b',siteId:'site-1',status:'Aprobada',volumeL:200,items:[{productId:'n-1',grams:99}]},
  {id:'f-1',organizationId:'org-a',siteId:'site-1',status:'Aprobada',volumeL:1000,stage:'Vegetativo',items:[{productId:'n-1',tank:'A',grams:500}]}
 ]}
 const next=createTankPreparation(state,{id:'prep-1',formulationId:'f-1',createdAt:'2026-08-16T01:00:00.000Z'})
 const preparation=next.tankPreparations.find(item=>item.organizationId==='org-a')
 assert.equal(preparation.volumeL,1000)
 assert.equal(preparation.items[0].inventoryProductId,'p-1')
 assert.equal(preparation.organizationId,'org-a')
})

test('M31-F002: ejecución descuenta solo el lote homónimo activo y etiqueta derivados',()=>{
 const state={...baseState(),products:[
  {id:'p-1',organizationId:'org-b',unit:'kg',cost:9000},{id:'p-1',organizationId:'org-a',unit:'kg',cost:3000}
 ],nutrientProducts:[
  {id:'n-1',organizationId:'org-b',inventoryProductId:'p-1'},
  {id:'n-1',organizationId:'org-a',inventoryProductId:'p-1'}
 ],formulations:[
  {id:'f-1',organizationId:'org-b',siteId:'site-1',items:[]},
  {id:'f-1',organizationId:'org-a',siteId:'site-1',items:[]}
 ],inventoryLots:[
  {id:'lot-1',organizationId:'org-b',productId:'p-1',siteId:'site-1',quantity:8},
  {id:'lot-1',organizationId:'org-a',productId:'p-1',siteId:'site-1',quantity:0.8}
 ],tankPreparations:[
  {id:'prep-1',organizationId:'org-b',formulationId:'f-1',siteId:'site-1',status:'Pendiente',items:[]},
  {id:'prep-1',organizationId:'org-a',formulationId:'f-1',siteId:'site-1',volumeL:1000,stage:'Vegetativo',status:'Pendiente',items:[{id:'i-1',nutrientProductId:'n-1',inventoryProductId:'p-1',requiredQuantity:500,tank:'A'}]}
 ]}
 const next=executeTankPreparation(state,{preparationId:'prep-1',allocations:{'i-1':'lot-1'},responsible:'Ana',executedAt:'2026-08-16T02:00:00.000Z',costEntryId:'cost-1',workOrderId:'order-1'})
 assert.equal(next.inventoryLots.find(item=>item.organizationId==='org-b').quantity,8)
 assert.equal(next.inventoryLots.find(item=>item.organizationId==='org-a').quantity,0.30000000000000004)
 assert.equal(next.tankPreparations.find(item=>item.organizationId==='org-b').status,'Pendiente')
 assert.equal(next.tankPreparations.find(item=>item.organizationId==='org-a').status,'Preparada')
 for(const collection of['inventoryMovements','costEntries','workOrders'])assert.ok(next[collection].every(item=>item.organizationId==='org-a'),collection)
})

test('M31-F002: aplicación completa solo preparación y orden de la empresa activa',()=>{
 const state={...baseState(),formulations:[
  {id:'f-1',organizationId:'org-b',siteId:'site-1',items:[]},{id:'f-1',organizationId:'org-a',siteId:'site-1',items:[]}
 ],tankPreparations:[
  {id:'prep-1',organizationId:'org-b',formulationId:'f-1',siteId:'site-1',volumeL:500,status:'Preparada'},
  {id:'prep-1',organizationId:'org-a',formulationId:'f-1',siteId:'site-1',volumeL:1000,status:'Preparada'}
 ],workOrders:[
  {id:'order-1',organizationId:'org-b',preparationId:'prep-1',siteId:'site-1',status:'Pendiente'},
  {id:'order-1',organizationId:'org-a',preparationId:'prep-1',siteId:'site-1',status:'Pendiente'}
 ]}
 const next=registerIrrigationApplication(state,{id:'app-1',preparationId:'prep-1',volumeL:900,createdAt:'2026-08-16T03:00:00.000Z'})
 assert.equal(next.tankPreparations.find(item=>item.organizationId==='org-b').status,'Preparada')
 assert.equal(next.tankPreparations.find(item=>item.organizationId==='org-a').status,'Aplicada')
 assert.equal(next.workOrders.find(item=>item.organizationId==='org-b').status,'Pendiente')
 assert.equal(next.workOrders.find(item=>item.organizationId==='org-a').status,'Completada')
 assert.equal(next.irrigationApplications[0].organizationId,'org-a')
})

test('M31-F002: compatibilidad histórica local sigue operativa y gana ownership explícito',()=>{
 const state={formulations:[{id:'f-1',status:'Aprobada',siteId:'s-1',volumeL:1000,items:[{productId:'n-1',grams:100}]}],nutrientProducts:[{id:'n-1',inventoryProductId:'p-1'}],tankPreparations:[]}
 const next=createTankPreparation(state,{id:'prep-1',formulationId:'f-1',createdAt:'2026-08-16T04:00:00.000Z'})
 assert.equal(next.tankPreparations[0].organizationId,'local-installation')
})

test('M31-F002: una referencia disponible únicamente en otro tenant no puede ejecutarse',()=>{
 const state={...baseState(),formulations:[{id:'f-foreign',organizationId:'org-b',siteId:'site-1',status:'Aprobada',items:[]}]}
 assert.throws(()=>createTankPreparation(state,{id:'prep',formulationId:'f-foreign'}),/formulación válida/)
})
