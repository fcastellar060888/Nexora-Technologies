const list=value=>Array.isArray(value)?value:[]
const text=value=>String(value??'').trim()
const object=value=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value)

export function assertInventoryCommandReceipt(receipt,{organizationId='',commandId=''}={}){
 if(!object(receipt))throw new Error('El receipt de inventario requiere payload válido.')
 const tenant=text(receipt.organizationId),id=text(receipt.commandId||receipt.id),signature=text(receipt.signature),operation=text(receipt.operation),aggregateId=text(receipt.aggregateId)
 if(!tenant)throw new Error('El receipt de inventario requiere organizationId explícito.')
 if(organizationId&&tenant!==text(organizationId))throw new Error('El receipt de inventario pertenece a otra empresa.')
 if(!id)throw new Error('El receipt de inventario requiere commandId estable.')
 if(commandId&&id!==text(commandId))throw new Error('El receipt de inventario no coincide con su commandId durable.')
 if(!signature)throw new Error('El receipt de inventario requiere firma durable.')
 if(!operation||!aggregateId)throw new Error('El receipt de inventario requiere operación y aggregateId.')
 return{...receipt,id,commandId:id,organizationId:tenant,signature,operation,aggregateId}
}

export function mergeInventoryCommandReceipts(localReceipts=[],remoteReceipts=[],organizationId=''){
 const tenant=text(organizationId)
 if(!tenant)throw new Error('Se requiere empresa para hidratar receipts de inventario.')
 const local=list(localReceipts),remote=list(remoteReceipts)
 const foreign=local.filter(item=>text(item?.organizationId)!==tenant)
 const tenantLocal=local.filter(item=>text(item?.organizationId)===tenant).map(item=>assertInventoryCommandReceipt(item,{organizationId:tenant}))
 const tenantRemote=remote.map(item=>assertInventoryCommandReceipt(item,{organizationId:tenant}))
 const byId=new Map()
 for(const item of [...tenantLocal,...tenantRemote]){
  const previous=byId.get(item.commandId)
  if(previous&&previous.signature!==item.signature)throw new Error('El receipt remoto de inventario contradice la firma durable local.')
  if(previous&&(previous.operation!==item.operation||previous.aggregateId!==item.aggregateId))throw new Error('El receipt remoto de inventario contradice la operación durable local.')
  byId.set(item.commandId,previous||item)
 }
 return[...foreign,...byId.values()]
}

export function assertInventoryReceiptAppendOnly(before=[],after=[],organizationId=''){
 const tenant=text(organizationId)
 if(!tenant)throw new Error('Se requiere empresa para validar receipts de inventario.')
 const prior=new Map(list(before).filter(item=>text(item?.organizationId)===tenant).map(item=>{const valid=assertInventoryCommandReceipt(item,{organizationId:tenant});return[valid.commandId,valid]}))
 const next=new Map(list(after).filter(item=>text(item?.organizationId)===tenant).map(item=>{const valid=assertInventoryCommandReceipt(item,{organizationId:tenant});return[valid.commandId,valid]}))
 for(const[id,item]of prior){
  const current=next.get(id)
  if(!current)throw new Error('Los receipts de inventario son append-only y no admiten eliminación.')
  if(current.signature!==item.signature||current.operation!==item.operation||current.aggregateId!==item.aggregateId)throw new Error('Los receipts de inventario son evidencia durable e inmutable.')
 }
 return true
}
