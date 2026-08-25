import { explicitOrganizationId } from './organizationOwnership.js'
import { irrigationMirfeRecordOrganizationId } from './irrigationMirfeTenancy.js'
import { mipeRecordOrganizationId } from './mipeTenancy.js'

const list = value => Array.isArray(value) ? value : []
const text = value => String(value ?? '').trim()
const same = (a, b) => text(a) === text(b)
const terminalFinding = status => ['Resuelto', 'Falso positivo', 'Planta eliminada'].includes(text(status))

export const OPERATIONAL_CONTEXT_FIELDS = Object.freeze(['companyId', 'siteId', 'houseId', 'bedId', 'plantId'])

const INDIRECT_GEOGRAPHY_REFERENCES = Object.freeze({
  inventoryMovements: Object.freeze([Object.freeze(['inventoryLots', 'lotId', 'lote de inventario'])]),
  workOrders: Object.freeze([Object.freeze(['tankPreparations', 'preparationId', 'preparación de tanque'])])
})

function activeUserId(state) {
  const activeUsers = list(state?.users).filter(item => item?.activeSession && item?.active !== false)
  if (activeUsers.length > 1) throw new Error('La sesión activa es ambigua; existen múltiples usuarios activos.')
  return text(activeUsers[0]?.id)
}

function activeMemberships(state) {
  const memberships = list(state?.memberships).filter(item => text(item?.status || 'active') === 'active')
  const userId = activeUserId(state)
  return userId ? memberships.filter(item => text(item?.userId) === userId) : memberships
}

function allowedCompanyIds(state) {
  const memberships = activeMemberships(state)
  return memberships.length
    ? new Set(memberships.map(item => text(item?.companyId || item?.organizationId)).filter(Boolean))
    : new Set(list(state?.companies).map(item => text(item?.id)).filter(Boolean))
}

function membershipSites(state, organizationId) {
  const all = activeMemberships(state)
  const memberships = all.filter(item => same(item?.companyId || item?.organizationId, organizationId))
  if (!all.length) return null
  if (!memberships.length) return new Set()
  if (memberships.some(item => list(item?.siteIds).length === 0)) return null
  return new Set(memberships.flatMap(item => list(item?.siteIds)).map(text).filter(Boolean))
}

function recordsForOrganization(state, collection, organizationId) {
  return list(state?.[collection]).filter(record => irrigationMirfeRecordOrganizationId(state, collection, record) === organizationId)
}

function uniqueById(records, id, label) {
  const key = text(id)
  if (!key) return null
  const matches = list(records).filter(item => same(item?.id, key))
  if (matches.length > 1) throw new Error(`${label} tiene identidad duplicada dentro de la empresa activa.`)
  return matches[0] || null
}

function companyFor(state, companyId) {
  const key = text(companyId)
  if (!key) return null
  const matches = list(state?.companies).filter(item => same(item?.id, key))
  if (matches.length > 1) throw new Error('La empresa activa tiene identidad duplicada.')
  return matches[0] || null
}

function organizationGenetics(state, organizationId) {
  return list(state?.genetics).filter(record => irrigationMirfeRecordOrganizationId(state, 'genetics', record) === organizationId)
}

export function operationalContextOptions(state, requested = state?.currentContext || {}) {
  const allowedCompanies = allowedCompanyIds(state)
  const companies = list(state?.companies).filter(item => allowedCompanies.has(text(item?.id)))
  const preferredCompany = text(requested?.companyId)
  const companyId = allowedCompanies.has(preferredCompany) && companyFor(state, preferredCompany) ? preferredCompany : text(companies[0]?.id)
  const siteRestriction = membershipSites(state, companyId)
  const sites = recordsForOrganization(state, 'sites', companyId).filter(site => siteRestriction === null || siteRestriction.has(text(site?.id)))
  const siteId = text(requested?.siteId), site = uniqueById(sites, siteId, 'La sede activa')
  const houses = site ? recordsForOrganization(state, 'houses', companyId).filter(item => same(item?.siteId, site.id)) : []
  const house = uniqueById(houses, requested?.houseId, 'La nave activa')
  const beds = house ? recordsForOrganization(state, 'beds', companyId).filter(item => same(item?.houseId, house.id)) : []
  const bed = uniqueById(beds, requested?.bedId, 'La cama activa')
  const plants = bed ? recordsForOrganization(state, 'plantPositions', companyId).filter(item => same(item?.bedId, bed.id)) : []
  const plant = uniqueById(plants, requested?.plantId, 'La planta activa'), genetics = organizationGenetics(state, companyId)
  return Object.freeze({ companyId, companies:Object.freeze(companies), sites:Object.freeze(sites), houses:Object.freeze(houses), beds:Object.freeze(beds), plants:Object.freeze(plants), genetics:Object.freeze(genetics), selected:Object.freeze({company:companyFor(state,companyId),site,house,bed,plant}) })
}

