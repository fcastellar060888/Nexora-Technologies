const list=value=>Array.isArray(value)?value:[]
const text=value=>String(value??'').trim()

function cleanPatch(patch={}){
 const allowed=['status','healthStatus','siteId','location','notes','retiredAt']
 return Object.fromEntries(allowed.filter(key=>patch[key]!==undefined).map(key=>[key,patch[key]]))
}

export function upsertMaterialPlantUnit(units=[],plant,patch={}){
 if(!plant?.id||!plant?.lotId||!plant?.plantType)throw new Error('La planta individual no tiene identidad completa.')
 const now=new Date().toISOString()
 const next={
  id:plant.id,
  lotId:plant.lotId,
  plantType:plant.plantType,
  unitIndex:plant.unitIndex,
  code:plant.code,
  siteId:plant.siteId||null,
  geneticId:plant.geneticId||null,
  parentPlantId:plant.parentPlantId||null,
  createdAt:plant.createdAt||now,
  updatedAt:now,
  ...cleanPatch(patch)
 }
 const current=list(units)
 const index=current.findIndex(item=>item.id===plant.id||(item.lotId===plant.lotId&&item.plantType===plant.plantType&&Number(item.unitIndex)===Number(plant.unitIndex)))
 if(index<0)return[...current,next]
 return current.map((item,itemIndex)=>itemIndex===index?{...item,...next}:item)
}

export function applyMaterialPlantUnitPatch(state,plants,patch={}){
 const targets=list(plants)
 if(!targets.length)throw new Error('Selecciona al menos una planta.')
 let materialPlantUnits=list(state?.materialPlantUnits)
 for(const plant of targets)materialPlantUnits=upsertMaterialPlantUnit(materialPlantUnits,plant,patch)
 return{...state,materialPlantUnits}
}

export function appendMaterialPlantObservation(state,plants,{title,detail='',type='Observación',createdAt=new Date().toISOString()}={}){
 const targets=list(plants)
 const normalizedTitle=text(title)
 if(!targets.length)throw new Error('Selecciona al menos una planta.')
 if(!normalizedTitle)throw new Error('El título de la observación es obligatorio.')
 if(Number.isNaN(Date.parse(createdAt)))throw new Error('La fecha de la observación no es válida.')
 const plantEvents=[...list(state?.plantEvents)]
 for(const plant of targets){
  if(!plant?.id)throw new Error('La planta individual no tiene identidad completa.')
  plantEvents.push({
   id:crypto.randomUUID(),
   plantId:plant.id,
   entityId:plant.id,
   type:text(type)||'Observación',
   title:normalizedTitle,
   detail:text(detail),
   date:new Date(createdAt).toISOString(),
   createdAt:new Date(createdAt).toISOString(),
   source:'material-plant-bulk-action'
  })
 }
 return{...state,plantEvents}
}

export function materialPlantActionDetail(plants,patch={}){
 const targets=list(plants)
 const fields=[]
 if(patch.status!==undefined)fields.push(`estado: ${text(patch.status)}`)
 if(patch.healthStatus!==undefined)fields.push(`sanidad: ${text(patch.healthStatus)}`)
 if(patch.siteId!==undefined)fields.push('ubicación actualizada')
 if(patch.notes!==undefined)fields.push('observaciones actualizadas')
 return `${targets.length} planta${targets.length===1?'':'s'} · ${fields.join(' · ')||'actualización individual'}`
}
