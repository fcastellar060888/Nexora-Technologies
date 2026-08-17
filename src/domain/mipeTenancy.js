import{activeOrganizationId,explicitOrganizationId}from'./organizationOwnership.js'
import{irrigationMirfeRecordOrganizationId}from'./irrigationMirfeTenancy.js'

const list=value=>Array.isArray(value)?value:[]
const text=value=>String(value??'').trim()

export const MIPE_OWNERSHIP_COLLECTIONS=Object.freeze(['incidents','findings','treatments','mipeInterventions'])
export const MIPE_SCOPED_COLLECTIONS=Object.freeze([
 'sites','houses','beds','plantPositions','grandmotherPlants','motherPlants','genetics','products','inventoryLots','inventoryMovements','costEntries',
 ...MIPE_OWNERSHIP_COLLECTIONS
])

function ownerForSite(state,siteId){
 const id=text(siteId)
 if(!id)return[]
 return[...new Set(list(state?.sites).filter(item=>text(item?.id)===id).map(explicitOrganizationId).filter(Boolean))]
}

function materialPlantOwners(state,id){
 const targetId=text(id),owners=[]
 if(!targetId)return owners
 for(const collection of['grandmotherPlants','motherPlants'])for(const item of list(state?.[collection]).filter(record=>text(record?.id)===targetId)){
  const explicit=explicitOrganizationId(item)
  if(explicit){owners.push(explicit);continue}
  owners.push(...ownerForSite(state,item?.siteId))
 }
 return[...new Set(owners.filter(Boolean))]
}

function sharedRecordOrganizationId(state,collection,record){
 if(!record||typeof record!=='object')return''
 const explicit=explicitOrganizationId(record)
 if(collection==='sites')return explicit
 if(collection==='grandmotherPlants'||collection==='motherPlants'){
  if(explicit)return explicit
  const owners=ownerForSite(state,record?.siteId)
  return owners.length===1?owners[0]:''
 }
 return irrigationMirfeRecordOrganizationId(state,collection,record)
}

function ownersForReference(state,collection,id){
 const key=text(id)
 if(!key)return[]
 const resolver=MIPE_OWNERSHIP_COLLECTIONS.includes(collection)?mipeRecordOrganizationId:sharedRecordOrganizationId
 return[...new Set(list(state?.[collection]).filter(item=>text(item?.id)===key).map(item=>resolver(state,collection,item)).filter(Boolean))]
}

function findingOwnerGroups(state,record){
 const groups=[]
 const siteOwners=ownerForSite(state,record?.siteId)
 if(siteOwners.length)groups.push(siteOwners)
 const positionId=text(record?.plantPositionId)||(text(record?.targetType)==='POSITION'?text(record?.targetId):'')
 if(positionId){const owners=ownersForReference(state,'plantPositions',positionId);if(owners.length)groups.push(owners)}
 const materialId=text(record?.materialPlantId)||(text(record?.targetType)==='MATERIAL_PLANT'?text(record?.targetId):'')
 if(materialId){const owners=materialPlantOwners(state,materialId);if(owners.length)groups.push(owners)}
 return groups
}

function incidentReverseOwners(state,record){
 const id=text(record?.id)
 if(!id)return[]
 return[...new Set(list(state?.findings).filter(item=>text(item?.incidentId)===id).map(item=>mipeRecordOrganizationId(state,'findings',item)).filter(Boolean))]
}

function recordOwnerGroups(state,collection,record){
 if(collection==='findings')return findingOwnerGroups(state,record)
 if(collection==='incidents'){
  const owners=incidentReverseOwners(state,record)
  return owners.length?[owners]:[]
 }
 if(collection==='treatments'){
  const groups=[]
  for(const[targetCollection,field]of[['findings','findingId'],['products','productId'],['inventoryLots','lotId']]){
   const id=text(record?.[field]);if(!id)continue
   const owners=ownersForReference(state,targetCollection,id);if(owners.length)groups.push(owners)
  }
  const siteOwners=ownerForSite(state,record?.siteId);if(siteOwners.length)groups.push(siteOwners)
  return groups
 }
 if(collection==='mipeInterventions'){
  const groups=[]
  for(const[targetCollection,field]of[['findings','findingId'],['treatments','treatmentId']]){
   const id=text(record?.[field]);if(!id)continue
   const owners=ownersForReference(state,targetCollection,id);if(owners.length)groups.push(owners)
  }
  const siteOwners=ownerForSite(state,record?.siteId);if(siteOwners.length)groups.push(siteOwners)
  return groups
 }
 return[]
}

