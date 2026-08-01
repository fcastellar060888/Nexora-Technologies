import test from'node:test'
import assert from'node:assert/strict'
import{PROPAGATION_PURPOSES,createPurposeAwareBatch,isProductiveBatch,isRenewalBatch,propagationDestination,propagationSourceUnits,validatePropagationIntent}from'../src/domain/propagationPurpose.js'
import{MATERIAL_PLANT_TYPES}from'../src/domain/materialPlantIdentity.js'

const state={
 grandmotherPlants:[{id:'g-lot',lotCode:'G-01',quantity:1,siteId:'s1',geneticId:'gen',status:'Activa'}],
 motherPlants:[{id:'m-lot',lotCode:'M-01',quantity:2,siteId:'s1',geneticId:'gen',status:'Activa',grandmotherPlantId:'g-lot'}],
 materialPlantUnits:[]
}

test('expone abuelas y madres individuales como fuentes de esquejes',()=>{
 const units=propagationSourceUnits(state,{siteId:'s1'})
 assert.equal(units.length,3)
 assert.deepEqual(new Set(units.map(unit=>unit.plantType)),new Set([MATERIAL_PLANT_TYPES.GRANDMOTHER,MATERIAL_PLANT_TYPES.MOTHER]))
})

test('separa estrictamente renovación y producción',()=>{
 assert.equal(propagationDestination(PROPAGATION_PURPOSES.PRODUCTION).entersProduction,true)
 assert.equal(propagationDestination(PROPAGATION_PURPOSES.MOTHER_RENEWAL).entersProduction,false)
 assert.equal(propagationDestination(PROPAGATION_PURPOSES.GRANDMOTHER_RENEWAL).entersProduction,false)
})

test('una madre puede generar renovación de madres conservando genealogía',()=>{
 const source=propagationSourceUnits(state).find(unit=>unit.plantType===MATERIAL_PLANT_TYPES.MOTHER)
 const batch=createPurposeAwareBatch({id:'batch-1',motherPlantId:'m-lot',grandmotherPlantId:'g-lot'},{sourceUnit:source,purpose:PROPAGATION_PURPOSES.MOTHER_RENEWAL})
 assert.equal(batch.directParentPlantId,source.id)
 assert.equal(batch.grandmotherPlantId,'g-lot')
 assert.equal(batch.targetLifecycleStage,'MOTHER')
 assert.equal(isRenewalBatch(batch),true)
 assert.equal(isProductiveBatch(batch),false)
})

test('una abuela puede originar producción con autorización trazable',()=>{
 const source=propagationSourceUnits(state).find(unit=>unit.plantType===MATERIAL_PLANT_TYPES.GRANDMOTHER)
 const batch=createPurposeAwareBatch({id:'batch-2'},{sourceUnit:source,purpose:PROPAGATION_PURPOSES.PRODUCTION})
 assert.equal(batch.sourcePlantType,MATERIAL_PLANT_TYPES.GRANDMOTHER)
 assert.equal(batch.entersProduction,true)
 assert.equal(batch.productionLotId,'batch-2')
 assert.equal(isProductiveBatch(batch),true)
})

test('el propósito y la planta de origen son obligatorios',()=>{
 assert.throws(()=>validatePropagationIntent({sourcePlantId:'',sourcePlantType:MATERIAL_PLANT_TYPES.MOTHER,purpose:PROPAGATION_PURPOSES.PRODUCTION}),/planta individual/)
 assert.throws(()=>validatePropagationIntent({sourcePlantId:'m',sourcePlantType:MATERIAL_PLANT_TYPES.MOTHER,purpose:''}),/propósito/)
})
