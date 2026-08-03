import{MATERIAL_PLANT_TYPES,materializeLotPlantUnits}from'../domain/materialPlantIdentity.js'

const list=value=>Array.isArray(value)?value:[]
const legacyId=({lot,plantType,unitIndex})=>`material-plant:${plantType}:${lot.id}:${unitIndex+1}`

export function ensureMaterialPlantUnits(state={}){
 let materialPlantUnits=list(state.materialPlantUnits)
 for(const lot of list(state.grandmotherPlants)){
  materialPlantUnits=materializeLotPlantUnits(lot,{plantType:MATERIAL_PLANT_TYPES.GRANDMOTHER,existingUnits:materialPlantUnits,idFactory:legacyId})
 }
 for(const lot of list(state.motherPlants)){
  materialPlantUnits=materializeLotPlantUnits(lot,{plantType:MATERIAL_PLANT_TYPES.MOTHER,existingUnits:materialPlantUnits,idFactory:legacyId})
 }
 return materialPlantUnits===state.materialPlantUnits?state:{...state,materialPlantUnits}
}

export function migrateMaterialPlantIdentity(state={}){
 return ensureMaterialPlantUnits({...state,materialPlantUnits:list(state.materialPlantUnits)})
}