export function normalizeOperationalContext(state, requested = state?.currentContext || {}) {
  const options=operationalContextOptions(state,requested),current=requested||{},companyId=options.companyId
  const siteId=options.selected.site?text(options.selected.site.id):'',houseId=siteId&&options.selected.house?text(options.selected.house.id):'',bedId=houseId&&options.selected.bed?text(options.selected.bed.id):'',plantId=bedId&&options.selected.plant?text(options.selected.plant.id):''
  const geneticId=uniqueById(options.genetics,current.geneticId,'La genética activa')?text(current.geneticId):'',week=Math.max(1,Math.trunc(Number(current.week)||1))
  return Object.freeze({...current,companyId,siteId,houseId,bedId,plantId,geneticId,stage:text(current.stage),week,cycleId:text(current.cycleId)})
}

export function transitionOperationalContext(state,patch={}){
  const current={...(state?.currentContext||{})},next={...current,...patch}
  if(Object.hasOwn(patch,'companyId')&&!same(patch.companyId,current.companyId))Object.assign(next,{siteId:'',houseId:'',bedId:'',plantId:'',geneticId:''})
  if(Object.hasOwn(patch,'siteId')&&!same(patch.siteId,current.siteId))Object.assign(next,{houseId:'',bedId:'',plantId:''})
  if(Object.hasOwn(patch,'houseId')&&!same(patch.houseId,current.houseId))Object.assign(next,{bedId:'',plantId:''})
  if(Object.hasOwn(patch,'bedId')&&!same(patch.bedId,current.bedId))next.plantId=''
  return normalizeOperationalContext(state,next)
}

export function operationalContextForPlant(state,plantId,{companyId=state?.currentContext?.companyId||''}={}){
  const base=normalizeOperationalContext(state,{...(state?.currentContext||{}),companyId,siteId:'',houseId:'',bedId:'',plantId:''}),organizationId=base.companyId
  const lineage=canonicalSiteForPlant(state,plantId,organizationId)
  if(!lineage)throw new Error('La planta no tiene una jerarquía canónica consistente dentro de la empresa activa.')
  const options=operationalContextOptions(state,{...base,siteId:lineage.siteId}),site=uniqueById(options.sites,lineage.siteId,'La sede de la planta')
  if(!site)throw new Error('La planta pertenece a una sede fuera del alcance operativo del usuario.')
  return normalizeOperationalContext(state,{...base,siteId:site.id,houseId:lineage.houseId,bedId:lineage.bedId,plantId:lineage.plantId})
}

function legacySiteOwner(state,siteId){
 const owners=[...new Set(list(state?.sites).filter(site=>same(site?.id,siteId)).map(explicitOrganizationId).filter(Boolean))]
 return owners.length===1?owners[0]:''
}
function directRecordBelongs(state,record,organizationId,allowedSiteIds){
 const owner=explicitOrganizationId(record)
 if(owner&&owner!==organizationId)return false
 const siteId=text(record?.siteId)
 if(siteId){
  if(!allowedSiteIds.has(siteId))return false
  if(owner)return true
  const inferredOwner=legacySiteOwner(state,siteId)
  if(inferredOwner)return inferredOwner===organizationId
  return list(state?.companies).length<=1
 }
 if(owner)return true
 return list(state?.companies).length<=1
}
function scopeDirect(state,key,organizationId,allowedSiteIds){return list(state?.[key]).filter(record=>directRecordBelongs(state,record,organizationId,allowedSiteIds))}
function hierarchyReference(state,collection,id,organizationId,label){return uniqueById(recordsForOrganization(state,collection,organizationId),id,label)}
function assertUniqueRecordIds(records,label){const seen=new Set();for(const record of list(records)){const id=text(record?.id);if(!id)continue;if(seen.has(id))throw new Error(`${label} contiene identidad duplicada dentro de la empresa activa.`);seen.add(id)}return records}
function canonicalSiteForHouse(state,houseId,organizationId){const house=hierarchyReference(state,'houses',houseId,organizationId,'La nave del registro contextual');if(!house)return null;const siteId=text(house?.siteId),site=siteId?hierarchyReference(state,'sites',siteId,organizationId,'La sede de la nave contextual'):null;if(!site)return null;return{siteId:text(site.id),houseId:text(house.id)}}
function canonicalSiteForBed(state,bedId,organizationId){const bed=hierarchyReference(state,'beds',bedId,organizationId,'La cama del registro contextual');if(!bed)return null;const lineage=canonicalSiteForHouse(state,bed?.houseId,organizationId);if(!lineage)return null;const declaredSiteId=text(bed?.siteId);if(declaredSiteId&&declaredSiteId!==lineage.siteId)return null;return{...lineage,bedId:text(bed.id)}}
function canonicalSiteForPlant(state,plantId,organizationId){const plant=hierarchyReference(state,'plantPositions',plantId,organizationId,'La planta del registro contextual');if(!plant)return null;const lineage=canonicalSiteForBed(state,plant?.bedId,organizationId);if(!lineage)return null;const declaredHouseId=text(plant?.houseId),declaredSiteId=text(plant?.siteId);if(declaredHouseId&&declaredHouseId!==lineage.houseId)return null;if(declaredSiteId&&declaredSiteId!==lineage.siteId)return null;return{...lineage,plantId:text(plant.id)}}

