import test from'node:test'
import assert from'node:assert/strict'
import{areaSquareMeters,bankCapacity,lengthToMeters,occupancyPercent,plantDensity}from'../src/domain/spaceMetrics.js'
import{CURRENT_SCHEMA_VERSION,migrateState}from'../src/services/stateMigration.js'

test('convierte centímetros y metros a una misma escala',()=>{
 assert.equal(lengthToMeters(250,'cm'),2.5)
 assert.equal(lengthToMeters(2.5,'m'),2.5)
 assert.equal(areaSquareMeters(250,120,'cm'),3)
})

test('calcula capacidad de bandejas, ocupación y densidad',()=>{
 const trays=[{quantity:4,cellsPerTray:50},{quantity:2,cellsPerTray:72}]
 assert.equal(bankCapacity(trays),344)
 assert.equal(occupancyPercent(172,344),50)
 assert.equal(plantDensity(150,3),50)
})

test('migra dimensiones de naves y bancos al esquema actual',()=>{
 const state=migrateState({houses:[{id:'h1',length:'12',width:'6'}],propagationBanks:[{id:'b1',dimensionUnit:'cm',length:'250',width:'120',currentPlants:'100',trays:[{quantity:'2',cellsPerTray:'50'}]}]})
 assert.equal(CURRENT_SCHEMA_VERSION,10)
 assert.equal(state.schemaVersion,10)
 assert.equal(state.houses[0].dimensionUnit,'m')
 assert.equal(state.houses[0].length,12)
 assert.equal(state.propagationBanks[0].currentPlants,100)
 assert.equal(state.propagationBanks[0].trays[0].quantity,2)
})
