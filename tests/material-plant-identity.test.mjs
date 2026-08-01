import test from'node:test'
import assert from'node:assert/strict'
import{MATERIAL_PLANT_TYPES,materialPlantUnitById,projectLotPlantUnits,projectMaterialPlantUnits,selectedMaterialPlantUnits}from'../src/domain/materialPlantIdentity.js'

test('proyecta cada cantidad de lote como una planta individual estable',()=>{
 const lot={id:'gm-lot-1',lotCode:'LAB-001',quantity:3,siteId:'site-1',geneticId:'gen-1',status:'Activa'}
 const units=projectLotPlantUnits(lot,{plantType:MATERIAL_PLANT_TYPES.GRANDMOTHER})
 assert.equal(units.length,3)
 assert.deepEqual(units.map(item=>item.id),['gm-lot-1:GRANDMOTHER:1','gm-lot-1:GRANDMOTHER:2','gm-lot-1:GRANDMOTHER:3'])
 assert.deepEqual(units.map(item=>item.code),['LAB-001-A001','LAB-001-A002','LAB-001-A003'])
 assert.ok(Object.isFrozen(units[0]))
})

test('combina lotes actuales con overrides individuales sin perder compatibilidad',()=>{
 const state={
  grandmotherPlants:[{id:'g1',lotCode:'LAB-01',quantity:2,siteId:'s1',geneticId:'x'}],
  motherPlants:[{id:'m1',lotCode:'LM-01',quantity:2,siteId:'s1',geneticId:'x'}],
  materialPlantUnits:[{id:'mother-special',lotId:'m1',plantType:'MOTHER',unitIndex:1,code:'MADRE-ELITE-01',healthStatus:'En seguimiento'}]
 }
 const units=projectMaterialPlantUnits(state)
 assert.equal(units.length,4)
 assert.equal(materialPlantUnitById(state,'mother-special').code,'MADRE-ELITE-01')
 assert.equal(materialPlantUnitById(state,'mother-special').healthStatus,'En seguimiento')
 assert.equal(selectedMaterialPlantUnits(state,['g1:GRANDMOTHER:1','mother-special']).length,2)
})

test('rechaza lotes sin identidad o tipos de planta desconocidos',()=>{
 assert.throws(()=>projectLotPlantUnits({quantity:1},{plantType:'MOTHER'}),/identificador estable/)
 assert.throws(()=>projectLotPlantUnits({id:'x',quantity:1},{plantType:'UNKNOWN'}),/inválido/)
})
