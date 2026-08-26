import{activeOrganizationId,explicitOrganizationId,resolveOrganizationId}from'./organizationOwnership.js'

const list=value=>Array.isArray(value)?value:[]
const text=value=>String(value??'').trim()
export const INVENTORY_SCOPED_COLLECTIONS=Object.freeze(['products','inventoryLots','inventoryMovements'])

function ownerOf(state,record,label){
 if(!record||typeof record!=='object')return''
 const explicit=explicitOrganizationId(record)
 if(explicit)return explicit
 try{return resolveOrganizationId(state,{record,siteId:record?.siteId,label})}catch{return''}
}
function causalOwner(state,collection,record){
 const direct=ownerOf(state,record,`el registro ${collection}`)
 if(collection==='products')return direct
 if(collection==='inventoryLots'){
  const productOwners=[...new Set(list(state?.products).filter(item=>text(item?.id)===text(record?.productId)).map(item=>ownerOf(state,item,'el producto de inventario')).filter(Boolean))]
  const evidence=[direct,...productOwners].filter(Boolean)
  return evidence.length&&new Set(evidence).size===1?evidence[0]:''
 }
 if(collection==='inventoryMovements'){
  const lotOwners=[...new Set(list(state?.inventoryLots).filter(item=>text(item?.id)===text(record?.lotId)).map(item=>causalOwner(state,'inventoryLots',item)).filter(Boolean))]
  const productOwners=[...new Set(list(state?.products).filter(item=>text(item?.id)===text(record?.productId)).map(item=>ownerOf(state,item,'el producto de inventario')).filter(Boolean))]
  const evidence=[direct,...lotOwners,...productOwners].filter(Boolean)
  return evidence.length&&new Set(evidence).size===1?evidence[0]:''
 }
 return''
}
export function inventoryRecordOrganizationId(state,collection,record){
 if(!INVENTORY_SCOPED_COLLECTIONS.includes(collection))throw new Error(`Colección de inventario no soportada: ${collection}`)
 return causalOwner(state,collection,record)
}
export function inventoryRecordsForOrganization(state,collection,organizationId=activeOrganizationId(state)){
 const owner=text(organizationId)
 return list(state?.[collection]).filter(record=>inventoryRecordOrganizationId(state,collection,record)===owner)
}
export function scopeInventoryState(state,organizationId=activeOrganizationId(state)){
 const scoped={...state}
 for(const collection of INVENTORY_SCOPED_COLLECTIONS)scoped[collection]=inventoryRecordsForOrganization(state,collection,organizationId)
 scoped.sites=list(state?.sites).filter(site=>ownerOf(state,site,'la sede de inventario')===text(organizationId))
 return scoped
}
export function mergeInventoryState(current,incoming,organizationId=activeOrganizationId(current)){
 const owner=text(organizationId),next={...current}
 for(const collection of INVENTORY_SCOPED_COLLECTIONS){
  const foreign=list(current?.[collection]).filter(record=>inventoryRecordOrganizationId(current,collection,record)!==owner)
  const local=list(incoming?.[collection]).filter(record=>inventoryRecordOrganizationId({...current,...incoming},collection,record)===owner)
  const ids=new Set();for(const record of local){const id=text(record?.id);if(!id||ids.has(id))throw new Error(`${collection} contiene identidad duplicada dentro de la empresa activa.`);ids.add(id)}
  next[collection]=[...foreign,...local]
 }
 return next
}
