const list=value=>Array.isArray(value)?value:[]
const positiveInteger=value=>Math.max(0,Math.trunc(Number(value)||0))
const text=value=>String(value??'').trim()
const explicitOrganizationOf=value=>text(value?.organizationId||value?.companyId||value?._organizationId)
const organizationOf=lot=>explicitOrganizationOf(lot)||'local-installation'

export const MATERIAL_PLANT_TYPES=Object.freeze({GRANDMOTHER:'GRANDMOTHER',MOTHER:'MOTHER'})
export const MATERIAL_PLANT_AVAILABILITY=Object.freeze({AVAILABLE:'Disponible para corte',RECOVERING:'En recuperación',QUARANTINE:'En cuarentena',MIPE_BLOCKED:'Bloqueada por MIPE',RENEWAL_SCHEDULED:'Programada para renovación',UNAVAILABLE:'No disponible'})

function unitCode(lot,type,index){const prefix=type===MATERIAL_PLANT_TYPES.GRANDMOTHER?'A':'M';return`${text(lot.lotCode)||text(lot.code)||text(lot.id)}-${prefix}${String(index+1).padStart(3,'0')}`}
export const legacyMaterialPlantId=({lot,plantType,unitIndex})=>`material-plant:${plantType}:${lot.id}:${unitIndex+1}`
export const materialPlantRegistryKey=(lotId,plantType)=>`${plantType}:${lotId}`
function defaultId(){if(globalThis.crypto?.randomUUID)return globalThis.crypto.randomUUID();throw new Error('No existe un generador seguro de identidad para materializar plantas.')}
function normalizedTimestamp(value){if(value===null||value===undefined||value==='')return null;const time=Date.parse(value);return Number.isNaN(time)?null:new Date(time).toISOString()}
function firstTimestamp(...values){for(const value of values){const normalized=normalizedTimestamp(value);if(normalized)return normalized}return null}
function latestTimestamp(...values){let latest=null;for(const value of values){const normalized=normalizedTimestamp(value);if(!normalized)continue;const time=Date.parse(normalized);if(latest===null||time>latest)latest=time}return latest===null?null:new Date(latest).toISOString()}

function canonicalLotForState(state,lot){
 const explicit=explicitOrganizationOf(lot)
 if(explicit)return{...lot,organizationId:explicit}
 const site=list(state?.sites).find(item=>item?.id===lot?.siteId)
 const siteOwner=explicitOrganizationOf(site)
 if(siteOwner)return{...lot,organizationId:siteOwner}
 const companies=list(state?.companies)
 const active=text(state?.currentContext?.companyId)
 if(active&&companies.some(item=>item?.id===active))return{...lot,organizationId:active}
 if(companies.length===1)return{...lot,organizationId:text(companies[0]?.id)}
 if(companies.length>1)throw new Error('No se puede determinar organizationId del lote en un estado multiempresa.')
 return{...lot,organizationId:'local-installation'}
}

function normalizeUnit(unit,lot){
 const unitIndex=positiveInteger(unit.unitIndex),organizationId=text(unit.organizationId||unit.companyId||unit._organizationId||organizationOf(lot))
 if(!organizationId)throw new Error('La identidad vegetal requiere organizationId.')
 const createdAt=firstTimestamp(unit.createdAt,lot?.createdAt,lot?.cycleStartedAt),updatedAt=latestTimestamp(unit.updatedAt,unit.createdAt,lot?.updatedAt,lot?.createdAt,lot?.cycleStartedAt)||createdAt
 return Object.freeze({...unit,id:text(unit.id),organizationId,code:text(unit.code)||unitCode(lot||{id:unit.lotId},unit.plantType,unitIndex),plantType:unit.plantType,unitIndex,lotId:unit.lotId,siteId:unit.siteId||lot?.siteId||null,geneticId:unit.geneticId||lot?.geneticId||null,parentPlantId:unit.parentPlantId||null,status:unit.status||lot?.status||'Activa',healthStatus:unit.healthStatus||lot?.healthStatus||'Sana',operationalAvailability:unit.operationalAvailability||lot?.operationalAvailability||MATERIAL_PLANT_AVAILABILITY.AVAILABLE,location:unit.location||null,notes:unit.notes||'',createdAt,updatedAt,retiredAt:unit.retiredAt||null,sourceLot:lot||null})
}

