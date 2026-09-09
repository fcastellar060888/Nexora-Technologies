import{applyRemoteRecords,collectionChanges}from'./syncEngine.js'
import{authenticatedRequest}from'./supabase.js'

export const MIPE_TREATMENT_TRANSACTION_COLLECTIONS=Object.freeze(['inventoryLots','inventoryMovements','treatments','findings','costEntries'])

const list=value=>Array.isArray(value)?value:[]
const text=value=>String(value??'').trim()
const ownerOf=record=>text(record?.organizationId||record?.companyId||record?._organizationId)
const ownersOf=record=>[record?.organizationId,record?.companyId,record?._organizationId].map(text).filter(Boolean)
const number=(value,label)=>{const parsed=Number(value);if(!Number.isFinite(parsed))throw new Error(`${label} debe ser un número finito.`);return parsed}
const version=value=>{const parsed=Number(value||0);if(!Number.isSafeInteger(parsed)||parsed<0)throw new Error('La versión de sync MIPE no es válida.');return parsed}

function single(items,label){if(items.length!==1)throw new Error(`La transacción MIPE requiere exactamente un ${label}.`);return items[0]}
function mutationMap(mutations,collection){return mutations.filter(item=>item.collection===collection)}

function validateLegacyBootstrap(mutation,lotMutation,owner,site){
 const movement=mutation?.payload,lot=lotMutation.payload,quantity=number(movement?.quantity,'quantity del bootstrap'),signed=number(movement?.signedQuantity,'signedQuantity del bootstrap'),before=number(movement?.balanceBefore,'balanceBefore del bootstrap'),after=number(movement?.balanceAfter,'balanceAfter del bootstrap'),sequence=Number(movement?.ledgerSequence)
 if(mutation.baseVersion!==0)throw new Error('El bootstrap legacy MIPE debe iniciar en versión cero.')
 if(movement?.id!==`inventory-opening:${owner}:${lotMutation.recordId}`||movement?.type!=='Saldo inicial'||movement?.sourceType!=='LegacyInventoryBootstrap'||text(movement?.sourceId)!==lotMutation.recordId)throw new Error('La evidencia inicial legacy MIPE no es canónica.')
 if(text(movement?.lotId)!==lotMutation.recordId||text(movement?.productId)!==text(lot.productId)||text(movement?.siteId)!==site)throw new Error('El bootstrap legacy MIPE no coincide con lote, producto y sede.')
 if(quantity<=0||signed!==quantity||before!==0||after!==quantity||sequence!==1||text(movement?.previousMovementId))throw new Error('La cadena inicial legacy MIPE no es consistente.')
 return movement
}

