import test from'node:test'
import assert from'node:assert/strict'
import{migrateMaterialPlantIdentity}from'../src/services/materialPlantPersistence.js'
import{projectMaterialPlantUnits}from'../src/domain/materialPlantIdentity.js'

test('AUD-F017: materializa lotes históricos una sola vez',()=>{
 const legacy={
  grandmotherPlants:[{id:'g1',lotCode:'LAB-1',quantity:2,createdAt:'2026-01-01T00:00:00.000Z'}],
  motherPlants:[{id:'m1',lotCode:'LM-1',quantity:1,createdAt:'2026-02-01T00:00:00.000Z'}]
 }
 const first=migrateMaterialPlantIdentity(legacy)
 const second=migrateMaterialPlantIdentity({...first,grandmotherPlants:[{...first.grandmotherPlants[0],quantity:9}]})
 assert.deepEqual(first.materialPlantUnits.map(item=>item.id),[
  'material-plant:GRANDMOTHER:g1:1',
  'material-plant:GRANDMOTHER:g1:2',
  'material-plant:MOTHER:m1:1'
 ])
 assert.deepEqual(second.materialPlantUnits,first.materialPlantUnits)
})

test('AUD-F017: retirar una vida no permite que el lote la sustituya',()=>{
 const migrated=migrateMaterialPlantIdentity({
  grandmotherPlants:[{id:'g1',lotCode:'LAB-1',quantity:2,createdAt:'2026-01-01T00:00:00.000Z'}],
  motherPlants:[]
 })
 const retired={...migrated,materialPlantUnits:migrated.materialPlantUnits.map((item,index)=>index===0?{...item,status:'Retirada',retiredAt:'2026-06-01T00:00:00.000Z'}:item)}
 const afterQuantityChange=migrateMaterialPlantIdentity({...retired,grandmotherPlants:[{...retired.grandmotherPlants[0],quantity:2}]})
 const projected=projectMaterialPlantUnits(afterQuantityChange)
 assert.equal(projected.length,2)
 assert.equal(projected[0].status,'Retirada')
 assert.equal(projected[0].retiredAt,'2026-06-01T00:00:00.000Z')
})

test('AUD-F017: entidades ya materializadas conservan ids externos',()=>{
 const state={
  grandmotherPlants:[{id:'g1',lotCode:'LAB-1',quantity:5}],
  motherPlants:[],
  materialPlantUnits:[{id:'uuid-life-1',lotId:'g1',plantType:'GRANDMOTHER',unitIndex:0,code:'A-001',createdAt:'2026-01-01T00:00:00.000Z'}]
 }
 const migrated=migrateMaterialPlantIdentity(state)
 assert.equal(migrated.materialPlantUnits.length,1)
 assert.equal(migrated.materialPlantUnits[0].id,'uuid-life-1')
})