export function materializeLotPlantUnits(lot,{plantType,existingUnits=[],idFactory=defaultId,createdAt,completeMissing=false}={}){
 if(!lot?.id)throw new Error('El lote necesita un identificador estable.')
 const organizationId=organizationOf(lot)
 if(!Object.values(MATERIAL_PLANT_TYPES).includes(plantType))throw new Error('Tipo de planta de material vegetal inválido.')
 if(typeof idFactory!=='function')throw new TypeError('idFactory debe ser una función.')
 const current=list(existingUnits),owned=current.filter(item=>item?.lotId===lot.id&&item?.plantType===plantType&&text(item.organizationId||item.companyId||item._organizationId||organizationId)===organizationId)
 if(owned.length&&!completeMissing)return current
 const quantity=Math.max(1,positiveInteger(lot.quantity||1)),timestamp=createdAt||lot.createdAt||lot.cycleStartedAt||new Date().toISOString(),occupiedIndexes=new Set(owned.map(item=>positiveInteger(item.unitIndex)))
 const created=Array.from({length:quantity},(_,unitIndex)=>unitIndex).filter(unitIndex=>!occupiedIndexes.has(unitIndex)).map(unitIndex=>({id:text(idFactory({lot,plantType,unitIndex})),organizationId,code:unitCode(lot,plantType,unitIndex),plantType,unitIndex,lotId:lot.id,siteId:lot.siteId||null,geneticId:lot.geneticId||null,parentPlantId:lot.parentPlantId||null,status:lot.status||'Activa',healthStatus:lot.healthStatus||'Sana',operationalAvailability:lot.operationalAvailability||MATERIAL_PLANT_AVAILABILITY.AVAILABLE,location:null,notes:'',createdAt:timestamp,updatedAt:timestamp,retiredAt:null}))
 if(created.some(item=>!item.id))throw new Error('Cada planta materializada necesita una identidad estable.')
 const allIds=[...current.map(item=>item?.id).filter(Boolean),...created.map(item=>item.id)];if(new Set(allIds).size!==allIds.length)throw new Error('El generador produjo identidades duplicadas.')
 return created.length?[...current,...created]:current
}

export function projectLotPlantUnits(lot,{plantType,units=[],overrides=units,completeMissing=false}={}){if(!lot?.id)throw new Error('El lote necesita un identificador estable.');if(!Object.values(MATERIAL_PLANT_TYPES).includes(plantType))throw new Error('Tipo de planta de material vegetal inválido.');const organizationId=organizationOf(lot),materialized=materializeLotPlantUnits(lot,{plantType,existingUnits:overrides,idFactory:legacyMaterialPlantId,completeMissing});return Object.freeze(materialized.filter(item=>item?.lotId===lot.id&&item?.plantType===plantType&&text(item.organizationId||item.companyId||item._organizationId||organizationId)===organizationId).sort((a,b)=>positiveInteger(a.unitIndex)-positiveInteger(b.unitIndex)||text(a.id).localeCompare(text(b.id))).map(item=>normalizeUnit(item,lot)))}
export function projectMaterialPlantUnits(state){let units=list(state?.materialPlantUnits);const registry=state?.materialPlantIdentityRegistry||{},lots=[];for(const source of list(state?.grandmotherPlants)){const lot=canonicalLotForState(state,source);lots.push([MATERIAL_PLANT_TYPES.GRANDMOTHER,lot]);units=materializeLotPlantUnits(lot,{plantType:MATERIAL_PLANT_TYPES.GRANDMOTHER,existingUnits:units,idFactory:legacyMaterialPlantId,completeMissing:!registry[materialPlantRegistryKey(lot.id,MATERIAL_PLANT_TYPES.GRANDMOTHER)]})}for(const source of list(state?.motherPlants)){const lot=canonicalLotForState(state,source);lots.push([MATERIAL_PLANT_TYPES.MOTHER,lot]);units=materializeLotPlantUnits(lot,{plantType:MATERIAL_PLANT_TYPES.MOTHER,existingUnits:units,idFactory:legacyMaterialPlantId,completeMissing:!registry[materialPlantRegistryKey(lot.id,MATERIAL_PLANT_TYPES.MOTHER)]})}const lotMap=new Map(lots.map(([type,lot])=>[`${organizationOf(lot)}:${type}:${lot.id}`,lot])),legacyLotMap=new Map(lots.map(([type,lot])=>[`${type}:${lot.id}`,lot]));return Object.freeze(units.map(unit=>{const owner=explicitOrganizationOf(unit),lot=owner?lotMap.get(`${owner}:${unit.plantType}:${unit.lotId}`):legacyLotMap.get(`${unit.plantType}:${unit.lotId}`);return normalizeUnit(unit,lot)}))}
export function materialPlantUnitById(state,unitId){return projectMaterialPlantUnits(state).find(item=>item.id===unitId)||null}
export function selectedMaterialPlantUnits(state,selectedIds=[]){const selected=new Set(list(selectedIds));return projectMaterialPlantUnits(state).filter(item=>selected.has(item.id))}
