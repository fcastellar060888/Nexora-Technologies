import{activeOrganizationId,explicitOrganizationId}from'./organizationOwnership.js'

const list=value=>Array.isArray(value)?value:[]
const text=value=>String(value??'').trim()

export const IRRIGATION_MIRFE_OWNERSHIP_COLLECTIONS=Object.freeze([
 'waterAnalyses','nutrientProducts','nutrientObjectives','irrigationPlans','formulations','tankPreparations','irrigationApplications'
])

export const IRRIGATION_MIRFE_SCOPED_COLLECTIONS=Object.freeze([
 'sites','houses','beds','plantPositions','propagationBanks','propagationUnits','genetics','products','inventoryLots','inventoryMovements',
 'irrigationEmitters','irrigationSectors','irrigationAssignments','irrigationPulses','irrigationMeasurements','drainageMeasurements',
 ...IRRIGATION_MIRFE_OWNERSHIP_COLLECTIONS,'workOrders','costEntries','mirfePrograms','mirfeMonitoring','mirfeReinforcements','irrigationCorrections','irrigationHistory'
])

const REFERENCES=Object.freeze({
 houses:[['sites','siteId','sede']],
 beds:[['houses','houseId','nave']],
 plantPositions:[['beds','bedId','cama']],
 propagationBanks:[['sites','siteId','sede']],
 propagationUnits:[['sites','siteId','sede']],
 irrigationEmitters:[['sites','siteId','sede']],
 irrigationSectors:[['sites','siteId','sede'],['houses','houseId','nave']],
 irrigationAssignments:[['sites','siteId','sede'],['irrigationSectors','sectorId','sector'],['irrigationEmitters','emitterId','emisor']],
 irrigationPulses:[['sites','siteId','sede'],['irrigationSectors','sectorId','sector']],
 irrigationMeasurements:[['sites','siteId','sede'],['irrigationSectors','sectorId','sector'],['irrigationPulses','pulseId','pulso']],
 drainageMeasurements:[['sites','siteId','sede'],['irrigationSectors','sectorId','sector'],['irrigationPulses','pulseId','pulso']],
 inventoryLots:[['sites','siteId','sede'],['products','productId','producto de inventario']],
 inventoryMovements:[['inventoryLots','lotId','lote de inventario'],['products','productId','producto de inventario'],['sites','siteId','sede']],
 waterAnalyses:[['sites','siteId','sede']],
 nutrientProducts:[['products','inventoryProductId','producto de inventario']],
 nutrientObjectives:[['genetics','geneticId','genética']],
 irrigationPlans:[['sites','siteId','sede'],['houses','houseId','nave'],['genetics','geneticId','genética']],
 formulations:[['sites','siteId','sede'],['genetics','geneticId','genética'],['formulations','supersedesFormulaId','fórmula anterior']],
 tankPreparations:[['formulations','formulationId','formulación'],['sites','siteId','sede']],
 workOrders:[['tankPreparations','preparationId','preparación'],['sites','siteId','sede']],
 irrigationApplications:[['tankPreparations','preparationId','preparación'],['formulations','formulationId','formulación'],['sites','siteId','sede'],['houses','houseId','nave']],
 costEntries:[['sites','siteId','sede']],
 mirfePrograms:[['sites','siteId','sede'],['houses','houseId','nave'],['genetics','geneticId','genética']],
 mirfeMonitoring:[['sites','siteId','sede'],['houses','houseId','nave']],
 mirfeReinforcements:[['sites','siteId','sede'],['houses','houseId','nave']],
 irrigationCorrections:[['sites','siteId','sede'],['houses','houseId','nave']],
 irrigationHistory:[['sites','siteId','sede'],['houses','houseId','nave']]
})

function referencedOwners(state,collection,record,visited){
 const groups=[]
 for(const[targetCollection,field]of REFERENCES[collection]||[]){
  const referenceId=text(record?.[field])
  if(!referenceId)continue
  const candidates=list(state?.[targetCollection]).filter(item=>text(item?.id)===referenceId)
  const owners=[...new Set(candidates.map(item=>irrigationMirfeRecordOrganizationId(state,targetCollection,item,new Set(visited))).filter(Boolean))]
  if(owners.length)groups.push(owners)
 }
 return groups
}

