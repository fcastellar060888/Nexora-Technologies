import{applyRemoteRecords,collectionChanges}from'./syncEngine.js'
import{authenticatedRequest}from'./supabase.js'

export const MIRFE_INVENTORY_TRANSACTION_COLLECTIONS=Object.freeze(['inventoryLots','inventoryMovements','tankPreparations','costEntries','workOrders'])

const list=value=>Array.isArray(value)?value:[]
const text=value=>String(value??'').trim()
const ownerOf=record=>text(record?.organizationId||record?.companyId||record?._organizationId)
const ownersOf=record=>[record?.organizationId,record?.companyId,record?._organizationId].map(text).filter(Boolean)
const number=(value,label)=>{const parsed=Number(value);if(!Number.isFinite(parsed))throw new Error(`${label} debe ser un número finito.`);return parsed}
const version=value=>{const parsed=Number(value||0);if(!Number.isSafeInteger(parsed)||parsed<0)throw new Error('La versión de sync MIRFE no es válida.');return parsed}

function tenantRecord(records,id,organizationId,label){
 const matches=list(records).filter(record=>text(record?.id)===text(id)&&ownerOf(record)===organizationId)
 if(matches.length!==1)throw new Error(`${label} no existe de forma inequívoca en la empresa activa.`)
 return matches[0]
}

function validateMovementChain(movements,lot,preparationId){
 let expectedBefore=null
 for(const movement of movements){
  if(movement.type!=='Consumo'||movement.sourceType!=='MirfePreparation'||movement.sourceId!==preparationId)throw new Error('La transacción MIRFE contiene un movimiento de inventario no autorizado.')
  const quantity=number(movement.quantity,'quantity'),signed=number(movement.signedQuantity,'signedQuantity'),before=number(movement.balanceBefore,'balanceBefore'),after=number(movement.balanceAfter,'balanceAfter')
  if(quantity<=0||signed!==-quantity||after!==before+signed||after<0)throw new Error('La cadena de saldos MIRFE no es consistente.')
  if(expectedBefore!==null&&before!==expectedBefore)throw new Error('Los movimientos del lote no forman una cadena de saldos continua.')
  expectedBefore=after
 }
 if(expectedBefore===null||number(lot.quantity,'quantity del lote')!==expectedBefore)throw new Error('El saldo final del lote no coincide con sus movimientos MIRFE.')
}