function directGeographyEvidence(state,record,organizationId,{siteIds,houseIds,bedIds,plantIds}){
 const evidence=[],directSiteId=text(record?.siteId),directHouseId=text(record?.houseId),directBedId=text(record?.bedId),plantId=text(record?.plantId),plantPositionId=text(record?.plantPositionId)
 if(plantId&&plantPositionId&&plantId!==plantPositionId)return{valid:false,hasGeography:true,siteIds:[]}
 if(directSiteId){const site=hierarchyReference(state,'sites',directSiteId,organizationId,'La sede del registro contextual');if(!site||!siteIds.has(text(site.id)))return{valid:false,hasGeography:true,siteIds:[]};evidence.push(text(site.id))}
 if(directHouseId){const lineage=canonicalSiteForHouse(state,directHouseId,organizationId);if(!lineage||!houseIds.has(lineage.houseId))return{valid:false,hasGeography:true,siteIds:[]};evidence.push(lineage.siteId)}
 if(directBedId){const lineage=canonicalSiteForBed(state,directBedId,organizationId);if(!lineage||!bedIds.has(lineage.bedId))return{valid:false,hasGeography:true,siteIds:[]};evidence.push(lineage.siteId)}
 const effectivePlantId=plantPositionId||plantId
 if(effectivePlantId){const lineage=canonicalSiteForPlant(state,effectivePlantId,organizationId);if(!lineage||!plantIds.has(lineage.plantId))return{valid:false,hasGeography:true,siteIds:[]};evidence.push(lineage.siteId)}
 const resolvedSites=[...new Set(evidence)];if(resolvedSites.length>1)return{valid:false,hasGeography:true,siteIds:resolvedSites};return{valid:true,hasGeography:evidence.length>0,siteIds:resolvedSites}
}
function indirectGeographyEvidence(state,collection,record,organizationId,hierarchyScope){const evidence=[];let hasGeography=false;for(const[targetCollection,field,label]of INDIRECT_GEOGRAPHY_REFERENCES[collection]||[]){const referenceId=text(record?.[field]);if(!referenceId)continue;hasGeography=true;const target=hierarchyReference(state,targetCollection,referenceId,organizationId,`La ${label} del registro contextual`);if(!target)return{valid:false,hasGeography:true,siteIds:[]};const targetEvidence=directGeographyEvidence(state,target,organizationId,hierarchyScope);if(!targetEvidence.valid||!targetEvidence.hasGeography)return{valid:false,hasGeography:true,siteIds:[]};evidence.push(...targetEvidence.siteIds)}const resolvedSites=[...new Set(evidence)];if(resolvedSites.length>1)return{valid:false,hasGeography:true,siteIds:resolvedSites};return{valid:true,hasGeography,siteIds:resolvedSites}}
function operationalRecordMatchesScope(state,collection,record,organizationId,hierarchyScope){const direct=directGeographyEvidence(state,record,organizationId,hierarchyScope);if(!direct.valid)return false;const indirect=indirectGeographyEvidence(state,collection,record,organizationId,hierarchyScope);if(!indirect.valid)return false;return new Set([...direct.siteIds,...indirect.siteIds]).size<=1}

