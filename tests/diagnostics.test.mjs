import test from'node:test'
import assert from'node:assert/strict'
import{runDiagnostics}from'../src/domain/diagnostics.js'
import{migrateState}from'../src/services/stateMigration.js'

const byName=(checks,name)=>checks.find(x=>x.name===name)

test('estado migrado vacío cumple esquema y balances',()=>{
 const checks=runDiagnostics(migrateState({}))
 assert.equal(byName(checks,'Versión del esquema').status,true)
 assert.equal(byName(checks,'Balance de producto terminado').status,true)
 assert.equal(byName(checks,'Balance de masa productivo').status,true)
})

test('detecta descuadre de producto terminado',()=>{
 const state=migrateState({finishedGoods:[{id:'fg1',initialGrams:1000,availableGrams:700,reservedGrams:200,soldGrams:200}]})
 state.finishedGoods[0].initialGrams=1000
 const check=byName(runDiagnostics(state),'Balance de producto terminado')
 assert.equal(check.status,false)
 assert.equal(check.level,'error')
})

test('detecta aumento artificial de peso y venta huérfana',()=>{
 const state=migrateState({propagationBatches:[{id:'l1',productionLedger:[{inputGrams:100,outputGrams:110}]}],sales:[{id:'s1',stockId:'missing',grams:10}]})
 const checks=runDiagnostics(state)
 assert.equal(byName(checks,'Balance de masa productivo').status,false)
 assert.equal(byName(checks,'Ventas con existencia válida').status,false)
})