export function buildMirfeInventoryTransaction(before,after,{commandId,signature,organizationId,preparationId}={}){
 const owner=text(organizationId),command=text(commandId),commandSignature=text(signature),preparation=text(preparationId)
 if(!owner||!command||!commandSignature||!preparation)throw new Error('La transacción MIRFE requiere empresa, comando, firma y preparación.')
 const changes=collectionChanges(before,after,MIRFE_INVENTORY_TRANSACTION_COLLECTIONS)
 if(!changes.length||changes.some(change=>change.operation!=='upsert'))throw new Error('La ejecución MIRFE debe producir únicamente upserts atómicos.')
 const identities=new Set()
 const mutations=changes.map(change=>{
  const payload=change.payload
  const identity=`${change.collection}\u0000${change.recordId}`
  if(identities.has(identity))throw new Error('La transacción MIRFE contiene una identidad duplicada.')
  identities.add(identity)
  if(text(payload?.id)!==text(change.recordId))throw new Error('La identidad del payload MIRFE no coincide con su mutación.')
  if(ownerOf(payload)!==owner||ownersOf(payload).some(candidate=>candidate!==owner))throw new Error('La transacción MIRFE contiene un registro de otra empresa.')
  return Object.freeze({collection:change.collection,recordId:change.recordId,operation:'upsert',baseVersion:version(change.previousPayload?._syncVersion),payload:{...payload,_organizationId:owner}})
 })
 const preparationMutation=mutations.filter(item=>item.collection==='tankPreparations'&&item.recordId===preparation)
 if(preparationMutation.length!==1||preparationMutation[0].payload.status!=='Preparada')throw new Error('La transacción MIRFE requiere exactamente una preparación ejecutada.')
 const preparationSite=text(preparationMutation[0].payload.siteId)
 if(!preparationSite||mutations.some(item=>text(item.payload.siteId)!==preparationSite))throw new Error('Todas las consecuencias MIRFE deben pertenecer a la sede de la preparación.')
 const commandReceipts=list(preparationMutation[0].payload.commandReceipts).filter(item=>item.commandId===command)
 if(commandReceipts.length!==1||commandReceipts[0].signature!==commandSignature)throw new Error('La preparación no conserva un único recibo del comando atómico.')
 const lotMutations=mutations.filter(item=>item.collection==='inventoryLots')
 const movementMutations=mutations.filter(item=>item.collection==='inventoryMovements')
 if(!lotMutations.length||!movementMutations.length)throw new Error('La transacción MIRFE requiere lote y movimiento de inventario.')
 if(mutations.filter(item=>item.collection==='workOrders').length!==1)throw new Error('La transacción MIRFE requiere exactamente una orden de trabajo.')
 if(mutations.filter(item=>item.collection==='costEntries').length>1)throw new Error('La transacción MIRFE no puede crear más de un costo.')
 const workOrder=mutations.find(item=>item.collection==='workOrders')?.payload
 if(workOrder?.sourceType!=='MirfePreparation'||workOrder?.sourceId!==preparation||workOrder?.preparationId!==preparation)throw new Error('La orden de trabajo no pertenece a la preparación MIRFE.')
 const cost=mutations.find(item=>item.collection==='costEntries')?.payload
 if(cost&&(cost.sourceType!=='MirfePreparation'||cost.sourceId!==preparation||number(cost.amount,'amount del costo')<=0))throw new Error('El costo no pertenece a la preparación MIRFE.')
 for(const lotMutation of lotMutations){
  const movements=movementMutations.map(item=>item.payload).filter(item=>item.lotId===lotMutation.recordId)
  if(!movements.length)throw new Error('Cada lote modificado requiere al menos un movimiento MIRFE.')
  validateMovementChain(movements,lotMutation.payload,preparation)
 }
 for(const movement of movementMutations.map(item=>item.payload)){
  const lot=tenantRecord(after.inventoryLots,movement.lotId,owner,'El lote del movimiento')
  if(lot.productId!==movement.productId||lot.siteId!==movement.siteId)throw new Error('El movimiento no coincide con producto y sede del lote.')
 }
 return Object.freeze({commandId:command,signature:commandSignature,organizationId:owner,preparationId:preparation,mutations:Object.freeze(mutations)})
}

function normalizeConfirmation(result,transaction){
 const row=Array.isArray(result)?result[0]:result
 if(row?.status!=='applied')throw new Error('La transacción remota MIRFE no fue aplicada.')
 const records=list(row.records)
 const expected=new Set(transaction.mutations.map(item=>`${item.collection}\u0000${item.recordId}`)),seen=new Set()
 if(records.length!==expected.size)throw new Error('La transacción remota MIRFE no devolvió el conjunto canónico completo.')
 for(const record of records){
  const identity=`${text(record?.collection)}\u0000${text(record?.recordId)}`
  if(text(record?.companyId)!==transaction.organizationId)throw new Error('La confirmación MIRFE contiene registros de otra empresa.')
  if(!expected.has(identity)||seen.has(identity))throw new Error('La confirmación MIRFE contiene una identidad inesperada o duplicada.')
  if(!Number.isSafeInteger(Number(record?.version))||Number(record.version)<1||Number.isNaN(Date.parse(record?.updatedAt)))throw new Error('La confirmación MIRFE contiene metadata de sync inválida.')
  seen.add(identity)
 }
 return Object.freeze({remote:true,duplicate:Boolean(row.duplicate),records:Object.freeze(records)})
}

export async function commitMirfeInventoryTransaction(transaction,{request=authenticatedRequest}={}){
 if(!transaction?.commandId||!transaction?.organizationId||!Array.isArray(transaction?.mutations))throw new Error('Transacción MIRFE inválida.')
 const result=await request('/rest/v1/rpc/commit_mirfe_inventory_execution',{
  method:'POST',
  body:{
   p_command_id:transaction.commandId,
   p_organization_id:transaction.organizationId,
   p_signature:transaction.signature,
   p_preparation_id:transaction.preparationId,
   p_mutations:transaction.mutations
  }
 })
 return normalizeConfirmation(result,transaction)
}

export function applyMirfeInventoryConfirmation(state,confirmation,organizationId){
 if(!confirmation?.remote)throw new Error('La confirmación remota MIRFE es obligatoria.')
 return applyRemoteRecords(state,confirmation.records,{companyId:organizationId})
}