export function scopeOperationalState(state,requested=state?.currentContext||{}){
 const context=normalizeOperationalContext(state,requested),organizationId=context.companyId,options=operationalContextOptions(state,context)
 if(!organizationId)return{...state,currentContext:context}
 const siteRestriction=membershipSites(state,organizationId),allSites=assertUniqueRecordIds([...options.sites],'Las sedes autorizadas')
 const siteIds=new Set((context.siteId?allSites.filter(item=>same(item.id,context.siteId)):allSites).map(item=>text(item.id)))
 const candidateHouses=assertUniqueRecordIds(recordsForOrganization(state,'houses',organizationId),'Las naves')
 const allHouses=candidateHouses.filter(item=>{const lineage=canonicalSiteForHouse(state,item?.id,organizationId);return Boolean(lineage)&&siteIds.has(lineage.siteId)})
 const houses=context.houseId?allHouses.filter(item=>same(item.id,context.houseId)):allHouses,houseIds=new Set(houses.map(item=>text(item.id)))
 const candidateBeds=assertUniqueRecordIds(recordsForOrganization(state,'beds',organizationId),'Las camas')
 const allBeds=candidateBeds.filter(item=>{const lineage=canonicalSiteForBed(state,item?.id,organizationId);return Boolean(lineage)&&houseIds.has(lineage.houseId)&&siteIds.has(lineage.siteId)})
 const beds=context.bedId?allBeds.filter(item=>same(item.id,context.bedId)):allBeds,bedIds=new Set(beds.map(item=>text(item.id)))
 const candidatePlants=assertUniqueRecordIds(recordsForOrganization(state,'plantPositions',organizationId),'Las plantas')
 const allPlants=candidatePlants.filter(item=>{const lineage=canonicalSiteForPlant(state,item?.id,organizationId);return Boolean(lineage)&&bedIds.has(lineage.bedId)&&houseIds.has(lineage.houseId)&&siteIds.has(lineage.siteId)})
 const plantPositions=context.plantId?allPlants.filter(item=>same(item.id,context.plantId)):allPlants,plantIds=new Set(plantPositions.map(item=>text(item.id))),sites=allSites.filter(item=>siteIds.has(text(item.id))),hierarchyScope={siteIds,houseIds,bedIds,plantIds}
 const tenantFindings=list(state?.findings).filter(record=>mipeRecordOrganizationId(state,'findings',record)===organizationId)
 const findings=tenantFindings.filter(finding=>{const positionId=text(finding?.plantPositionId)||(text(finding?.targetType)==='POSITION'?text(finding?.targetId):'');if(positionId)return operationalRecordMatchesScope(state,'findings',{...finding,plantPositionId:positionId},organizationId,hierarchyScope);if(context.houseId||context.bedId||context.plantId)return false;if(finding?.siteId)return operationalRecordMatchesScope(state,'findings',finding,organizationId,hierarchyScope);return!context.siteId&&siteRestriction===null})
 const findingIds=new Set(findings.map(item=>text(item.id)))
 const treatments=list(state?.treatments).filter(record=>mipeRecordOrganizationId(state,'treatments',record)===organizationId&&findingIds.has(text(record?.findingId)))
 const mipeInterventions=list(state?.mipeInterventions).filter(record=>mipeRecordOrganizationId(state,'mipeInterventions',record)===organizationId&&findingIds.has(text(record?.findingId)))
 const incidents=list(state?.incidents).filter(record=>mipeRecordOrganizationId(state,'incidents',record)===organizationId)
 const allAuthorizedSiteIds=new Set(allSites.map(item=>text(item.id))),scoped={...state,currentContext:context,sites,houses,beds,plantPositions,findings,treatments,mipeInterventions,incidents}
 for(const key of['propagationBanks','propagationUnits','genetics','products','inventoryLots','inventoryMovements','workOrders','costEntries'])if(Array.isArray(state?.[key]))scoped[key]=recordsForOrganization(state,key,organizationId).filter(record=>operationalRecordMatchesScope(state,key,record,organizationId,hierarchyScope))
 for(const key of['grandmotherPlants','motherPlants'])if(Array.isArray(state?.[key]))scoped[key]=list(state[key]).filter(record=>mipeRecordOrganizationId(state,key,record)===organizationId).filter(record=>operationalRecordMatchesScope(state,key,record,organizationId,hierarchyScope))
 for(const key of['propagationBatches','mapElements','facilityAreas','operationalAreas','finishedGoods','finishedGoodsMovements','sales','customers','phaseTransitions','plantEvents'])if(Array.isArray(state?.[key]))scoped[key]=scopeDirect(state,key,organizationId,allAuthorizedSiteIds).filter(record=>operationalRecordMatchesScope(state,key,record,organizationId,hierarchyScope))
 return scoped
}

export function contextualFindingIsOpen(finding){return!terminalFinding(finding?.status)}
