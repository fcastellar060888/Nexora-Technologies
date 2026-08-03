import test from'node:test'
import assert from'node:assert/strict'
import{MATERIAL_PLANT_TYPES,materialPlantUnitById,materializeLotPlantUnits,projectLotPlantUnits,projectMaterialPlantUnits,selectedMaterialPlantUnits}from'../src/domain/materialPlantIdentity.js'

test('materializa cada vida con identidad persistente',()=>{
 const lot={id:'gm-lot-1',lotCode:'LAB-001',quantity:3,siteId:'site-1',geneticId:'gen-1',status:'Activa',createdAt:'2026-01-01T00:00:00.000Z'}
 let sequence=0
 const materialized=materializeLotPlantUnits(lot,{plantType:MATERIAL_PLANT_TYPES.GRANDMOTHER,idFactory:()=>`plant-${++sequence}`})
 const units=projectLotPlantUnits(lot,{plantType:MATERIAL_PLANT_TYPES.GRANDMOTHER,units:materialized})
 assert.equal(units.length,3)
 assert.deepEqual(units.map(item=>item.id),['plant-1','plant-2','plant-3'])
 assert.deepEqual(units.map(item=>item.code),['LAB-001-A001','LAB-001-A002','LAB-001-A003'])
 assert.ok(Object.isFrozen(units[0]))
})

test('una reducción de cantidad no elimina ni recicla vidas materializadas',()=>{
 const original={id:'g1',lotCode:'LAB-01',quantity:3,createdAt:'2026-01-01T00:00:00.000Z'}
 const units=materializeLotPlantUnits(original,{plantType:MATERIAL_PLANT_TYPES.GRANDMOTHER,idFactory:({unitIndex})=>`life-${unitIndex+1}`})
 const reduced={...original,quantity:1}
 assert.deepEqual(projectLotPlantUnits(reduced,{plantType:MATERIAL_PLANT_TYPES.GRANDMOTHER,units}).map(item=>item.id),['life-1','life-2','life-3'])
})

test('una ampliación del lote no inventa vidas sobre una población ya materializada',()=>{
 const original={id:'g1',lotCode:'LAB-01',quantity:1,createdAt:'2026-01-01T00:00:00.000Z'}
 const units=materializeLotPlantUnits(original,{plantType:MATERIAL_PLANT_TYPES.GRANDMOTHER,idFactory:()=>`life-1`})
 const expanded={...original,quantity:4}
 assert.equal(projectLotPlantUnits(expanded,{plantType:MATERIAL_PLANT_TYPES.GRANDMOTHER,units}).length,1)
 assert.deepEqual(materializeLotPlantUnits(expanded,{plantType:MATERIAL_PLANT_TYPES.GRANDMOTHER,existingUnits:units,idFactory:()=>{throw new Error('no debe crear')}}),units)
})

test('combina lotes actuales con entidades individuales sin perder compatibilidad',()=>{
 const state={
  grandmotherPlants:[{id:'g1',lotCode:'LAB-01',quantity:2,siteId:'s1',geneticId:'x'}],
  motherPlants:[{id:'m1',lotCode:'LM-01',quantity:2,siteId:'s1',geneticId:'x'}],
  materialPlantUnits:[{id:'mother-special',lotId:'m1',plantType:'MOTHER',unitIndex:1,code:'MADRE-ELITE-01',healthStatus:'En seguimiento'}]
 }
 const units=projectMaterialPlantUnits(state)
 assert.equal(units.length,3)
 assert.equal(materialPlantUnitById(state,'mother-special').code,'MADRE-ELITE-01')
 assert.equal(materialPlantUnitById(state,'mother-special').healthStatus,'En seguimiento')
 assert.equal(selectedMaterialPlantUnits(state,['material-plant:GRANDMOTHER:g1:1','mother-special']).length,2)
})

test('rechaza lotes sin identidad, tipos desconocidos e ids duplicados',()=>{
 assert.throws(()=>projectLotPlantUnits({quantity:1},{plantType:'MOTHER'}),/identificador estable/)
 assert.throws(()=>projectLotPlantUnits({id:'x',quantity:1},{plantType:'UNKNOWN'}),/inválido/)
 assert.throws(()=>materializeLotPlantUnits({id:'x',quantity:2},{plantType:'MOTHER',idFactory:()=>`same`}),/duplicadas/)
})
