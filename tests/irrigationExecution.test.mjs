import test from'node:test'
import assert from'node:assert/strict'
import{createTankPreparation,executeTankPreparation,gramsToInventoryUnit,registerIrrigationApplication}from'../src/domain/irrigationExecution.js'

test('convierte gramos formulados a la unidad de inventario',()=>{
 assert.equal(gramsToInventoryUnit(500,'g'),500)
 assert.equal(gramsToInventoryUnit(500,'kg'),0.5)
 assert.throws(()=>gramsToInventoryUnit(500,'L'),/g o kg/)
})

test('crea preparación solo desde fórmula aprobada',()=>{
 const state={formulations:[{id:'f1',status:'Aprobada',siteId:'s1',volumeL:1000,stage:'Vegetativo',items:[{productId:'n1',tank:'A',grams:500}]}],nutrientProducts:[{id:'n1',inventoryProductId:'p1'}],tankPreparations:[]}
 const next=createTankPreparation(state,{id:'prep1',formulationId:'f1',createdAt:'2026-07-30T12:00:00.000Z'})
 assert.equal(next.tankPreparations[0].status,'Pendiente')
 assert.equal(next.tankPreparations[0].items[0].requiredQuantity,500)
 assert.equal(next.tankPreparations[0].items[0].inventoryProductId,'p1')
})

test('ejecuta preparación, convierte kg, genera costo y orden',()=>{
 const state={
  formulations:[{id:'f1',status:'Aprobada',siteId:'s1',volumeL:1000,stage:'Vegetativo',items:[{productId:'n1',tank:'A',grams:500}]}],
  nutrientProducts:[{id:'n1',inventoryProductId:'p1',cost:2}],products:[{id:'p1',unit:'kg',cost:3000}],
  inventoryLots:[{id:'l1',productId:'p1',siteId:'s1',quantity:0.8}],inventoryMovements:[],costEntries:[],workOrders:[],tankPreparations:[]
 }
 const created=createTankPreparation(state,{id:'prep1',formulationId:'f1',createdAt:'2026-07-30T12:00:00.000Z'})
 const executed=executeTankPreparation(created,{preparationId:'prep1',allocations:{'f1-0':'l1'},responsible:'Ana',executedAt:'2026-07-30T13:00:00.000Z',costEntryId:'c1',workOrderId:'w1'})
 assert.equal(executed.inventoryLots[0].quantity,0.30000000000000004)
 assert.equal(executed.inventoryMovements[0].signedQuantity,-0.5)
 assert.equal(executed.inventoryMovements[0].sourceType,'MirfePreparation')
 assert.equal(executed.tankPreparations[0].status,'Preparada')
 assert.equal(executed.tankPreparations[0].items[0].consumedUnit,'kg')
 assert.equal(executed.tankPreparations[0].totalCost,1500)
 assert.equal(executed.costEntries[0].amount,1500)
 assert.equal(executed.workOrders[0].preparationId,'prep1')
})

test('bloquea lote de otra sede',()=>{
 const state={formulations:[],nutrientProducts:[{id:'n1',inventoryProductId:'p1'}],products:[{id:'p1',unit:'g'}],inventoryLots:[{id:'l1',productId:'p1',siteId:'s2',quantity:10}],inventoryMovements:[],costEntries:[],workOrders:[],tankPreparations:[{id:'prep1',siteId:'s1',status:'Pendiente',items:[{id:'i1',nutrientProductId:'n1',inventoryProductId:'p1',requiredQuantity:20,tank:'A'}]}]}
 assert.throws(()=>executeTankPreparation(state,{preparationId:'prep1',allocations:{i1:'l1'}}),/sede/)
})

test('registra aplicación y completa la orden asociada',()=>{
 const state={tankPreparations:[{id:'prep1',formulationId:'f1',siteId:'s1',volumeL:1000,status:'Preparada'}],irrigationApplications:[],workOrders:[{id:'w1',preparationId:'prep1',status:'Pendiente'}]}
 const next=registerIrrigationApplication(state,{id:'a1',preparationId:'prep1',volumeL:900,createdAt:'2026-07-30T15:00:00.000Z'})
 assert.equal(next.tankPreparations[0].status,'Aplicada')
 assert.equal(next.workOrders[0].status,'Completada')
 assert.equal(next.irrigationApplications[0].volumeL,900)
})
