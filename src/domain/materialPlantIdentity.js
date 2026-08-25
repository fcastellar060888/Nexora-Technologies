import{explicitOrganizationId,organizationForCandidates,resolveOrganizationId}from'./organizationOwnership.js'

const list=value=>Array.isArray(value)?value:[]
const positiveInteger=value=>Math.max(0,Math.trunc(Number(value)||0))
const text=value=>String(value??'').trim()
const organizationOf=lot=>explicitOrganizationId(lot)||'local-installation'

export const MATERIAL_PLANT_TYPES=Object.freeze({GRANDMOTHER:'GRANDMOTHER',MOTHER:'MOTHER'})
export const MATERIAL_PLANT_AVAILABILITY=Object.freeze({AVAILABLE:'Disponible para corte',RECOVERING:'En recuperación',QUARANTINE:'En cuarentena',MIPE_BLOCKED:'Bloqueada por MIPE',RENEWAL_SCHEDULED:'Programada para renovación',UNAVAILABLE:'No disponible'})

function unitCode(lot,type,index){const prefix=type===MATERIAL_PLANT_TYPES.GRANDMOTHER?'A':'M';return`${text(lot.lotCode)||text(lot.code)||text(lot.id)}-${prefix}${String(index+1).padStart(3,'0')}`}
export const legacyMaterialPlantId=({lot,plantType,unitIndex})=>`material-plant:${plantType}:${lot.id}:${unitIndex+1}`
export const materialPlantRegistryKey=(lotId,plantType)=>`${plantType}:${lotId}`
export const scopedMaterialPlantRegistryKey=(organizationId,lotId,plantType)=>`${text(organizationId)}:${materialPlantRegistryKey(lotId,plantType)}`
function defaultId(){if(globalThis.crypto?.randomUUID)return globalThis.crypto.randomUUID();throw new Error('No existe un generador seguro de identidad para materializar plantas.')}
function normalizedTimestamp(value){if(value===null||value===undefined||value==='')return null;const time=Date.parse(value);return Number.isNaN(time)?null:new Date(time).toISOString()}
function firstTimestamp(...values){for(const value of values){const normalized=normalizedTimestamp(value);if(normalized)return normalized}return null}
function latestTimestamp(...values){let latest=null;for(const value of values){const normalized=normalizedTimestamp(value);if(!normalized)continue;const time=Date.parse(normalized);if(latest===null||time>latest)latest=time}return latest===null?null:new Date(latest).toISOString()}

function canonicalLotForState(state,lot){return{...lot,organizationId:resolveOrganizationId(state,{record:lot,siteId:lot?.siteId,label:`el lote ${lot?.id||''}`})}}
function registrySealed(state,registry,lot,plantType){const scoped=scopedMaterialPlantRegistryKey(organizationOf(lot),lot.id,plantType);if(registry[scoped])return true;return list(state?.companies).length<=1&&Boolean(registry[materialPlantRegistryKey(lot.id,plantType)])}

function normalizeUnit(unit,lot){
 if(!lot?.id)throw new Error('La identidad vegetal no resuelve un lote canónico.')
 const unitLotId=text(unit?.lotId),lotId=text(lot.id)
 if(!unitLotId||unitLotId!==lotId)throw new Error('La identidad vegetal contradice su lote canónico.')
 const lotOwner=text(organizationOf(lot)),explicitOwner=text(explicitOrganizationId(unit))
 if(explicitOwner&&explicitOwner!==lotOwner)throw new Error('La identidad vegetal pertenece a otra empresa que su lote canónico.')
 const declaredSite=text(unit?.siteId),lotSite=text(lot?.siteId)
 if(declaredSite&&lotSite&&declaredSite!==lotSite)throw new Error('La identidad vegetal contradice la sede canónica de su lote.')
 const unitIndex=positiveInteger(unit.unitIndex),organizationId=explicitOwner||lotOwner
 if(!organizationId)throw new Error('La identidad vegetal requiere organizationId.')
 const createdAt=firstTimestamp(unit.createdAt,lot?.createdAt,lot?.cycleStartedAt),updatedAt=latestTimestamp(unit.updatedAt,unit.createdAt,lot?.updatedAt,lot?.createdAt,lot?.cycleStartedAt)||createdAt
 return Object.freeze({...unit,id:text(unit.id),organizationId,code:text(unit.code)||unitCode(lot,unit.plantType,unitIndex),plantType:unit.plantType,unitIndex,lotId,siteId:lotSite||declaredSite||null,geneticId:unit.geneticId||lot?.geneticId||null,parentPlantId:unit.parentPlantId||null,status:unit.status||lot?.status||'Activa',healthStatus:unit.healthStatus||lot?.healthStatus||'Sana',operationalAvailability:unit.operationalAvailability||lot?.operationalAvailability||MATERIAL_PLANT_AVAILABILITY.AVAILABLE,location:unit.location||null,notes:unit.notes||'',createdAt,updatedAt,retiredAt:unit.retiredAt||null,sourceLot:lot})
}

