import test from'node:test'
import assert from'node:assert/strict'
import{CURRENT_SCHEMA_VERSION,migrateState}from'../src/services/stateMigration.js'

test('normaliza colecciones ausentes y contexto',()=>{
 const state=migrateState({})
 assert.equal(state.schemaVersion,CURRENT_SCHEMA_VERSION)
 assert.deepEqual(state.sales,[])
 assert.equal(state.currentContext.week,1)
})

test('migra producto terminado y ventas históricas',()=>{
 const state=migrateState({finishedGoods:[{id:'fg1',availableGrams:'600',soldGrams:'400'}],sales:[{id:'s1',grams:'400',pricePerGram:'2',exchangeRate:'4000'}]})
 assert.deepEqual(state.finishedGoods[0],{id:'fg1',initialGrams:1000,availableGrams:600,reservedGrams:0,soldGrams:400})
 assert.equal(state.sales[0].status,'Despachada')
 assert.equal(state.sales[0].totalOriginal,800)
 assert.equal(state.sales[0].totalBase,3200000)
})

test('migra lotes productivos sin ledger',()=>{
 const state=migrateState({propagationBatches:[{id:'l1',quantity:'10'}]})
 assert.equal(state.propagationBatches[0].activeQuantity,10)
 assert.deepEqual(state.propagationBatches[0].productionLedger,[])
})

test('convierte preparación antigua agrupada por tanques',()=>{
 const state=migrateState({
  nutrientProducts:[{id:'n1',inventoryProductId:'p1'}],
  tankPreparations:[{id:'prep1',tanks:{A:[{productId:'n1',grams:'500'}]}}]
 })
 const item=state.tankPreparations[0].items[0]
 assert.equal(state.tankPreparations[0].status,'Pendiente')
 assert.equal(item.nutrientProductId,'n1')
 assert.equal(item.inventoryProductId,'p1')
 assert.equal(item.requiredQuantity,500)
 assert.equal(item.requiredUnit,'g')
})

test('normaliza campos de ejecución MIPE',()=>{
 const state=migrateState({treatments:[{id:'t1'}]})
 assert.equal(state.treatments[0].status,'Programado')
 assert.equal(state.treatments[0].totalCost,0)
 assert.equal(state.treatments[0].harvestRestrictedUntil,'')
})
