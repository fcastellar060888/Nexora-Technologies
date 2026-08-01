const list=value=>Array.isArray(value)?value:[]
const positiveInteger=value=>Math.max(0,Math.trunc(Number(value)||0))
const text=value=>String(value??'').trim()

export const MATERIAL_PLANT_TYPES=Object.freeze({
 GRANDMOTHER:'GRANDMOTHER',
 MOTHER:'MOTHER'
})

function unitCode(lot,type,index){
 const prefix=type===MATERIAL_PLANT_TYPES.GRANDMOTHER?'A':'M'
 return `${text(lot.lotCode)||text(lot.code)||text(lot.id)}-${prefix}${String(index+1).padStart(3,'0')}`
}

function overridesByIndex(overrides,lotId,type){
 return new Map(list(overrides)
  .filter(item=>item.lotId===lotId&&item.plantType===type)
  .map(item=>[positiveInteger(item.unitIndex),item]))
}

export function projectLotPlantUnits(lot,{plantType,overrides=[]}={}){
 if(!lot?.id)throw new Error('El lote necesita un identificador estable.')
 if(!Object.values(MATERIAL_PLANT_TYPES).includes(plantType))throw new Error('Tipo de planta de material vegetal inválido.')
 const quantity=positiveInteger(lot.quantity||1)
 const indexedOverrides=overridesByIndex(overrides,lot.id,plantType)
 return Array.from({length:quantity},(_,unitIndex)=>{
  const override=indexedOverrides.get(unitIndex)||{}
  const id=text(override.id)||`${lot.id}:${plantType}:${unitIndex+1}`
  return Object.freeze({
   id,
   code:text(override.code)||unitCode(lot,plantType,unitIndex),
   plantType,
   unitIndex,
   lotId:lot.id,
   siteId:override.siteId||lot.siteId||null,
   geneticId:override.geneticId||lot.geneticId||null,
   parentPlantId:override.parentPlantId||null,
   status:override.status||lot.status||'Activa',
   healthStatus:override.healthStatus||lot.healthStatus||'Sana',
   location:override.location||null,
   notes:override.notes||'',
   createdAt:override.createdAt||lot.createdAt||lot.cycleStartedAt||null,
   retiredAt:override.retiredAt||null,
   sourceLot:lot
  })
 })
}

export function projectMaterialPlantUnits(state){
 const overrides=list(state?.materialPlantUnits)
 const grandmothers=list(state?.grandmotherPlants).flatMap(lot=>projectLotPlantUnits(lot,{plantType:MATERIAL_PLANT_TYPES.GRANDMOTHER,overrides}))
 const mothers=list(state?.motherPlants).flatMap(lot=>projectLotPlantUnits(lot,{plantType:MATERIAL_PLANT_TYPES.MOTHER,overrides}))
 return Object.freeze([...grandmothers,...mothers])
}

export function materialPlantUnitById(state,unitId){
 return projectMaterialPlantUnits(state).find(item=>item.id===unitId)||null
}

export function selectedMaterialPlantUnits(state,selectedIds=[]){
 const selected=new Set(list(selectedIds))
 return projectMaterialPlantUnits(state).filter(item=>selected.has(item.id))
}
