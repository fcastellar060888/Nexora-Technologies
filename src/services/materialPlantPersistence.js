import{MATERIAL_PLANT_TYPES,legacyMaterialPlantId,materializeLotPlantUnits,materialPlantRegistryKey,scopedMaterialPlantRegistryKey}from'../domain/materialPlantIdentity.js'
import{resolveOrganizationId}from'../domain/organizationOwnership.js'

const list=value=>Array.isArray(value)?value:[]

export function ensureMaterialPlantUnits(state={}){
 let materialPlantUnits=list(state.materialPlantUnits)
 let registry={...(state.materialPlantIdentityRegistry||{})}
 let changed=materialPlantUnits!==state.materialPlantUnits
 const legacySafe=list(state.companies).length<=1
 const materialize=(sourceLot,plantType)=>{
  const organizationId=resolveOrganizationId(state,{record:sourceLot,siteId:sourceLot?.siteId,label:`el lote ${sourceLot?.id||''}`})
  const lot={...sourceLot,organizationId}
  const legacyKey=materialPlantRegistryKey(lot.id,plantType),scopedKey=scopedMaterialPlantRegistryKey(organizationId,lot.id,plantType)
  if(registry[scopedKey]||(legacySafe&&registry[legacyKey]))return
  const before=materialPlantUnits
  materialPlantUnits=materializeLotPlantUnits(lot,{plantType,existingUnits:materialPlantUnits,idFactory:legacyMaterialPlantId,completeMissing:true})
  const evidence={organizationId,lotId:lot.id,plantType,initialQuantity:Math.max(1,Math.trunc(Number(lot.quantity)||1)),materializedAt:lot.createdAt||lot.cycleStartedAt||new Date().toISOString()}
  registry={...registry,[scopedKey]:evidence,...(legacySafe?{[legacyKey]:evidence}:{})}
  changed=changed||materialPlantUnits!==before
 }
 for(const lot of list(state.grandmotherPlants))materialize(lot,MATERIAL_PLANT_TYPES.GRANDMOTHER)
 for(const lot of list(state.motherPlants))materialize(lot,MATERIAL_PLANT_TYPES.MOTHER)
 return changed||registry!==state.materialPlantIdentityRegistry?{...state,materialPlantUnits,materialPlantIdentityRegistry:registry}:state
}

export function migrateMaterialPlantIdentity(state={}){return ensureMaterialPlantUnits({...state,materialPlantUnits:list(state.materialPlantUnits)})}