export function buildMipeTreatmentTransaction(before,after,{commandId,signature,organizationId,treatmentId,siteId}={}){
 const command=text(commandId),owner=text(organizationId),commandSignature=text(signature),treatment=text(treatmentId),site=text(siteId)
 if(!command||!owner||!commandSignature||!treatment||!site)throw new Error('La transacción MIPE requiere comando, empresa, firma, tratamiento y sede.')
 const changes=collectionChanges(before,after,MIPE_TREATMENT_TRANSACTION_COLLECTIONS)
 if(!changes.length||changes.some(change=>change.operation!=='upsert'))throw new Error('La ejecución MIPE debe producir únicamente upserts atómicos.')
 const identities=new Set()
 const mutations=changes.map(change=>{
  const payload=change.payload,identity=`${change.collection}\u0000${change.recordId}`
  if(identities.has(identity))throw new Error('La transacción MIPE contiene una identidad duplicada.')
  identities.add(identity)
  if(text(payload?.id)!==text(change.recordId))throw new Error('La identidad del payload MIPE no coincide con su mutación.')
  if(ownerOf(payload)!==owner||ownersOf(payload).some(candidate=>candidate!==owner))throw new Error('La transacción MIPE contiene un registro de otra empresa.')
  const payloadSite=text(payload?.siteId)
  if(payloadSite&&payloadSite!==site)throw new Error('La transacción MIPE contiene una consecuencia de otra sede.')
  return Object.freeze({collection:change.collection,recordId:change.recordId,operation:'upsert',baseVersion:version(change.previousPayload?._syncVersion),payload:{...payload,siteId:payloadSite||site,_organizationId:owner}})
 })
 const lotMutation=single(mutationMap(mutations,'inventoryLots'),'lote de inventario')
 const movementMutations=mutationMap(mutations,'inventoryMovements')
 const treatmentMutation=single(mutationMap(mutations,'treatments'),'tratamiento ejecutado')
 const findingMutation=single(mutationMap(mutations,'findings'),'hallazgo en seguimiento')
 const costMutation=single(mutationMap(mutations,'costEntries'),'costo de tratamiento')
 if(movementMutations.length<1||movementMutations.length>2)throw new Error('La transacción MIPE requiere uno o dos movimientos de inventario.')
 if(mutations.length!==4+movementMutations.length)throw new Error('La transacción MIPE contiene consecuencias fuera de la unidad atómica esperada.')
 const operationalMutations=movementMutations.filter(item=>item.payload?.sourceType==='MipeTreatment'&&text(item.payload?.sourceId)===treatment)
 const bootstrapMutations=movementMutations.filter(item=>item.payload?.sourceType==='LegacyInventoryBootstrap')
 if(operationalMutations.length!==1||bootstrapMutations.length>1||operationalMutations.length+bootstrapMutations.length!==movementMutations.length)throw new Error('La transacción MIPE contiene una cadena de movimientos no autorizada.')
 if(treatmentMutation.recordId!==treatment||treatmentMutation.payload.status!=='Ejecutado')throw new Error('La transacción MIPE requiere exactamente el tratamiento ejecutado.')
 if(findingMutation.payload.id!==treatmentMutation.payload.findingId||findingMutation.payload.status!=='Seguimiento')throw new Error('El hallazgo MIPE no coincide con el tratamiento ejecutado.')
 if(text(treatmentMutation.payload.siteId)!==site||text(findingMutation.payload.siteId)!==site)throw new Error('Tratamiento y hallazgo deben pertenecer a la sede de ejecución.')
 const quantity=number(treatmentMutation.payload.totalQuantity,'totalQuantity del tratamiento')
 if(quantity<=0)throw new Error('La cantidad ejecutada del tratamiento debe ser positiva.')
 const movementMutation=operationalMutations[0],movement=movementMutation.payload,lot=lotMutation.payload,cost=costMutation.payload
 if(movement.type!=='Consumo'||movement.sourceType!=='MipeTreatment'||movement.sourceId!==treatment)throw new Error('El movimiento no pertenece al tratamiento MIPE.')
 if(text(movement.lotId)!==lotMutation.recordId||text(treatmentMutation.payload.lotId)!==lotMutation.recordId||text(cost.inventoryLotId)!==lotMutation.recordId)throw new Error('Lote, movimiento, tratamiento y costo MIPE no comparten la misma identidad física.')
 if(text(movement.productId)!==text(treatmentMutation.payload.productId)||text(cost.productId)!==text(treatmentMutation.payload.productId)||text(lot.productId)!==text(treatmentMutation.payload.productId))throw new Error('Producto, lote, movimiento, tratamiento y costo MIPE no coinciden.')
 const movementQuantity=number(movement.quantity,'quantity del movimiento'),signed=number(movement.signedQuantity,'signedQuantity'),beforeBalance=number(movement.balanceBefore,'balanceBefore'),afterBalance=number(movement.balanceAfter,'balanceAfter')
 if(movementQuantity!==quantity||signed!==-movementQuantity||afterBalance!==beforeBalance+signed||afterBalance<0||number(lot.quantity,'quantity del lote')!==afterBalance)throw new Error('La cadena de saldo MIPE no es consistente.')
 if(bootstrapMutations.length){
  const bootstrap=validateLegacyBootstrap(bootstrapMutations[0],lotMutation,owner,site)
  if(Number(movement.ledgerSequence)!==Number(bootstrap.ledgerSequence)+1||text(movement.previousMovementId)!==text(bootstrap.id)||beforeBalance!==number(bootstrap.balanceAfter,'balanceAfter del bootstrap'))throw new Error('El consumo MIPE no continúa la evidencia inicial legacy.')
 }
 if(text(cost.treatmentId)!==treatment||text(cost.findingId)!==text(findingMutation.recordId)||number(cost.quantity,'quantity del costo')!==quantity||number(cost.amount,'amount del costo')<0)throw new Error('El costo no pertenece a la ejecución MIPE.')
 if(movementMutations.some(item=>item.baseVersion!==0)||costMutation.baseVersion!==0)throw new Error('Movimientos y costo nuevos deben iniciar en versión cero.')
 return Object.freeze({commandId:command,signature:commandSignature,organizationId:owner,treatmentId:treatment,siteId:site,mutations:Object.freeze(mutations)})
}

function normalizeConfirmation(result,transaction){
 const row=Array.isArray(result)?result[0]:result
 if(row?.status!=='applied')throw new Error('La transacción remota MIPE no fue aplicada.')
 const records=list(row.records),expected=new Set(transaction.mutations.map(item=>`${item.collection}\u0000${item.recordId}`)),seen=new Set()
 if(records.length!==expected.size)throw new Error('La transacción remota MIPE no devolvió el conjunto canónico completo.')
 for(const record of records){
  const identity=`${text(record?.collection)}\u0000${text(record?.recordId)}`
  if(text(record?.companyId)!==transaction.organizationId)throw new Error('La confirmación MIPE contiene registros de otra empresa.')
  if(!expected.has(identity)||seen.has(identity))throw new Error('La confirmación MIPE contiene una identidad inesperada o duplicada.')
  if(!Number.isSafeInteger(Number(record?.version))||Number(record.version)<1||Number.isNaN(Date.parse(record?.updatedAt)))throw new Error('La confirmación MIPE contiene metadata de sync inválida.')
  seen.add(identity)
 }
 return Object.freeze({remote:true,duplicate:Boolean(row.duplicate),records:Object.freeze(records)})
}

export async function commitMipeTreatmentTransaction(transaction,{request=authenticatedRequest}={}){
 if(!transaction?.commandId||!transaction?.organizationId||!transaction?.treatmentId||!transaction?.siteId||!Array.isArray(transaction?.mutations))throw new Error('Transacción MIPE inválida.')
 const result=await request('/rest/v1/rpc/commit_mipe_treatment_execution',{
  method:'POST',
  body:{p_command_id:transaction.commandId,p_organization_id:transaction.organizationId,p_signature:transaction.signature,p_treatment_id:transaction.treatmentId,p_site_id:transaction.siteId,p_mutations:transaction.mutations}
 })
 return normalizeConfirmation(result,transaction)
}

export function applyMipeTreatmentConfirmation(state,confirmation,organizationId){
 if(!confirmation?.remote)throw new Error('La confirmación remota MIPE es obligatoria.')
 return applyRemoteRecords(state,confirmation.records,{companyId:organizationId})
}