export function mipeRecordOrganizationId(state,collection,record){
 if(!record||typeof record!=='object')return''
 if(!MIPE_OWNERSHIP_COLLECTIONS.includes(collection))return sharedRecordOrganizationId(state,collection,record)
 const explicit=explicitOrganizationId(record),groups=recordOwnerGroups(state,collection,record)
 if(explicit){
  if(groups.some(owners=>!owners.includes(explicit)))return''
  return explicit
 }
 const inferred=[...new Set(groups.flat())]
 if(inferred.length===1)return inferred[0]
 if(inferred.length>1)return''
 const companies=list(state?.companies)
 if(companies.length===1)return text(companies[0]?.id)
 if(companies.length===0)return'local-installation'
 return''
}

export function mipeRecordsForOrganization(state,collection,organizationId=activeOrganizationId(state)){
 const owner=text(organizationId)
 return list(state?.[collection]).filter(record=>mipeRecordOrganizationId(state,collection,record)===owner)
}

export function findMipeRecord(state,collection,id,{label=collection,organizationId=activeOrganizationId(state)}={}){
 const recordId=text(id),matches=mipeRecordsForOrganization(state,collection,organizationId).filter(record=>text(record?.id)===recordId)
 if(matches.length>1)throw new Error(`${label} tiene identidad duplicada dentro de la empresa activa.`)
 if(matches.length===1)return matches[0]
 const homonyms=list(state?.[collection]).filter(record=>text(record?.id)===recordId)
 if(homonyms.length)throw new Error(`${label} pertenece a otra empresa o no tiene ownership inequívoco.`)
 throw new Error(`No se encontró ${label} en la empresa activa.`)
}

function assertReference(state,collection,id,organizationId,label,{optional=false}={}){
 const key=text(id)
 if(!key){if(optional)return;throw new Error(`${label} es obligatorio.`)}
 const candidates=list(state?.[collection]).filter(item=>text(item?.id)===key)
 if(!candidates.length)throw new Error(`No se encontró ${label} en la empresa activa.`)
 const owners=candidates.map(item=>mipeRecordOrganizationId(state,collection,item))
 if(!owners.includes(organizationId))throw new Error(`${label} pertenece a otra empresa o no tiene ownership inequívoco.`)
 if(owners.filter(owner=>owner===organizationId).length>1)throw new Error(`${label} tiene identidad duplicada dentro de la empresa activa.`)
}

function assertFindingReferences(state,record,owner){
 if(record?.siteId)assertReference(state,'sites',record.siteId,owner,'sede')
 const positionId=text(record?.plantPositionId)||(text(record?.targetType)==='POSITION'?text(record?.targetId):'')
 const materialId=text(record?.materialPlantId)||(text(record?.targetType)==='MATERIAL_PLANT'?text(record?.targetId):'')
 if(positionId)assertReference(state,'plantPositions',positionId,owner,'planta/Position')
 else if(materialId){
  const matches=[...list(state?.grandmotherPlants),...list(state?.motherPlants)].filter(item=>text(item?.id)===materialId)
  if(!matches.length)throw new Error('No se encontró planta material en la empresa activa.')
  const owners=matches.map(item=>sharedRecordOrganizationId(state,list(state?.grandmotherPlants).includes(item)?'grandmotherPlants':'motherPlants',item))
  if(!owners.includes(owner))throw new Error('planta material pertenece a otra empresa o no tiene ownership inequívoco.')
  if(owners.filter(value=>value===owner).length>1)throw new Error('planta material tiene identidad duplicada dentro de la empresa activa.')
 }
 assertReference(state,'incidents',record?.incidentId,owner,'incidencia')
}

export function ownMipeRecord(state,collection,record,organizationId=activeOrganizationId(state)){
 if(!MIPE_OWNERSHIP_COLLECTIONS.includes(collection))throw new Error(`${collection} no pertenece a la autoridad MIPE mutable.`)
 if(!record||typeof record!=='object'||Array.isArray(record))throw new Error(`Registro inválido en ${collection}.`)
 const owner=text(organizationId),declared=explicitOrganizationId(record)
 if(!text(record.id))throw new Error(`Registro sin id en ${collection}.`)
 if(declared&&declared!==owner)throw new Error(`No se puede mutar ${collection} de otra empresa.`)
 if(collection==='findings')assertFindingReferences(state,record,owner)
 if(collection==='treatments'){
  assertReference(state,'findings',record?.findingId,owner,'hallazgo')
  assertReference(state,'products',record?.productId,owner,'producto')
  if(record?.lotId||record?.inventoryLotId)assertReference(state,'inventoryLots',record.lotId||record.inventoryLotId,owner,'lote de inventario')
 }
 if(collection==='mipeInterventions'){
  assertReference(state,'findings',record?.findingId,owner,'hallazgo')
  if(record?.treatmentId)assertReference(state,'treatments',record.treatmentId,owner,'tratamiento')
 }
 return{...record,organizationId:owner}
}

