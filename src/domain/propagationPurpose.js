import{MATERIAL_PLANT_TYPES,projectLotPlantUnits}from'./materialPlantIdentity.js'
import{MIPE_RESTRICTED_OPERATIONS,blockersForMipeOperation}from'./mipeOperationalRestrictions.js'
import{activeOrganizationId,assertActiveOrganization,explicitOrganizationId}from'./organizationOwnership.js'

export const PROPAGATION_PURPOSES=Object.freeze({
 PRODUCTION:'PRODUCTION',
 MOTHER_RENEWAL:'MOTHER_RENEWAL',
 GRANDMOTHER_RENEWAL:'GRANDMOTHER_RENEWAL',
 GENETIC_RESERVE:'GENETIC_RESERVE',
 EVALUATION:'EVALUATION'
})

export const PROPAGATION_PURPOSE_LABELS=Object.freeze({
 [PROPAGATION_PURPOSES.PRODUCTION]:'Lote productivo',
 [PROPAGATION_PURPOSES.MOTHER_RENEWAL]:'Renovación de madres',
 [PROPAGATION_PURPOSES.GRANDMOTHER_RENEWAL]:'Renovación de abuelas',
 [PROPAGATION_PURPOSES.GENETIC_RESERVE]:'Reserva genética',
 [PROPAGATION_PURPOSES.EVALUATION]:'Evaluación / cuarentena'
})

export const PROPAGATION_SOURCE_AVAILABILITY='Disponible para corte'

const allowedPurposes=new Set(Object.values(PROPAGATION_PURPOSES))
const allowedSourceTypes=new Set(Object.values(MATERIAL_PLANT_TYPES))
const retiredStatuses=new Set(['Retirada','Descartada','Fallecida'])
const legacyMipeBlockedAvailability='Bloqueada por MIPE'

export function propagationSourceEligibility(unit){
 if(!unit)return Object.freeze({eligible:false,reason:'No se encontró la planta de origen.'})
 if(retiredStatuses.has(unit.status))return Object.freeze({eligible:false,reason:`La planta está ${String(unit.status).toLowerCase()}.`})
 if(unit.healthStatus==='No apta')return Object.freeze({eligible:false,reason:'La planta está marcada como no apta sanitariamente.'})
 const availability=unit.operationalAvailability||PROPAGATION_SOURCE_AVAILABILITY
 if(availability!==PROPAGATION_SOURCE_AVAILABILITY)return Object.freeze({eligible:false,reason:`Disponibilidad operativa: ${availability}.`})
 return Object.freeze({eligible:true,reason:'Disponible para corte.'})
}

function sourceMipeEligibility(state,unit,organizationId,at){
 try{
  const result=blockersForMipeOperation(state,{operation:MIPE_RESTRICTED_OPERATIONS.PROPAGATION_CUT,targetType:'MATERIAL_PLANT',targetId:unit.id,organizationId,at})
  return{blocked:result.blockers.length>0,projection:result.projection}
 }catch(error){return{blocked:true,error}}
}

export function propagationSourceUnits(state,{organizationId=activeOrganizationId(state),siteId='',activeOnly=true,eligibleOnly=true,at=new Date().toISOString()}={}){
 assertActiveOrganization(state,organizationId,{label:'La organización de propagación'})
 const overrides=state.materialPlantUnits||[]
 const lots=[
  ...(state.grandmotherPlants||[]).flatMap(lot=>projectLotPlantUnits(lot,{plantType:MATERIAL_PLANT_TYPES.GRANDMOTHER,overrides})),
  ...(state.motherPlants||[]).flatMap(lot=>projectLotPlantUnits(lot,{plantType:MATERIAL_PLANT_TYPES.MOTHER,overrides}))
 ]
 return lots.filter(unit=>{
  if(explicitOrganizationId(unit)!==organizationId||Boolean(siteId&&unit.siteId!==siteId)||Boolean(activeOnly&&retiredStatuses.has(unit.status)))return false
  if(!eligibleOnly)return true
  const mipe=sourceMipeEligibility(state,unit,organizationId,at)
  if(mipe.blocked)return false
  const normalized=unit.operationalAvailability===legacyMipeBlockedAvailability?{...unit,operationalAvailability:PROPAGATION_SOURCE_AVAILABILITY}:unit
  return propagationSourceEligibility(normalized).eligible
 })
}

