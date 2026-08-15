import test from'node:test'
import assert from'node:assert/strict'
import{MATERIAL_PLANT_TYPES,materialPlantUnitById,projectLotPlantUnits,projectMaterialPlantUnits}from'../src/domain/materialPlantIdentity.js'
import{createMaterialPlantPassportFromState}from'../src/core/passport/materialPlantPassport.js'

const CREATED='2026-01-01T00:00:00.000Z'
const LOT_UPDATED='2026-03-04T05:06:07.000Z'
const UNIT_UPDATED='2026-04-05T06:07:08.000Z'

test('AUD-F019: una unidad virtual hereda la actualización posterior del lote',()=>{
 const lot={id:'g-1',lotCode:'LAB-1',quantity:1,createdAt:CREATED,updatedAt:LOT_UPDATED,status:'En recuperación'}
 const [unit]=projectLotPlantUnits(lot,{plantType:MATERIAL_PLANT_TYPES.GRANDMOTHER})
 assert.equal(unit.createdAt,CREATED)
 assert.equal(unit.updatedAt,LOT_UPDATED)
 assert.equal(unit.status,'En recuperación')
})

test('AUD-F019: la actualización propia más reciente de una unidad conserva autoridad',()=>{
 const lot={id:'m-1',lotCode:'MAD-1',quantity:1,createdAt:CREATED,updatedAt:LOT_UPDATED}
 const units=[{id:'life-1',lotId:'m-1',plantType:MATERIAL_PLANT_TYPES.MOTHER,unitIndex:0,createdAt:CREATED,updatedAt:UNIT_UPDATED,status:'Activa'}]
 const [unit]=projectLotPlantUnits(lot,{plantType:MATERIAL_PLANT_TYPES.MOTHER,units})
 assert.equal(unit.createdAt,CREATED)
 assert.equal(unit.updatedAt,UNIT_UPDATED)
})

test('AUD-F019: una fecha antigua de unidad no oculta una modificación nueva del lote',()=>{
 const state={
  grandmotherPlants:[{id:'g-1',lotCode:'LAB-1',quantity:1,createdAt:CREATED,updatedAt:LOT_UPDATED}],
  motherPlants:[],
  materialPlantUnits:[{id:'life-1',lotId:'g-1',plantType:MATERIAL_PLANT_TYPES.GRANDMOTHER,unitIndex:0,createdAt:CREATED,updatedAt:CREATED}],
  materialPlantIdentityRegistry:{'GRANDMOTHER:g-1':true}
 }
 assert.equal(materialPlantUnitById(state,'life-1').updatedAt,LOT_UPDATED)
 assert.equal(projectMaterialPlantUnits(state)[0].updatedAt,LOT_UPDATED)
})

test('AUD-F019: el Passport refleja la versión temporal efectiva de la unidad',()=>{
 const state={
  currentContext:{companyId:'org-1'},
  sites:[],genetics:[],attachments:[],findings:[],plantEvents:[],timelineEntries:[],motherPlants:[],propagationBatches:[],
  grandmotherPlants:[{id:'g-1',lotCode:'LAB-1',quantity:1,createdAt:CREATED,updatedAt:LOT_UPDATED}],
  materialPlantUnits:[{id:'life-1',lotId:'g-1',plantType:MATERIAL_PLANT_TYPES.GRANDMOTHER,unitIndex:0,code:'LAB-1-A001',createdAt:CREATED,updatedAt:CREATED}],
  materialPlantIdentityRegistry:{'GRANDMOTHER:g-1':true}
 }
 const passport=createMaterialPlantPassportFromState(state,{unitId:'life-1'})
 assert.equal(passport.object.createdAt,CREATED)
 assert.equal(passport.object.updatedAt,LOT_UPDATED)
 assert.equal(passport.generatedAt,LOT_UPDATED)
})

test('AUD-F019: fechas inválidas no desplazan evidencia temporal válida',()=>{
 const lot={id:'g-1',lotCode:'LAB-1',quantity:1,createdAt:CREATED,updatedAt:'fecha-invalida'}
 const units=[{id:'life-1',lotId:'g-1',plantType:MATERIAL_PLANT_TYPES.GRANDMOTHER,unitIndex:0,createdAt:CREATED,updatedAt:UNIT_UPDATED}]
 const [unit]=projectLotPlantUnits(lot,{plantType:MATERIAL_PLANT_TYPES.GRANDMOTHER,units})
 assert.equal(unit.createdAt,CREATED)
 assert.equal(unit.updatedAt,UNIT_UPDATED)
})
