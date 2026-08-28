import{applyRemoteRecords,collectionChanges}from'./syncEngine.js'
import{authenticatedRequest}from'./supabase.js'

export const INVENTORY_MOVEMENT_TRANSACTION_COLLECTIONS=Object.freeze(['inventoryLots','inventoryMovements'])
const list=value=>Array.isArray(value)?value:[]
const text=value=>String(value??'').trim()
const ownerOf=record=>text(record?.organizationId||record?.companyId||record?._organizationId)
const ownersOf=record=>[record?.organizationId,record?.companyId,record?._organizationId].map(text).filter(Boolean)
const version=value=>{const parsed=Number(value||0);if(!Number.isSafeInteger(parsed)||parsed<0)throw new Error('La versión de sync de inventario no es válida.');return parsed}
const finite=(value,label)=>{const parsed=Number(value);if(!Number.isFinite(parsed))throw new Error(`${label} debe ser un número finito.`);return parsed}

function validateChain(movements,lot,organizationId){
 if(!movements.length||movements.length>2)throw new Error('La transacción manual requiere uno o dos movimientos de kardex.')
 let previousAfter=null
 for(let index=0;index<movements.length;index+=1){
  const movement=movements[index],quantity=finite(movement.quantity,'quantity'),signed=finite(movement.signedQuantity,'signedQuantity'),before=finite(movement.balanceBefore,'balanceBefore'),after=finite(movement.balanceAfter,'balanceAfter'),sequence=Number(movement.ledgerSequence)
  if(ownerOf(movement)!==organizationId||ownersOf(movement).some(owner=>owner!==organizationId))throw new Error('El movimiento pertenece a otra empresa.')
  if(movement.lotId!==lot.id||movement.productId!==lot.productId||movement.siteId!==lot.siteId)throw new Error('El movimiento no coincide con lote, producto y sede.')
  if(quantity<=0||after!==before+signed||after<0||!Number.isSafeInteger(sequence)||sequence<1)throw new Error('La cadena del movimiento manual no es consistente.')
  if(index===0&&movement.sourceType==='LegacyInventoryBootstrap'){
   if(movement.id!==`inventory-opening:${organizationId}:${lot.id}`||sequence!==1||text(movement.previousMovementId)||before!==0||signed!==quantity||after!==quantity)throw new Error('La evidencia inicial legacy no es canónica.')
  }else if(movement.sourceType!=='Manual')throw new Error('La transacción manual contiene un origen no autorizado.')
  if(previousAfter!==null&&before!==previousAfter)throw new Error('Los movimientos manuales no forman una cadena continua.')
  if(index>0){const previous=movements[index-1];if(sequence!==Number(previous.ledgerSequence)+1||text(movement.previousMovementId)!==text(previous.id))throw new Error('La cadena append-only del kardex está rota.')}
  previousAfter=after
 }
 if(finite(lot.quantity,'quantity del lote')!==previousAfter)throw new Error('El saldo final del lote no coincide con el kardex de la transacción.')
}

export function buildInventoryMovementTransaction(before,after,{commandId,signature,organizationId,movementId}={}){
 const owner=text(organizationId),command=text(commandId),commandSignature=text(signature),targetMovementId=text(movementId)
 if(!owner||!command||!commandSignature||!targetMovementId)throw new Error('La transacción de inventario requiere empresa, comando, firma y movimiento.')
 const changes=collectionChanges(before,after,INVENTORY_MOVEMENT_TRANSACTION_COLLECTIONS)
 if(!changes.length||changes.some(change=>change.operation!=='upsert'))throw new Error('El movimiento manual debe producir únicamente upserts atómicos.')
 const mutations=changes.map(change=>{
  if(text(change.payload?.id)!==text(change.recordId))throw new Error('La identidad del payload de inventario no coincide con su mutación.')
  if(ownerOf(change.payload)!==owner||ownersOf(change.payload).some(candidate=>candidate!==owner))throw new Error('La transacción contiene un registro de otra empresa.')
  return Object.freeze({collection:change.collection,recordId:change.recordId,operation:'upsert',baseVersion:version(change.previousPayload?._syncVersion),payload:{...change.payload,_organizationId:owner}})
 })
 const lots=mutations.filter(item=>item.collection==='inventoryLots'),movements=mutations.filter(item=>item.collection==='inventoryMovements')
 if(lots.length!==1||movements.length<1||movements.length>2)throw new Error('La transacción manual requiere exactamente un lote y uno o dos movimientos.')
 if(!movements.some(item=>item.recordId===targetMovementId))throw new Error('La transacción no contiene el movimiento solicitado.')
 if(movements.some(item=>item.baseVersion!==0))throw new Error('Un movimiento nuevo debe iniciar en versión cero.')
 const lot=lots[0].payload,ordered=movements.map(item=>item.payload).sort((a,b)=>Number(a.ledgerSequence)-Number(b.ledgerSequence))
 validateChain(ordered,lot,owner)
 return Object.freeze({commandId:command,signature:commandSignature,organizationId:owner,lotId:text(lot.id),movementId:targetMovementId,mutations:Object.freeze(mutations)})
}

function normalizeConfirmation(result,transaction){
 const row=Array.isArray(result)?result[0]:result
 if(row?.status!=='applied')throw new Error('La transacción remota de inventario no fue aplicada.')
 const records=list(row.records),expected=new Set(transaction.mutations.map(item=>`${item.collection}\u0000${item.recordId}`)),seen=new Set()
 if(records.length!==expected.size)throw new Error('La confirmación remota de inventario no devolvió el conjunto canónico completo.')
 for(const record of records){
  const identity=`${text(record?.collection)}\u0000${text(record?.recordId)}`
  if(text(record?.companyId)!==transaction.organizationId)throw new Error('La confirmación remota contiene registros de otra empresa.')
  if(!expected.has(identity)||seen.has(identity))throw new Error('La confirmación remota contiene una identidad inesperada o duplicada.')
  if(!Number.isSafeInteger(Number(record?.version))||Number(record.version)<1||Number.isNaN(Date.parse(record?.updatedAt)))throw new Error('La confirmación remota contiene metadata de sync inválida.')
  seen.add(identity)
 }
 return Object.freeze({remote:true,duplicate:Boolean(row.duplicate),records:Object.freeze(records)})
}

export async function commitInventoryMovementTransaction(transaction,{request=authenticatedRequest}={}){
 if(!transaction?.commandId||!transaction?.organizationId||!transaction?.lotId||!Array.isArray(transaction?.mutations))throw new Error('Transacción remota de movimiento inválida.')
 const result=await request('/rest/v1/rpc/commit_inventory_movement',{
  method:'POST',body:{p_command_id:transaction.commandId,p_organization_id:transaction.organizationId,p_signature:transaction.signature,p_lot_id:transaction.lotId,p_movement_id:transaction.movementId,p_mutations:transaction.mutations}
 })
 return normalizeConfirmation(result,transaction)
}

export function applyInventoryMovementConfirmation(state,confirmation,organizationId){
 if(!confirmation?.remote)throw new Error('La confirmación remota de inventario es obligatoria.')
 return applyRemoteRecords(state,confirmation.records,{companyId:organizationId})
}
