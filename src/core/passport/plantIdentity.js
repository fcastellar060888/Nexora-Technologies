import{createIntelligentObject,createPassport,DETERMINISTIC_TIMESTAMP}from'./passportContract.js'
import{MATERIAL_PLANT_TYPES}from'../../domain/materialPlantIdentity.js'
import{activeOrganizationId,explicitOrganizationId,resolveOrganizationId}from'../../domain/organizationOwnership.js'

const COLLECTION_BY_KIND=Object.freeze({grandmother:'grandmotherPlants',mother:'motherPlants'})
const OBJECT_TYPE_BY_KIND=Object.freeze({grandmother:'cultivation.grandmother',mother:'cultivation.mother'})
const MATERIAL_TYPE_BY_KIND=Object.freeze({grandmother:MATERIAL_PLANT_TYPES.GRANDMOTHER,mother:MATERIAL_PLANT_TYPES.MOTHER})

function text(value,fallback=''){const normalized=String(value??'').trim();return normalized||fallback}
function quantity(value){const parsed=Math.trunc(Number(value));return Number.isFinite(parsed)&&parsed>0?parsed:1}
function pad(index){return String(index).padStart(3,'0')}
function normalizeKind(kind){const normalized=text(kind).toLowerCase();if(!COLLECTION_BY_KIND[normalized])throw new Error('El tipo de planta debe ser grandmother o mother');return normalized}
function stableIndividualId(lotId,index){return`${text(lotId,'lot')}:${pad(index)}`}
function individualCode(lot,index){return`${text(lot.lotCode,lot.id)}-${pad(index)}`}

export function expandPlantLot(lot,{kind,organizationId=null}={}){
 const normalizedKind=normalizeKind(kind)
 if(!lot||typeof lot!=='object'||Array.isArray(lot))throw new Error('El lote vegetal debe ser un objeto')
 const lotId=text(lot.id)
 if(!lotId)throw new Error('El lote vegetal requiere identificador')
 const total=quantity(lot.quantity),owner=text(organizationId||explicitOrganizationId(lot),'local-installation')
 return Object.freeze(Array.from({length:total},(_,offset)=>{
  const index=offset+1
  return Object.freeze({id:stableIndividualId(lotId,index),lotId,kind:normalizedKind,index,total,code:individualCode(lot,index),organizationId:owner,siteId:text(lot.siteId)||null,geneticId:text(lot.geneticId)||null,status:text(lot.status,'Activa'),healthStatus:text(lot.healthStatus,'Sin registro'),createdAt:text(lot.createdAt)||null,cycleStartedAt:text(lot.cycleStartedAt||lot.startDate)||null,sourceLot:lot})
 }))
}

function canonicalUnit(state,plant){
 const materialType=MATERIAL_TYPE_BY_KIND[plant.kind]
 const candidates=(state?.materialPlantUnits||[]).filter(unit=>unit?.lotId===plant.lotId&&unit?.plantType===materialType&&Number(unit?.unitIndex)===plant.index&&explicitOrganizationId(unit)===plant.organizationId)
 if(candidates.length>1)throw new Error('Existen identidades durables duplicadas para la misma planta individual')
 return candidates[0]||null
}

export function listIndividualPlants(state,{kind,siteId=null,lotId=null,status=null}={}){
 const normalizedKind=normalizeKind(kind),active=activeOrganizationId(state)
 const collection=Array.isArray(state?.[COLLECTION_BY_KIND[normalizedKind]])?state[COLLECTION_BY_KIND[normalizedKind]]:[]
 return Object.freeze(collection
  .filter(lot=>!siteId||String(lot.siteId)===String(siteId))
  .filter(lot=>!lotId||String(lot.id)===String(lotId))
  .filter(lot=>!status||String(lot.status)===String(status))
  .flatMap(lot=>{
   const organizationId=resolveOrganizationId(state,{record:lot,siteId:lot.siteId,label:`el lote ${lot.id}`})
   if(organizationId!==active)return[]
   return expandPlantLot(lot,{kind:normalizedKind,organizationId}).map(plant=>{const unit=canonicalUnit(state,plant);return unit?Object.freeze({...plant,id:unit.id,legacyId:plant.id,code:unit.code||plant.code,canonicalSource:'materialPlantUnits'}):plant})
  }))
}

export function findIndividualPlant(state,{kind,individualId}={}){
 const id=text(individualId)
 if(!id)return null
 return listIndividualPlants(state,{kind}).find(plant=>plant.id===id||plant.legacyId===id)||null
}

export function createPlantPassportFromState(state,{kind,individualId,timeline=[],documents=[],actions=[],risks=[],indicators=[],decisionContext={}}={}){
 const normalizedKind=normalizeKind(kind)
 const plant=findIndividualPlant(state,{kind:normalizedKind,individualId})
 if(!plant)throw new Error('No se encontró la planta individual solicitada')
 const lot=plant.sourceLot
 const grandmotherLot=normalizedKind==='mother'?(state?.grandmotherPlants||[]).find(item=>item.id===lot.grandmotherPlantId&&resolveOrganizationId(state,{record:item,siteId:item.siteId,label:'el lote de abuelas'})===plant.organizationId):null
 const relationships=[]
 if(grandmotherLot)relationships.push({type:'descends_from',targetType:OBJECT_TYPE_BY_KIND.grandmother,targetId:grandmotherLot.id,targetOrganizationId:plant.organizationId,label:grandmotherLot.lotCode||grandmotherLot.id})
 relationships.push({type:'member_of_lot',targetType:`${OBJECT_TYPE_BY_KIND[normalizedKind]}.lot`,targetId:plant.lotId,targetOrganizationId:plant.organizationId,label:lot.lotCode||lot.id})
 const createdAt=plant.createdAt||text(lot.createdAt)||DETERMINISTIC_TIMESTAMP
 const updatedAt=text(lot.updatedAt)||createdAt
 const object=createIntelligentObject({objectType:OBJECT_TYPE_BY_KIND[normalizedKind],objectId:plant.id,organizationId:plant.organizationId,siteId:plant.siteId,label:plant.code,status:plant.status,createdAt,updatedAt,identity:{code:plant.code,kind:normalizedKind,lotId:plant.lotId,lotCode:lot.lotCode||'',individualIndex:plant.index,totalInLot:plant.total,legacyId:plant.legacyId||null},attributes:{geneticId:plant.geneticId,healthStatus:plant.healthStatus,cycleStartedAt:plant.cycleStartedAt,renewalDays:lot.renewalDays??null,alertDays:lot.alertDays??null,notes:lot.notes||'',source:lot.source||''},metadata:{compatibilityMode:plant.canonicalSource?'canonical-material-unit-v1':'virtual-individual-from-lot-v1',sourceCollection:plant.canonicalSource||COLLECTION_BY_KIND[normalizedKind]}})
 return createPassport({object,relationships,documents,indicators,risks,actions,timeline,decisionContext})
}