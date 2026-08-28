import{INVENTORY_SCOPED_COLLECTIONS,inventoryRecordOrganizationId}from'./inventoryTenancy.js'

const list=value=>Array.isArray(value)?value:[]
const text=value=>String(value??'').trim()
const recordId=record=>text(record?.id||record?.commandId)
const ownerOf=record=>text(record?.organizationId||record?.companyId||record?._organizationId)

function replaceTenantRecord(items,record,tenant){
 const id=recordId(record)
 if(!id)throw new Error('El registro remoto de inventario requiere identidad estable')
 const matches=list(items).filter(item=>recordId(item)===id&&ownerOf(item)===tenant)
 if(matches.length>1)throw new Error('El estado local contiene identidad de inventario duplicada dentro del tenant')
 return matches.length===0?[...list(items),record]:list(items).map(item=>recordId(item)===id&&ownerOf(item)===tenant?record:item)
}

export function stageInventoryHydration(state,records,{organizationId}={}){
 const tenant=text(organizationId)
 if(!tenant)throw new Error('La hidratación de inventario requiere organizationId explícito')
 const next={...state}
 for(const collection of INVENTORY_SCOPED_COLLECTIONS){
  for(const record of list(records).filter(item=>item?.collection===collection&&!item?.deletedAt).map(item=>item.record)){
   if(ownerOf(record)!==tenant)throw new Error(`${collection} remoto pertenece a otra empresa`)
   next[collection]=replaceTenantRecord(next[collection],record,tenant)
  }
 }
 for(const collection of INVENTORY_SCOPED_COLLECTIONS){
  const incoming=list(records).filter(item=>item?.collection===collection&&!item?.deletedAt).map(item=>item.record)
  for(const record of incoming){
   const causalOwner=inventoryRecordOrganizationId(next,collection,record)
   if(causalOwner!==tenant)throw new Error(`${collection} remoto no demuestra causalidad tenant-aware`)
  }
 }
 return next
}

export function assertInventoryHydrationRows(state,rows,{organizationId}={}){
 const tenant=text(organizationId)
 const records=list(rows).filter(row=>INVENTORY_SCOPED_COLLECTIONS.includes(row?.collection)&&!row?.deletedAt).map(row=>({
  collection:row.collection,
  record:{...(row.payload||{}),id:text(row.recordId),organizationId:tenant,_organizationId:tenant,_syncVersion:Number(row.version||0),_updatedAt:row.updatedAt||''}
 }))
 return stageInventoryHydration(state,records,{organizationId:tenant})
}