export function irrigationMirfeRecordOrganizationId(state,collection,record,visited=new Set()){
 if(!record||typeof record!=='object'||visited.has(record))return''
 const nextVisited=new Set(visited);nextVisited.add(record)
 const explicit=explicitOrganizationId(record)
 const groups=referencedOwners(state,collection,record,nextVisited)
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

export function irrigationMirfeRecordsForOrganization(state,collection,organizationId=activeOrganizationId(state)){
 const owner=text(organizationId)
 return list(state?.[collection]).filter(record=>irrigationMirfeRecordOrganizationId(state,collection,record)===owner)
}

export function findIrrigationMirfeRecord(state,collection,id,{label=collection,organizationId=activeOrganizationId(state)}={}){
 const recordId=text(id)
 const matches=irrigationMirfeRecordsForOrganization(state,collection,organizationId).filter(record=>text(record?.id)===recordId)
 if(matches.length>1)throw new Error(`${label} tiene identidad duplicada dentro de la empresa activa.`)
 if(matches.length===1)return matches[0]
 const homonyms=list(state?.[collection]).filter(record=>text(record?.id)===recordId)
 if(homonyms.length)throw new Error(`${label} pertenece a otra empresa o no tiene ownership inequívoco.`)
 throw new Error(`No se encontró ${label} en la empresa activa.`)
}

function assertReference(state,targetCollection,referenceId,organizationId,label){
 const candidates=list(state?.[targetCollection]).filter(item=>text(item?.id)===text(referenceId))
 if(!Array.isArray(state?.[targetCollection]))return
 if(!candidates.length)throw new Error(`No se encontró ${label} en la empresa activa.`)
 if(!candidates.some(item=>irrigationMirfeRecordOrganizationId(state,targetCollection,item)===organizationId))throw new Error(`${label} pertenece a otra empresa o no tiene ownership inequívoco.`)
}

function assertNestedReferences(state,collection,record,organizationId){
 if(collection==='formulations')for(const item of list(record?.items))assertReference(state,'nutrientProducts',item?.productId,organizationId,'producto nutricional')
 if(collection==='tankPreparations')for(const item of list(record?.items)){
  assertReference(state,'nutrientProducts',item?.nutrientProductId,organizationId,'producto nutricional')
  if(item?.inventoryProductId)assertReference(state,'products',item.inventoryProductId,organizationId,'producto de inventario')
  if(item?.lotId)assertReference(state,'inventoryLots',item.lotId,organizationId,'lote de inventario')
 }
}

export function ownIrrigationMirfeRecord(state,collection,record,organizationId=activeOrganizationId(state)){
 if(!record||typeof record!=='object'||Array.isArray(record))throw new Error(`Registro inválido en ${collection}.`)
 const owner=text(organizationId),declared=explicitOrganizationId(record)
 if(!text(record.id))throw new Error(`Registro sin id en ${collection}.`)
 if(declared&&declared!==owner)throw new Error(`No se puede mutar ${collection} de otra empresa.`)
 for(const[targetCollection,field,label]of REFERENCES[collection]||[]){
  const referenceId=text(record?.[field])
  if(referenceId)assertReference(state,targetCollection,referenceId,owner,label)
 }
 assertNestedReferences(state,collection,record,owner)
 return{...record,organizationId:owner}
}

export function scopeIrrigationMirfeState(state,organizationId=activeOrganizationId(state)){
 const next={...state}
 for(const collection of IRRIGATION_MIRFE_SCOPED_COLLECTIONS)if(Array.isArray(state?.[collection]))next[collection]=irrigationMirfeRecordsForOrganization(state,collection,organizationId)
 return next
}

function mergeCollection(state,tenantBase,tenantCandidate,collection,organizationId){
 const before=list(tenantBase?.[collection]),candidate=list(tenantCandidate?.[collection])
 if(JSON.stringify(before)===JSON.stringify(candidate))return state[collection]
 const owned=candidate.map(record=>ownIrrigationMirfeRecord(state,collection,record,organizationId))
 const byId=new Map()
 for(const record of owned){
  const id=text(record.id)
  if(byId.has(id))throw new Error(`${collection} contiene un id duplicado dentro de la empresa activa.`)
  byId.set(id,record)
 }
 const seenBase=new Set(),merged=[]
 for(const record of list(state?.[collection])){
  const belongs=irrigationMirfeRecordOrganizationId(state,collection,record)===organizationId
  if(!belongs){merged.push(record);continue}
  const id=text(record?.id)
  if(seenBase.has(id))throw new Error(`${collection} ya contiene un id duplicado dentro de la empresa activa.`)
  seenBase.add(id)
  if(byId.has(id)){merged.push(byId.get(id));byId.delete(id)}
 }
 merged.push(...byId.values())
 return merged
}

export function mergeIrrigationMirfeState(state,tenantBase,tenantCandidate,organizationId=activeOrganizationId(state)){
 if(!tenantCandidate||typeof tenantCandidate!=='object')throw new Error('La mutación MIRFE debe devolver un estado válido.')
 const next={...state}
 for(const collection of IRRIGATION_MIRFE_SCOPED_COLLECTIONS)if(Array.isArray(tenantBase?.[collection])||Array.isArray(tenantCandidate?.[collection]))next[collection]=mergeCollection(state,tenantBase,tenantCandidate,collection,organizationId)
 return next
}

export function mutateIrrigationMirfeState(state,recipe){
 const organizationId=activeOrganizationId(state),tenantBase=scopeIrrigationMirfeState(state,organizationId)
 const tenantCandidate=typeof recipe==='function'?recipe(tenantBase):recipe
 return mergeIrrigationMirfeState(state,tenantBase,tenantCandidate,organizationId)
}

export function backfillIrrigationMirfeOwnership(state){
 let next={...state}
 for(const collection of IRRIGATION_MIRFE_OWNERSHIP_COLLECTIONS){
  if(!Array.isArray(next[collection]))continue
  next={...next,[collection]:next[collection].map(record=>{
   const organizationId=irrigationMirfeRecordOrganizationId(next,collection,record)
   return organizationId&&!record.organizationId?{...record,organizationId}:record
  })}
 }
 return next
}
