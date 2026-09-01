import{projectMaterialPlantUnits}from'./materialPlantIdentity.js'
import{activeOrganizationId,explicitOrganizationId}from'./organizationOwnership.js'
import{irrigationMirfeRecordOrganizationId}from'./irrigationMirfeTenancy.js'

const list=value=>Array.isArray(value)?value:[]
const text=value=>String(value??'').trim()
const TREATMENT_INTERVENTION_TYPES=new Set(['Tratamiento','TREATMENT'])

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

function plantPositionGeographyValid(state,record,organizationId){
 const owner=text(organizationId),directSiteId=text(record?.siteId),bedId=text(record?.bedId)
 if(!owner)return false
 if(!bedId)return!directSiteId||ownerForSite(state,directSiteId).includes(owner)
 const beds=list(state?.beds).filter(item=>text(item?.id)===bedId&&irrigationMirfeRecordOrganizationId(state,'beds',item)===owner)
 if(beds.length!==1)return false
 const bed=beds[0],declaredHouseId=text(record?.houseId),bedHouseId=text(bed?.houseId)
 if(declaredHouseId&&bedHouseId&&declaredHouseId!==bedHouseId)return false
 let derivedSiteId=text(bed?.siteId)
 if(bedHouseId){
  const houses=list(state?.houses).filter(item=>text(item?.id)===bedHouseId&&irrigationMirfeRecordOrganizationId(state,'houses',item)===owner)
  if(houses.length!==1)return false
  const houseSiteId=text(houses[0]?.siteId)
  if(derivedSiteId&&houseSiteId&&derivedSiteId!==houseSiteId)return false
  derivedSiteId=houseSiteId||derivedSiteId
 }
 if(derivedSiteId&&!ownerForSite(state,derivedSiteId).includes(owner))return false
 if(directSiteId&&derivedSiteId&&directSiteId!==derivedSiteId)return false
 if(directSiteId&&!ownerForSite(state,directSiteId).includes(owner))return false
 return true
}

function plantPositionSiteId(state,record,organizationId){
 if(!plantPositionGeographyValid(state,record,organizationId))return''
 const owner=text(organizationId),bedId=text(record?.bedId),directSiteId=text(record?.siteId)
 if(!bedId)return directSiteId
 const bed=list(state?.beds).find(item=>text(item?.id)===bedId&&irrigationMirfeRecordOrganizationId(state,'beds',item)===owner)
 if(!bed)return''
 const houseId=text(bed?.houseId)
 if(houseId){const house=list(state?.houses).find(item=>text(item?.id)===houseId&&irrigationMirfeRecordOrganizationId(state,'houses',item)===owner);return text(house?.siteId)||text(bed?.siteId)||directSiteId}
 return text(bed?.siteId)||directSiteId
}

function projectedMaterialMatches(state,id){
 const targetId=text(id)
 if(!targetId)return{valid:true,items:[]}
 try{return{valid:true,items:projectMaterialPlantUnits(state).filter(item=>text(item?.id)===targetId)}}catch{return{valid:false,items:[]}}
}

function materialPlantOwners(state,id){
 const targetId=text(id),projection=projectedMaterialMatches(state,targetId)
 if(!targetId)return[]
 if(!projection.valid)return['__ambiguous_material_plant__']
 if(projection.items.length)return[...new Set(projection.items.map(item=>text(item?.organizationId)).filter(Boolean))]
 const owners=[]
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
 const owner=irrigationMirfeRecordOrganizationId(state,collection,record)
 if(collection==='plantPositions'&&owner&&!plantPositionGeographyValid(state,record,owner))return''
 return owner
}

function ownersForReference(state,collection,id){
 const key=text(id)
 if(!key)return[]
 const resolver=MIPE_OWNERSHIP_COLLECTIONS.includes(collection)?mipeRecordOrganizationId:sharedRecordOrganizationId
 return[...new Set(list(state?.[collection]).filter(item=>text(item?.id)===key).map(item=>resolver(state,collection,item)).filter(Boolean))]
}

function explicitOwnersForReference(state,collection,id){
 const key=text(id)
 if(!key)return[]
 return[...new Set(list(state?.[collection]).filter(item=>text(item?.id)===key).map(explicitOrganizationId).filter(Boolean))]
}

function ownedReference(state,collection,id,organizationId){
 const key=text(id),owner=text(organizationId)
 if(!key||!owner)return null
 const resolver=MIPE_OWNERSHIP_COLLECTIONS.includes(collection)?mipeRecordOrganizationId:sharedRecordOrganizationId
 const matches=list(state?.[collection]).filter(item=>text(item?.id)===key&&resolver(state,collection,item)===owner)
 return matches.length===1?matches[0]:null
}

