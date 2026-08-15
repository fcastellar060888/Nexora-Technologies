import test from'node:test'
import assert from'node:assert/strict'
import{PROPAGATION_PURPOSES,createPurposeAwareBatch,isProductiveBatch,isRenewalBatch,propagationDestination,propagationSourceEligibility,propagationSourceUnits,validatePropagationIntent}from'../src/domain/propagationPurpose.js'
import{MATERIAL_PLANT_TYPES}from'../src/domain/materialPlantIdentity.js'

const state={
 grandmotherPlants:[{id:'g-lot',lotCode:'G-01',quantity:1,siteId:'s1',geneticId:'gen',status:'Activa'}],
 motherPlants:[{id:'m-lot',lotCode:'M-01',quantity:2,siteId:'s1',geneticId:'gen',status:'Activa',grandmotherPlantId:'g-lot'}],
 materialPlantUnits:[]
}

test('expone abuelas y madres individuales aptas como fuentes de esquejes',()=>{
 const units=propagationSourceUnits(state,{siteId:'s1'})
 assert.equal(units.length,3)
 assert.deepEqual(new Set(units.map(unit=>unit.plantType)),new Set([MATERIAL_PLANT_TYPES.GRANDMOTHER,MATERIAL_PLANT_TYPES.MOTHER]))
})

test('excluye plantas sin disponibilidad operativa o no aptas',()=>{
 const guarded={...state,materialPlantUnits:[
  {id:'g-lot:GRANDMOTHER:1',lotId:'g-lot',plantType:'GRANDMOTHER',unitIndex:0,operationalAvailability:'En cuarentena'},
  {id:'m-lot:MOTHER:1',lotId:'m-lot',plantType:'MOTHER',unitIndex:0,operationalAvailability:'Bloqueada por MIPE'},
  {id:'m-lot:MOTHER:2',lotId:'m-lot',plantType:'MOTHER',unitIndex:1,healthStatus:'No apta'}
 ]}
 assert.equal(propagationSourceUnits(guarded,{siteId:'s1'}).length,0)
 assert.equal(propagationSourceUnits(guarded,{siteId:'s1',eligibleOnly:false}).length,3)
})

test('el guard explica por qué una planta no puede originar esquejes',()=>{
 const source={id:'m1',plantType:MATERIAL_PLANT_TYPES.MOTHER,status:'Activa',healthStatus:'Sana',operationalAvailability:'En recuperación'}
 const eligibility=propagationSourceEligibility(source)
 assert.equal(eligibility.eligible,false)
 assert.match(eligibility.reason,/En recuperación/)
 assert.throws(()=>validatePropagationIntent({sourcePlantId:source.id,sourcePlantType:source.plantType,purpose:PROPAGATION_PURPOSES.PRODUCTION,sourceUnit:source}),/no puede originar esquejes/)
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