export function scopeMipeState(state,organizationId=activeOrganizationId(state)){
 const next={...state}
 for(const collection of MIPE_SCOPED_COLLECTIONS)if(Array.isArray(state?.[collection]))next[collection]=mipeRecordsForOrganization(state,collection,organizationId)
 return next
}

function mergeCollection(state,tenantBase,tenantCandidate,collection,organizationId){
 const before=list(tenantBase?.[collection]),candidate=list(tenantCandidate?.[collection])
 if(JSON.stringify(before)===JSON.stringify(candidate))return state[collection]
 if(!MIPE_OWNERSHIP_COLLECTIONS.includes(collection))throw new Error(`${collection} no puede mutarse desde la frontera MIPE.`)
 const owned=candidate.map(record=>ownMipeRecord(state,collection,record,organizationId)),byId=new Map()
 for(const record of owned){const id=text(record.id);if(byId.has(id))throw new Error(`${collection} contiene un id duplicado dentro de la empresa activa.`);byId.set(id,record)}
 const seenBase=new Set(),merged=[]
 for(const record of list(state?.[collection])){
  const belongs=mipeRecordOrganizationId(state,collection,record)===organizationId
  if(!belongs){merged.push(record);continue}
  const id=text(record?.id)
  if(seenBase.has(id))throw new Error(`${collection} ya contiene un id duplicado dentro de la empresa activa.`)
  seenBase.add(id)
  if(byId.has(id)){merged.push(byId.get(id));byId.delete(id)}
 }
 merged.push(...byId.values())
 return merged
}

export function mergeMipeState(state,tenantBase,tenantCandidate,organizationId=activeOrganizationId(state)){
 if(!tenantCandidate||typeof tenantCandidate!=='object')throw new Error('La mutación MIPE debe devolver un estado válido.')
 const next={...state}
 for(const collection of MIPE_OWNERSHIP_COLLECTIONS)if(Array.isArray(tenantBase?.[collection])||Array.isArray(tenantCandidate?.[collection]))next[collection]=mergeCollection(state,tenantBase,tenantCandidate,collection,organizationId)
 return next
}

export function mutateMipeState(state,recipe){
 const organizationId=activeOrganizationId(state),tenantBase=scopeMipeState(state,organizationId),tenantCandidate=typeof recipe==='function'?recipe(tenantBase):recipe
 return mergeMipeState(state,tenantBase,tenantCandidate,organizationId)
}

function fallbackOwner(state){const companies=list(state?.companies);if(companies.length===1)return text(companies[0]?.id);if(companies.length===0)return'local-installation';return''}

function backfillCollection(state,collection){
 return list(state?.[collection]).map(record=>{
  if(explicitOrganizationId(record))return record
  const organizationId=mipeRecordOrganizationId(state,collection,record)
  return organizationId?{...record,organizationId}:record
 })
}

function backfillIncidents(state){
 const explicitByIdentity=new Set(list(state?.incidents).map(record=>{const owner=explicitOrganizationId(record);return owner?`${owner}\u0000${text(record.id)}`:''}).filter(Boolean)),fallback=fallbackOwner(state),result=[]
 for(const record of list(state?.incidents)){
  if(explicitOrganizationId(record)){result.push(record);continue}
  const owners=incidentReverseOwners(state,record)
  const targets=owners.length?owners:(fallback?[fallback]:[])
  if(!targets.length){result.push(record);continue}
  for(const owner of targets){const key=`${owner}\u0000${text(record.id)}`;if(explicitByIdentity.has(key))continue;result.push({...record,organizationId:owner});explicitByIdentity.add(key)}
 }
 return result
}

export function backfillMipeOwnership(state){
 let next={...state,mipeInterventions:list(state?.mipeInterventions)}
 next={...next,findings:backfillCollection(next,'findings')}
 next={...next,incidents:backfillIncidents(next)}
 next={...next,treatments:backfillCollection(next,'treatments')}
 next={...next,mipeInterventions:backfillCollection(next,'mipeInterventions')}
 return next
}
