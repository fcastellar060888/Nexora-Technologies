import{MATERIAL_PLANT_TYPES,legacyMaterialPlantId,materializeLotPlantUnits,materialPlantRegistryKey}from'../domain/materialPlantIdentity.js'

const list=value=>Array.isArray(value)?value:[]

export function ensureMaterialPlantUnits(state={}){
 let materialPlantUnits=list(state.materialPlantUnits)
 let registry={...(state.materialPlantIdentityRegistry||{})}
 let changed=materialPlantUnits!==state.materialPlantUnits
 const materialize=(lot,plantType)=>{
  const key=materialPlantRegistryKey(lot.id,plantType)
  if(registry[key])return
  const before=materialPlantUnits
  materialPlantUnits=materializeLotPlantUnits(lot,{plantType,existingUnits:materialPlantUnits,idFactory:legacyMaterialPlantId,completeMissing:true})
  registry={...registry,[key]:{lotId:lot.id,plantType,initialQuantity:Math.max(1,Math.trunc(Number(lot.quantity)||1)),materializedAt:lot.createdAt||lot.cycleStartedAt||new Date().toISOString()}}
  changed=changed||materialPlantUnits!==before
 }
 for(const lot of list(state.grandmotherPlants))materialize(lot,MATERIAL_PLANT_TYPES.GRANDMOTHER)
 for(const lot of list(state.motherPlants))materialize(lot,MATERIAL_PLANT_TYPES.MOTHER)
 return changed||registry!==state.materialPlantIdentityRegistry?{...state,materialPlantUnits,materialPlantIdentityRegistry:registry}:state
}

export function migrateMaterialPlantIdentity(state={}){
 return ensureMaterialPlantUnits({...state,materialPlantUnits:list(state.materialPlantUnits)})
}