export function materializeLotPlantUnits(lot,{plantType,existingUnits=[],idFactory=defaultId,createdAt,completeMissing=false}={}){
 if(!lot?.id)throw new Error('El lote necesita un identificador estable.')
 const organizationId=organizationOf(lot)
 if(!Object.values(MATERIAL_PLANT_TYPES).includes(plantType))throw new Error('Tipo de planta de material vegetal inválido.')
 if(typeof idFactory!=='function')throw new TypeError('idFactory debe ser una función.')
 const current=list(existingUnits),owned=current.filter(item=>item?.lotId===lot.id&&item?.plantType===plantType&&text(explicitOrganizationId(item)||organizationId)===organizationId)
 if(owned.length&&!completeMissing)return current
 const quantity=Math.max(1,positiveInteger(lot.quantity||1)),timestamp=createdAt||lot.createdAt||lot.cycleStartedAt||new Date().toISOString(),occupiedIndexes=new Set(owned.map(item=>positiveInteger(item.unitIndex)))
 const created=Array.from({length:quantity},(_,unitIndex)=>unitIndex).filter(unitIndex=>!occupiedIndexes.has(unitIndex)).map(unitIndex=>({id:text(idFactory({lot,plantType,unitIndex})),organizationId,code:unitCode(lot,plantType,unitIndex),plantType,unitIndex,lotId:lot.id,siteId:lot.siteId||null,geneticId:lot.geneticId||null,parentPlantId:lot.parentPlantId||null,status:lot.status||'Activa',healthStatus:lot.healthStatus||'Sana',operationalAvailability:lot.operationalAvailability||MATERIAL_PLANT_AVAILABILITY.AVAILABLE,location:null,notes:'',createdAt:timestamp,updatedAt:timestamp,retiredAt:null}))
 if(created.some(item=>!item.id))throw new Error('Cada planta materializada necesita una identidad estable.')
 const scopedIdentities=[...current,...created].map(item=>`${text(explicitOrganizationId(item)||organizationId)}|${text(item?.id)}`).filter(key=>!key.endsWith('|'))
 if(new Set(scopedIdentities).size!==scopedIdentities.length)throw new Error('El generador produjo identidades duplicadas dentro de una organización.')
 return created.length?[...current,...created]:current
}

export function projectLotPlantUnits(lot,{plantType,units=[],overrides=units,completeMissing=false}={}){if(!lot?.id)throw new Error('El lote necesita un identificador estable.');if(!Object.values(MATERIAL_PLANT_TYPES).includes(plantType))throw new Error('Tipo de planta de material vegetal inválido.');const organizationId=organizationOf(lot),materialized=materializeLotPlantUnits(lot,{plantType,existingUnits:overrides,idFactory:legacyMaterialPlantId,completeMissing});return Object.freeze(materialized.filter(item=>item?.lotId===lot.id&&item?.plantType===plantType&&text(explicitOrganizationId(item)||organizationId)===organizationId).sort((a,b)=>positiveInteger(a.unitIndex)-positiveInteger(b.unitIndex)||text(a.id).localeCompare(text(b.id))).map(item=>normalizeUnit(item,lot)))}
export function projectMaterialPlantUnits(state){let units=list(state?.materialPlantUnits);const registry=state?.materialPlantIdentityRegistry||{},lots=[];for(const source of list(state?.grandmotherPlants)){const lot=canonicalLotForState(state,source);lots.push([MATERIAL_PLANT_TYPES.GRANDMOTHER,lot]);units=materializeLotPlantUnits(lot,{plantType:MATERIAL_PLANT_TYPES.GRANDMOTHER,existingUnits:units,idFactory:legacyMaterialPlantId,completeMissing:!registrySealed(state,registry,lot,MATERIAL_PLANT_TYPES.GRANDMOTHER)})}for(const source of list(state?.motherPlants)){const lot=canonicalLotForState(state,source);lots.push([MATERIAL_PLANT_TYPES.MOTHER,lot]);units=materializeLotPlantUnits(lot,{plantType:MATERIAL_PLANT_TYPES.MOTHER,existingUnits:units,idFactory:legacyMaterialPlantId,completeMissing:!registrySealed(state,registry,lot,MATERIAL_PLANT_TYPES.MOTHER)})}const lotMap=new Map(lots.map(([type,lot])=>[`${organizationOf(lot)}:${type}:${lot.id}`,lot])),legacyLots=new Map();for(const[type,lot]of lots){const key=`${type}:${lot.id}`,bucket=legacyLots.get(key)||[];bucket.push(lot);legacyLots.set(key,bucket)}return Object.freeze(units.map(unit=>{const owner=explicitOrganizationId(unit);let lot=owner?lotMap.get(`${owner}:${unit.plantType}:${unit.lotId}`):null;if(!lot){const candidates=legacyLots.get(`${unit.plantType}:${unit.lotId}`)||[];if(candidates.length===1)lot=candidates[0];else if(candidates.length>1)throw new Error('Una identidad vegetal legacy sin tenant es ambigua entre organizaciones.')}if(!lot)throw new Error('La identidad vegetal no resuelve un lote canónico en su empresa.');return normalizeUnit(unit,lot)}))}
export function materialPlantUnitById(state,unitId){const candidates=projectMaterialPlantUnits(state).filter(item=>item.id===unitId),active=organizationForCandidates(state,candidates.map(item=>item.organizationId)),matches=candidates.filter(item=>item.organizationId===active);if(matches.length>1)throw new Error('Existe más de una identidad vegetal igual dentro de la empresa activa.');return matches[0]||null}
export function selectedMaterialPlantUnits(state,selectedIds=[]){const selected=new Set(list(selectedIds)),candidates=projectMaterialPlantUnits(state).filter(item=>selected.has(item.id));if(candidates.length===0)return Object.freeze([]);const active=organizationForCandidates(state,candidates.map(item=>item.organizationId));return Object.freeze(candidates.filter(item=>item.organizationId===active))}
