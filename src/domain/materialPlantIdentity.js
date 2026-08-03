const list=value=>Array.isArray(value)?value:[]
const positiveInteger=value=>Math.max(0,Math.trunc(Number(value)||0))
const text=value=>String(value??'').trim()

export const MATERIAL_PLANT_TYPES=Object.freeze({
 GRANDMOTHER:'GRANDMOTHER',
 MOTHER:'MOTHER'
})

export const MATERIAL_PLANT_AVAILABILITY=Object.freeze({
 AVAILABLE:'Disponible para corte',
 RECOVERING:'En recuperación',
 QUARANTINE:'En cuarentena',
 MIPE_BLOCKED:'Bloqueada por MIPE',
 RENEWAL_SCHEDULED:'Programada para renovación',
 UNAVAILABLE:'No disponible'
})

function unitCode(lot,type,index){
 const prefix=type===MATERIAL_PLANT_TYPES.GRANDMOTHER?'A':'M'
 return `${text(lot.lotCode)||text(lot.code)||text(lot.id)}-${prefix}${String(index+1).padStart(3,'0')}`
}

export const legacyMaterialPlantId=({lot,plantType,unitIndex})=>`material-plant:${plantType}:${lot.id}:${unitIndex+1}`

function defaultId(){
 if(globalThis.crypto?.randomUUID)return globalThis.crypto.randomUUID()
 throw new Error('No existe un generador seguro de identidad para materializar plantas.')
}

function normalizeUnit(unit,lot){
 const unitIndex=positiveInteger(unit.unitIndex)
 return Object.freeze({
  ...unit,
  id:text(unit.id),
  code:text(unit.code)||unitCode(lot||{id:unit.lotId},unit.plantType,unitIndex),
  plantType:unit.plantType,
  unitIndex,
  lotId:unit.lotId,
  siteId:unit.siteId||lot?.siteId||null,
  geneticId:unit.geneticId||lot?.geneticId||null,
  parentPlantId:unit.parentPlantId||null,
  status:unit.status||lot?.status||'Activa',
  healthStatus:unit.healthStatus||lot?.healthStatus||'Sana',
  operationalAvailability:unit.operationalAvailability||lot?.operationalAvailability||MATERIAL_PLANT_AVAILABILITY.AVAILABLE,
  location:unit.location||null,
  notes:unit.notes||'',
  createdAt:unit.createdAt||lot?.createdAt||lot?.cycleStartedAt||null,
  updatedAt:unit.updatedAt||unit.createdAt||lot?.updatedAt||lot?.createdAt||null,
  retiredAt:unit.retiredAt||null,
  sourceLot:lot||null
 })
}

export function materializeLotPlantUnits(lot,{plantType,existingUnits=[],idFactory=defaultId,createdAt}={}){
 if(!lot?.id)throw new Error('El lote necesita un identificador estable.')
 if(!Object.values(MATERIAL_PLANT_TYPES).includes(plantType))throw new Error('Tipo de planta de material vegetal inválido.')
 if(typeof idFactory!=='function')throw new TypeError('idFactory debe ser una función.')
 const current=list(existingUnits)
 const owned=current.filter(item=>item?.lotId===lot.id&&item?.plantType===plantType)
 if(owned.length)return current
 const quantity=Math.max(1,positiveInteger(lot.quantity||1))
 const timestamp=createdAt||lot.createdAt||lot.cycleStartedAt||new Date().toISOString()
 const created=Array.from({length:quantity},(_,unitIndex)=>({
  id:text(idFactory({lot,plantType,unitIndex})),
  code:unitCode(lot,plantType,unitIndex),
  plantType,
  unitIndex,
  lotId:lot.id,
  siteId:lot.siteId||null,
  geneticId:lot.geneticId||null,
  parentPlantId:lot.parentPlantId||null,
  status:lot.status||'Activa',
  healthStatus:lot.healthStatus||'Sana',
  operationalAvailability:lot.operationalAvailability||MATERIAL_PLANT_AVAILABILITY.AVAILABLE,
  location:null,
  notes:'',
  createdAt:timestamp,
  updatedAt:timestamp,
  retiredAt:null
 }))
 if(created.some(item=>!item.id))throw new Error('Cada planta materializada necesita una identidad estable.')
 if(new Set(created.map(item=>item.id)).size!==created.length)throw new Error('El generador produjo identidades duplicadas.')
 return[...current,...created]
}

export function projectLotPlantUnits(lot,{plantType,units=[],overrides=units}={}){
 if(!lot?.id)throw new Error('El lote necesita un identificador estable.')
 if(!Object.values(MATERIAL_PLANT_TYPES).includes(plantType))throw new Error('Tipo de planta de material vegetal inválido.')
 const materialized=materializeLotPlantUnits(lot,{plantType,existingUnits:overrides,idFactory:legacyMaterialPlantId})
 return Object.freeze(materialized
  .filter(item=>item?.lotId===lot.id&&item?.plantType===plantType)
  .sort((a,b)=>positiveInteger(a.unitIndex)-positiveInteger(b.unitIndex)||text(a.id).localeCompare(text(b.id)))
  .map(item=>normalizeUnit(item,lot)))
}

export function projectMaterialPlantUnits(state){
 let units=list(state?.materialPlantUnits)
 const lots=[]
 for(const lot of list(state?.grandmotherPlants)){
  lots.push([MATERIAL_PLANT_TYPES.GRANDMOTHER,lot])
  units=materializeLotPlantUnits(lot,{plantType:MATERIAL_PLANT_TYPES.GRANDMOTHER,existingUnits:units,idFactory:legacyMaterialPlantId})
 }
 for(const lot of list(state?.motherPlants)){
  lots.push([MATERIAL_PLANT_TYPES.MOTHER,lot])
  units=materializeLotPlantUnits(lot,{plantType:MATERIAL_PLANT_TYPES.MOTHER,existingUnits:units,idFactory:legacyMaterialPlantId})
 }
 const lotMap=new Map(lots.map(([type,lot])=>[`${type}:${lot.id}`,lot]))
 return Object.freeze(units.map(unit=>normalizeUnit(unit,lotMap.get(`${unit.plantType}:${unit.lotId}`))))
}

export function materialPlantUnitById(state,unitId){
 return projectMaterialPlantUnits(state).find(item=>item.id===unitId)||null
}

export function selectedMaterialPlantUnits(state,selectedIds=[]){
 const selected=new Set(list(selectedIds))
 return projectMaterialPlantUnits(state).filter(item=>selected.has(item.id))
}