function materialReference(state,id,organizationId){
 const targetId=text(id),owner=text(organizationId),projection=projectedMaterialMatches(state,targetId)
 if(!targetId||!owner)return{valid:false,found:false,item:null}
 if(!projection.valid)return{valid:false,found:false,item:null}
 if(projection.items.length){const matches=projection.items.filter(item=>text(item?.organizationId)===owner);return{valid:matches.length===1,found:matches.length===1,item:matches[0]||null}}
 const legacy=[]
 for(const collection of['grandmotherPlants','motherPlants'])for(const item of list(state?.[collection]).filter(record=>text(record?.id)===targetId&&sharedRecordOrganizationId(state,collection,record)===owner))legacy.push(item)
 return{valid:legacy.length<=1,found:legacy.length===1,item:legacy[0]||null}
}

function sitesCompatible(declaredSiteId,referenceSiteIds){
 const declared=text(declaredSiteId),references=[...new Set(referenceSiteIds.map(text).filter(Boolean))]
 if(references.length>1)return false
 return!declared||!references.length||declared===references[0]
}

function recordSiteCausallyValid(state,collection,record,organizationId){
 const owner=text(organizationId)
 if(!owner||collection==='incidents')return Boolean(owner)
 if(collection==='findings'){
  const references=[]
  const positionId=text(record?.plantPositionId)||(text(record?.targetType)==='POSITION'?text(record?.targetId):'')
  if(positionId){const position=ownedReference(state,'plantPositions',positionId,owner);if(position)references.push(plantPositionSiteId(state,position,owner))}
  const materialId=text(record?.materialPlantId)||(text(record?.targetType)==='MATERIAL_PLANT'?text(record?.targetId):'')
  if(materialId){const material=materialReference(state,materialId,owner);if(!material.valid)return false;if(material.found)references.push(text(material.item?.siteId))}
  return sitesCompatible(record?.siteId,references)
 }
 if(collection==='treatments'){
  const findingId=text(record?.findingId),finding=ownedReference(state,'findings',findingId,owner)
  if(!findingId||!finding)return false
  const product=ownedReference(state,'products',record?.productId,owner),lot=ownedReference(state,'inventoryLots',record?.lotId||record?.inventoryLotId,owner)
  if(product&&lot&&text(lot.productId)&&text(product.id)!==text(lot.productId))return false
  return sitesCompatible(record?.siteId,[finding.siteId,product?.siteId,lot?.siteId])
 }
 if(collection==='mipeInterventions'){
  const findingId=text(record?.findingId),finding=ownedReference(state,'findings',findingId,owner)
  if(!findingId||!finding)return false
  const treatmentId=text(record?.treatmentId),treatment=ownedReference(state,'treatments',treatmentId,owner)
  if(treatmentId&&!treatment)return false
  if(TREATMENT_INTERVENTION_TYPES.has(text(record?.type))&&!treatmentId)return false
  if(treatment&&text(treatment.findingId)!==findingId)return false
  return sitesCompatible(record?.siteId,[finding.siteId,treatment?.siteId])
 }
 return true
}

function findingOwnerGroups(state,record){
 const groups=[]
 const siteOwners=ownerForSite(state,record?.siteId)
 if(siteOwners.length)groups.push(siteOwners)
 const positionId=text(record?.plantPositionId)||(text(record?.targetType)==='POSITION'?text(record?.targetId):'')
 if(positionId){const owners=ownersForReference(state,'plantPositions',positionId);if(owners.length)groups.push(owners)}
 const materialId=text(record?.materialPlantId)||(text(record?.targetType)==='MATERIAL_PLANT'?text(record?.targetId):'')
 if(materialId){const owners=materialPlantOwners(state,materialId);if(owners.length)groups.push(owners)}
 const incidentOwners=explicitOwnersForReference(state,'incidents',record?.incidentId)
 if(incidentOwners.length)groups.push(incidentOwners)
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
  // Interventions with explicit, conflict-free tenant ownership must remain visible to
  // read-side projectors even when their causal Treatment evidence is corrupt. The
  // projector is the fail-closed authority for that evidence. Write paths still call
  // ownMipeRecord(), which retains recordSiteCausallyValid() below.
  if(collection==='mipeInterventions')return explicit
  if(!recordSiteCausallyValid(state,collection,record,explicit))return''
  return explicit
 }
 const inferred=[...new Set(groups.flat())]
 if(inferred.length===1)return recordSiteCausallyValid(state,collection,record,inferred[0])?inferred[0]:''
 if(inferred.length>1)return''
 const companies=list(state?.companies),fallback=companies.length===1?text(companies[0]?.id):companies.length===0?'local-installation':''
 return fallback&&recordSiteCausallyValid(state,collection,record,fallback)?fallback:''
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
  const material=materialReference(state,materialId,owner)
  if(!material.valid)throw new Error('planta material tiene identidad duplicada o ambigua dentro de la empresa activa.')
  if(!material.found){const owners=materialPlantOwners(state,materialId);if(owners.length)throw new Error('planta material pertenece a otra empresa o no tiene ownership inequívoco.');throw new Error('No se encontró planta material en la empresa activa.')}
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
 const owned={...record,organizationId:owner}
 if(!recordSiteCausallyValid(state,collection,owned,owner))throw new Error(`${collection} referencia una cadena causal o sede incompatible con la empresa activa.`)
 return owned
}
