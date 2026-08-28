import{activeOrganizationId,resolveOrganizationId}from'./organizationOwnership.js'

const list=value=>Array.isArray(value)?value:[]
const text=value=>String(value??'').trim()
export const INVENTORY_SCOPED_COLLECTIONS=Object.freeze(['products','inventoryLots','inventoryMovements'])

function ownerOf(state,record,label){
 if(!record||typeof record!=='object')return''
 try{return resolveOrganizationId(state,{record,siteId:record?.siteId,label})}catch{return''}
}
function uniqueOwnedReference(state,collection,id,owner,resolver){
 const matches=list(state?.[collection]).filter(item=>text(item?.id)===text(id)&&resolver(item)===owner)
 return matches.length===1?matches[0]:null
}
function causalOwner(state,collection,record){
 const direct=ownerOf(state,record,`el registro ${collection}`)
 if(collection==='products')return direct
 if(collection==='inventoryLots'){
  if(!direct)return''
  const product=uniqueOwnedReference(state,'products',record?.productId,direct,item=>ownerOf(state,item,'el producto de inventario'))
  return product?direct:''
 }
 if(collection==='inventoryMovements'){
  if(!direct)return''
  const lot=uniqueOwnedReference(state,'inventoryLots',record?.lotId,direct,item=>causalOwner(state,'inventoryLots',item))
  const product=uniqueOwnedReference(state,'products',record?.productId,direct,item=>ownerOf(state,item,'el producto de inventario'))
  if(!lot||!product||text(lot.productId)!==text(product.id))return''
  if(text(record?.siteId)&&text(lot.siteId)&&text(record.siteId)!==text(lot.siteId))return''
  return direct
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
 const owner=text(organizationId),next={...current},candidate={...current,...incoming}
 for(const collection of INVENTORY_SCOPED_COLLECTIONS){
  const foreign=list(current?.[collection]).filter(record=>inventoryRecordOrganizationId(current,collection,record)!==owner)
  const local=list(incoming?.[collection]).filter(record=>inventoryRecordOrganizationId(candidate,collection,record)===owner)
  const ids=new Set();for(const record of local){const id=text(record?.id);if(!id||ids.has(id))throw new Error(`${collection} contiene identidad duplicada dentro de la empresa activa.`);ids.add(id)}
  next[collection]=[...foreign,...local]
 }
 return next
}
