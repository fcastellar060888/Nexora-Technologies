import{backfillMipeOwnership}from'../domain/mipeTenancy.js'

export const MIPE_PERSISTENCE_VERSION=1

const list=value=>Array.isArray(value)?value:[]
const text=value=>String(value??'').trim()
const ownerOf=value=>text(value?.organizationId||value?.companyId||value?._organizationId)

function normalizeReceipt(record){
 if(!record||typeof record!=='object'||Array.isArray(record))return null
 const commandId=text(record.commandId||record.id),organizationId=ownerOf(record)
 if(!commandId||!organizationId)return null
 return{...record,id:commandId,commandId,organizationId}
}

export function migrateMipePersistenceState(input={}){
 let state={...input,mipeInterventions:list(input?.mipeInterventions),mipeCommandReceipts:list(input?.mipeCommandReceipts)}
 state=backfillMipeOwnership(state)
 const receipts=state.mipeCommandReceipts.map(normalizeReceipt).filter(Boolean),identities=new Map()
 for(const receipt of receipts){
  const key=`${receipt.organizationId}\u0000${receipt.commandId}`,existing=identities.get(key)
  if(existing&&existing.signature!==receipt.signature)throw new Error('Persistencia MIPE contiene receipts contradictorios para el mismo commandId.')
  if(!existing)identities.set(key,receipt)
 }
 return{...state,mipeCommandReceipts:[...identities.values()],mipePersistenceVersion:MIPE_PERSISTENCE_VERSION}
}