export function validatePropagationIntent({sourcePlantId,sourcePlantType,purpose,productionLotId='',sourceUnit=null,organizationId=''}){
 if(!sourcePlantId)throw new Error('Selecciona la planta individual de origen.')
 if(!allowedSourceTypes.has(sourcePlantType))throw new Error('El tipo de planta de origen no es válido.')
 if(!allowedPurposes.has(purpose))throw new Error('Selecciona el propósito de los esquejes.')
 if(sourceUnit){
  const owner=explicitOrganizationId(sourceUnit)
  if(organizationId&&owner!==organizationId)throw new Error('La planta de origen pertenece a otra organización.')
  const eligibility=propagationSourceEligibility(sourceUnit);if(!eligibility.eligible&&sourceUnit.operationalAvailability!==legacyMipeBlockedAvailability)throw new Error(`La planta no puede originar esquejes. ${eligibility.reason}`)
 }
 if(purpose===PROPAGATION_PURPOSES.PRODUCTION&&productionLotId===null)throw new Error('El destino productivo no es válido.')
 return true
}

export function propagationDestination(purpose){
 if(purpose===PROPAGATION_PURPOSES.PRODUCTION)return Object.freeze({entersProduction:true,targetLifecycleStage:'VEGETATIVE',batchClass:'PRODUCTIVE'})
 if(purpose===PROPAGATION_PURPOSES.MOTHER_RENEWAL)return Object.freeze({entersProduction:false,targetLifecycleStage:'MOTHER',batchClass:'RENEWAL'})
 if(purpose===PROPAGATION_PURPOSES.GRANDMOTHER_RENEWAL)return Object.freeze({entersProduction:false,targetLifecycleStage:'GRANDMOTHER',batchClass:'RENEWAL'})
 if(purpose===PROPAGATION_PURPOSES.GENETIC_RESERVE)return Object.freeze({entersProduction:false,targetLifecycleStage:'GENETIC_RESERVE',batchClass:'GENETIC'})
 return Object.freeze({entersProduction:false,targetLifecycleStage:'EVALUATION',batchClass:'EVALUATION'})
}

export function createPurposeAwareBatch(base,{sourceUnit,purpose,productionLotId='',organizationId=explicitOrganizationId(sourceUnit)}={}){
 validatePropagationIntent({sourcePlantId:sourceUnit?.id,sourcePlantType:sourceUnit?.plantType,purpose,productionLotId,sourceUnit,organizationId})
 const destination=propagationDestination(purpose)
 return{
  ...base,
  organizationId,
  sourcePlantId:sourceUnit.id,
  sourcePlantType:sourceUnit.plantType,
  sourceLotId:sourceUnit.lotId,
  purpose,
  purposeLabel:PROPAGATION_PURPOSE_LABELS[purpose],
  targetLifecycleStage:destination.targetLifecycleStage,
  batchClass:destination.batchClass,
  entersProduction:destination.entersProduction,
  productionLotId:destination.entersProduction?(productionLotId||base.id):'',
  directParentPlantId:sourceUnit.id,
  grandmotherPlantId:sourceUnit.plantType===MATERIAL_PLANT_TYPES.GRANDMOTHER?sourceUnit.lotId:sourceUnit.sourceLot?.grandmotherPlantId||base.grandmotherPlantId||''
 }
}

export function isRenewalBatch(batch){return batch?.batchClass==='RENEWAL'||[PROPAGATION_PURPOSES.MOTHER_RENEWAL,PROPAGATION_PURPOSES.GRANDMOTHER_RENEWAL].includes(batch?.purpose)}
export function isProductiveBatch(batch){return batch?.entersProduction===true||batch?.purpose===PROPAGATION_PURPOSES.PRODUCTION||(!batch?.purpose&&Boolean(batch?.motherPlantId))}
