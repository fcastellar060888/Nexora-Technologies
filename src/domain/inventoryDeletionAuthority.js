import{inventoryRecordOrganizationId}from'./inventoryTenancy.js'

const list=value=>Array.isArray(value)?value:[]
const text=value=>String(value??'').trim()
const ownerOf=record=>text(record?.organizationId||record?.companyId||record?._organizationId)
const idOf=record=>text(record?.id)
const DELETE_COLLECTIONS=new Set(['products','inventoryLots'])

function removeTenantRecord(items,id,tenant){
 return list(items).filter(item=>!(idOf(item)===id&&ownerOf(item)===tenant))
}
function upsertTenantRecord(items,record,tenant){
 const id=idOf(record)
 if(!id)throw new Error('El upsert remoto de inventario requiere identidad estable')
 const matches=list(items).filter(item=>idOf(item)===id&&ownerOf(item)===tenant)
 if(matches.length>1)throw new Error('El estado contiene identidad de inventario duplicada dentro del tenant')
 return matches.length?[...list(items).map(item=>idOf(item)===id&&ownerOf(item)===tenant?record:item)]:[...list(items),record]
}
function assertFinalCausality(state,tenant){
 for(const lot of list(state.inventoryLots).filter(item=>ownerOf(item)===tenant)){
  if(inventoryRecordOrganizationId(state,'inventoryLots',lot)!==tenant)throw new Error('El delete de inventario dejaría un Lot sin Product causal del mismo tenant')
 }
 for(const movement of list(state.inventoryMovements).filter(item=>ownerOf(item)===tenant)){
  if(inventoryRecordOrganizationId(state,'inventoryMovements',movement)!==tenant)throw new Error('El delete de inventario dejaría un Movement sin Lot/Product causal del mismo tenant')
 }
 return state
}

export function stageInventoryDeletePlan(state,operations,{organizationId}={}){
 const tenant=text(organizationId)
 if(!tenant)throw new Error('La validación de deletes de inventario requiere organizationId explícito')
 const next={...state,products:[...list(state?.products)],inventoryLots:[...list(state?.inventoryLots)],inventoryMovements:[...list(state?.inventoryMovements)]}
 for(const op of list(operations)){
  const collection=text(op?.collection)
  if(!['products','inventoryLots','inventoryMovements'].includes(collection))continue
  const id=text(op?.recordId||op?.id)
  if(!id)throw new Error('El delete de inventario requiere identidad estable')
  if(op?.operation==='upsert'||op?.deletedAt===undefined&&op?.payload){
   const record={...(op.payload||{}),id,organizationId:tenant,_organizationId:tenant}
   next[collection]=upsertTenantRecord(next[collection],record,tenant)
   continue
  }
  const isDelete=op?.operation==='delete'||Boolean(op?.deletedAt)
  if(!isDelete)continue
  if(collection==='inventoryMovements')throw new Error('inventoryMovements es append-only y no admite delete')
  if(!DELETE_COLLECTIONS.has(collection))continue
  next[collection]=removeTenantRecord(next[collection],id,tenant)
 }
 return assertFinalCausality(next,tenant)
}

export function assertInventoryDeleteChanges(state,changes,{organizationId}={}){
 const relevant=list(changes).filter(change=>['products','inventoryLots','inventoryMovements'].includes(change?.collection))
 if(!relevant.some(change=>change?.operation==='delete'))return state
 return stageInventoryDeletePlan(state,relevant,{organizationId})
}

export function assertInventoryDeleteRows(state,rows,{organizationId}={}){
 const relevant=list(rows).filter(row=>['products','inventoryLots','inventoryMovements'].includes(row?.collection)).map(row=>({
  collection:row.collection,recordId:text(row.recordId),deletedAt:row.deletedAt,payload:row.payload
 }))
 if(!relevant.some(row=>Boolean(row.deletedAt)))return state
 return stageInventoryDeletePlan(state,relevant,{organizationId})
}
