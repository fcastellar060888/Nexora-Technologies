import{DomainEvents}from'../core/events/eventCatalog.js'
import{createInventoryLot,transactInventory}from'../domain/inventory.js'
import{activeOrganizationId}from'../domain/organizationOwnership.js'
import{hasPermission}from'./permissions.js'
import{executeCoreOperationCommand}from'./coreOperationCommand.js'
import{applyInventoryMovementConfirmation,buildInventoryMovementTransaction,commitInventoryMovementTransaction}from'./inventoryMovementTransaction.js'

export const INVENTORY_OPERATIONS=Object.freeze({CREATE_PRODUCT:'CREATE_PRODUCT',CREATE_LOT:'CREATE_LOT',RECORD_MOVEMENT:'RECORD_MOVEMENT'})
const list=value=>Array.isArray(value)?value:[]
const text=value=>String(value??'').trim()
const object=value=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value)
const canonical=value=>Array.isArray(value)?value.map(canonical):object(value)?Object.fromEntries(Object.keys(value).sort().filter(k=>value[k]!==undefined).map(k=>[k,canonical(value[k])])):value
const stable=value=>JSON.stringify(canonical(value))
export const inventoryCommandRequestKey=({operation,entityId='',input={}}={})=>stable({operation:text(operation),entityId:text(entityId),input:object(input)?input:{}})
export const inventoryCommandSignature=({operation,aggregateId,input={}}={})=>stable({operation:text(operation),aggregateId:text(aggregateId),input:object(input)?input:{}})

function receipts(state){return list(state?.inventoryCommandReceipts).filter(r=>object(r)&&text(r.organizationId)&&text(r.commandId))}
function receipt(state,organizationId,commandId){const matches=receipts(state).filter(r=>r.organizationId===organizationId&&r.commandId===commandId);if(matches.length>1&&new Set(matches.map(r=>r.signature)).size>1)throw new Error('El commandId colisiona con receipts de inventario diferentes.');return matches[0]||null}
function assertReceipt(existing,signature){if(existing&&existing.signature!==signature)throw new Error('El commandId de inventario ya fue usado con contenido diferente.')}
function authorize(state,organizationId,siteId){if(!hasPermission(state,'manage_inventory',{companyId:organizationId,siteId:siteId||undefined}))throw new Error('No tienes permiso manage_inventory para esta operación de inventario.')}
function assertContext(state,organizationId){if(activeOrganizationId(state)!==organizationId)throw new Error('La empresa activa cambió antes de confirmar la operación de inventario.')}
function applyOnce(current,organizationId,newReceipt,mutation){assertContext(current,organizationId);const existing=receipt(current,organizationId,newReceipt.commandId);assertReceipt(existing,newReceipt.signature);if(existing)return current;const next=mutation(current);return{...next,inventoryCommandReceipts:[...receipts(next),newReceipt]}}

function planProduct(state,input,aggregateId,organizationId,occurredAt){const name=text(input.name);if(!name)throw new Error('El nombre comercial es obligatorio.');const record={...input,id:aggregateId,organizationId,name,active:input.active!==false,createdAt:input.createdAt||occurredAt,updatedAt:occurredAt};delete record.commandId;return{siteId:null,eventName:DomainEvents.INVENTORY_PRODUCT_CREATED,aggregateType:'inventory.product',payload:{productId:aggregateId,name,category:text(record.category)},apply:current=>{assertContext(current,organizationId);if(list(current.products).some(p=>p.id===aggregateId&&text(p.organizationId)===organizationId))throw new Error('El producto ya existe en la empresa activa.');return{...current,products:[...list(current.products),record]}}}}
function planLot(state,input,aggregateId,organizationId,occurredAt){const normalized={...input,id:aggregateId,organizationId,createdAt:occurredAt};createInventoryLot(state,normalized);return{siteId:text(input.siteId),eventName:DomainEvents.INVENTORY_LOT_CREATED,aggregateType:'inventory.lot',payload:{lotId:aggregateId,productId:text(input.productId),siteId:text(input.siteId),lotNumber:text(input.lotNumber),openingQuantity:Number(input.quantity||0)},apply:current=>createInventoryLot(current,normalized)}}
function planMovement(state,input,aggregateId,organizationId,occurredAt,{commandId,signature,commitMovement=commitInventoryMovementTransaction}={}){
 const normalized={...input,id:aggregateId,createdAt:input.createdAt||occurredAt,sourceType:'Manual',sourceId:input.sourceId||''},preview=transactInventory(state,normalized)
 const movement=list(preview.inventoryMovements).find(item=>item.id===aggregateId&&text(item.organizationId)===organizationId)
 if(!movement)throw new Error('No fue posible construir el movimiento de inventario solicitado.')
 const transaction=buildInventoryMovementTransaction(state,preview,{commandId,signature,organizationId,movementId:aggregateId})
 return{siteId:text(movement.siteId),eventName:DomainEvents.INVENTORY_MOVEMENT_RECORDED,aggregateType:'inventory.movement',payload:{movementId:aggregateId,lotId:movement.lotId,productId:movement.productId,siteId:movement.siteId,type:movement.type,quantity:movement.quantity,signedQuantity:movement.signedQuantity,balanceBefore:movement.balanceBefore,balanceAfter:movement.balanceAfter,ledgerSequence:movement.ledgerSequence,previousMovementId:movement.previousMovementId},prepareCommit:()=>commitMovement(transaction),apply:(current,confirmation)=>applyInventoryMovementConfirmation(current,confirmation,organizationId)}
}

export async function executeInventoryCommand(state,{operation,entityId='',input={},commandId,occurredAt=new Date().toISOString()}={},deps={}){
 if(!Object.values(INVENTORY_OPERATIONS).includes(operation))throw new Error('Operación de inventario desconocida.')
 const organizationId=activeOrganizationId(state),id=text(commandId);if(!id)throw new Error('commandId es obligatorio.');const aggregateId=text(entityId)||id,normalized=object(input)?input:{},signature=inventoryCommandSignature({operation,aggregateId,input:normalized}),existing=receipt(state,organizationId,id);assertReceipt(existing,signature)
 const planned=operation===INVENTORY_OPERATIONS.CREATE_PRODUCT?planProduct(state,normalized,aggregateId,organizationId,occurredAt):operation===INVENTORY_OPERATIONS.CREATE_LOT?planLot(state,normalized,aggregateId,organizationId,occurredAt):planMovement(state,normalized,aggregateId,organizationId,occurredAt,{commandId:id,signature,commitMovement:deps.commitMovementTransaction||commitInventoryMovementTransaction})
 authorize(state,organizationId,planned.siteId)
 const newReceipt=Object.freeze({commandId:id,organizationId,signature,operation,aggregateId,occurredAt})
 const apply=(current,confirmation)=>{assertContext(current,organizationId);authorize(current,organizationId,planned.siteId);return applyOnce(current,organizationId,newReceipt,stateToMutate=>planned.apply(stateToMutate,confirmation))}
 return executeCoreOperationCommand({commandId:id,organizationId,siteId:planned.siteId,aggregateType:planned.aggregateType,aggregateId,completedEventName:planned.eventName,occurredAt,payload:planned.payload,metadata:{source:'m3.3-inventory-command',operation},prepareCommit:planned.prepareCommit||null,commitMeta:{module:'Inventario',action:operation,detail:aggregateId},apply},deps)
}
