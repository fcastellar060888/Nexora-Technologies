import{activeOrganizationId,explicitOrganizationId,resolveOrganizationId}from'./organizationOwnership.js'
import{assertInventoryLotMatchesLedger,inventoryLedgerForLot}from'./inventoryLedger.js'
import{assertInventoryLotProductCausality,inventoryLotUnitFromProduct}from'./inventoryProductCausality.js'
import{inventoryMovementSnapshot}from'./inventoryMovementCausality.js'
import{assertInventoryLotMovementAllowed}from'./inventoryLotRestrictions.js'

const POSITIVE_TYPES=new Set(['Entrada','Ajuste positivo','Saldo inicial','Devolución'])
const NEGATIVE_TYPES=new Set(['Salida','Ajuste negativo','Consumo','Baja','Vencimiento'])
const list=value=>Array.isArray(value)?value:[]
const text=value=>String(value??'').trim()
function asPositiveNumber(value,label='La cantidad'){const number=Number(value);if(!Number.isFinite(number)||number<=0)throw new Error(`${label} debe ser mayor que cero.`);return number}
function ownerOf(state,record,label){return resolveOrganizationId(state,{record,siteId:record?.siteId,label})}
function tenantRecord(state,collection,id,organizationId,label){const matches=list(state?.[collection]).filter(item=>text(item?.id)===text(id)&&ownerOf(state,item,label)===organizationId);if(matches.length>1)throw new Error(`${label} tiene identidad duplicada dentro de la empresa activa.`);if(!matches.length)throw new Error(`${label} no existe en la empresa activa.`);return matches[0]}
function assertSite(state,siteId,organizationId){const matches=list(state?.sites).filter(item=>text(item?.id)===text(siteId)&&ownerOf(state,item,'la sede de inventario')===organizationId);if(matches.length!==1)throw new Error(matches.length?'La sede de inventario es ambigua dentro de la empresa activa.':'La sede de inventario no pertenece a la empresa activa.');return matches[0]}
function validIso(value){const time=Date.parse(value||'');return Number.isFinite(time)?new Date(time).toISOString():null}
function openingTimestamp(lot,movementCreatedAt){const movement=Date.parse(movementCreatedAt||''),lotCreated=Date.parse(lot?.createdAt||'');if(Number.isFinite(lotCreated)&&(!Number.isFinite(movement)||lotCreated<movement))return new Date(lotCreated).toISOString();if(Number.isFinite(movement))return new Date(Math.max(0,movement-1)).toISOString();return validIso(lot?.createdAt)||'1970-01-01T00:00:00.000Z'}
function bootstrapLegacyLedger(state,lot,product,movementCreatedAt){
 const organizationId=text(lot?.organizationId),rows=inventoryLedgerForLot(state,{organizationId,lotId:lot?.id});if(rows.length)return state
 const openingBalance=Number(lot?.quantity||0);if(!Number.isFinite(openingBalance)||openingBalance<0)throw new Error('El saldo legacy del lote no es válido para materializar el kardex.');if(openingBalance===0)return state
 const createdAt=openingTimestamp(lot,movementCreatedAt),snapshot=inventoryMovementSnapshot(product,lot,{sourceType:'LegacyInventoryBootstrap',sourceId:lot.id}),movement={id:`inventory-opening:${organizationId}:${lot.id}`,organizationId,lotId:lot.id,productId:lot.productId,siteId:lot.siteId,type:'Saldo inicial',quantity:openingBalance,signedQuantity:openingBalance,balanceBefore:0,balanceAfter:openingBalance,ledgerSequence:1,previousMovementId:'',date:createdAt.slice(0,10),createdAt,...snapshot,supplier:'',reference:text(lot.lotNumber),responsible:'system',notes:'Materialización determinista de saldo legacy previo al kardex append-only'}
 const next={...state,inventoryMovements:[...list(state.inventoryMovements),movement]};assertInventoryLotMatchesLedger(next,lot);return next
}
function movementProductAuthority(state,input,product,organizationId){
 if(text(input?.sourceType)!=='MipeTreatment')return product
 const sourceId=text(input?.sourceId);if(!sourceId)return product
 const treatment=tenantRecord(state,'treatments',sourceId,organizationId,'El tratamiento MIPE del movimiento')
 if(text(treatment?.productId)!==text(product?.id))throw new Error('El Treatment MIPE contradice el Product causal del movimiento.')
 const snapshot=treatment?.productSnapshot
 if(!snapshot?.id)return product
 if(text(snapshot.id)!==text(product.id))throw new Error('El snapshot técnico MIPE contradice el Product causal del movimiento.')
 const snapshotOwner=explicitOrganizationId(snapshot);if(snapshotOwner&&snapshotOwner!==organizationId)throw new Error('El snapshot técnico MIPE pertenece a otra empresa.')
 return snapshot
}
export function movementSign(type){if(POSITIVE_TYPES.has(type))return 1;if(NEGATIVE_TYPES.has(type))return-1;throw new Error(`Tipo de movimiento no soportado: ${type}`)}
export function transactInventory(state,input){
 const organizationId=activeOrganizationId(state),lot=tenantRecord(state,'inventoryLots',input.lotId,organizationId,'El lote de inventario'),lotOwner=ownerOf(state,lot,'el lote de inventario');if(lotOwner!==organizationId)throw new Error('El lote de inventario pertenece a otra empresa.')
 const product=tenantRecord(state,'products',lot.productId,organizationId,'El producto de inventario');assertSite(state,lot.siteId,organizationId);if(explicitOrganizationId(product)&&ownerOf(state,product,'el producto de inventario')!==organizationId)throw new Error('El producto de inventario pertenece a otra empresa.');if(text(lot.unit))assertInventoryLotProductCausality(product,lot)
 const createdAt=input.createdAt||new Date().toISOString(),movementDate=input.date||createdAt.slice(0,10);assertInventoryLotMovementAllowed(lot,{type:input.type,date:movementDate});const working=bootstrapLegacyLedger(state,lot,product,createdAt),ledger=assertInventoryLotMatchesLedger(working,lot),quantity=asPositiveNumber(input.quantity),signedQuantity=movementSign(input.type)*quantity,currentBalance=ledger.balance,balanceAfter=currentBalance+signedQuantity;if(balanceAfter<0)throw new Error('El movimiento supera la existencia disponible.')
 const movementProduct=movementProductAuthority(state,input,product,organizationId),snapshot=inventoryMovementSnapshot(movementProduct,lot,{sourceType:input.sourceType||'Manual',sourceId:input.sourceId||''}),movement={id:input.id||crypto.randomUUID(),organizationId,lotId:lot.id,productId:lot.productId,siteId:lot.siteId,type:input.type,quantity,signedQuantity,balanceBefore:currentBalance,balanceAfter,ledgerSequence:ledger.movementCount+1,previousMovementId:ledger.lastMovementId,date:movementDate,createdAt,...snapshot,supplier:input.supplier||'',reference:input.reference||'',responsible:input.responsible||'',notes:input.notes||''}
 const updatedLot={...lot,organizationId,quantity:balanceAfter,updatedAt:movement.createdAt},next={...working,inventoryLots:list(working.inventoryLots).map(item=>item===lot?updatedLot:item),inventoryMovements:[...list(working.inventoryMovements),movement]};assertInventoryLotMatchesLedger(next,updatedLot);return next
}
export function createInventoryLot(state,input){
 const organizationId=activeOrganizationId(state);if(!input.productId)throw new Error('Selecciona un producto.');if(!input.siteId)throw new Error('Selecciona una sede.')
 const product=tenantRecord(state,'products',input.productId,organizationId,'El producto de inventario');assertSite(state,input.siteId,organizationId);if(input.organizationId&&text(input.organizationId)!==organizationId)throw new Error('El lote de inventario no puede crearse para otra empresa.')
 const unit=inventoryLotUnitFromProduct(product,input.unit),lotNumber=text(input.lotNumber);if(!lotNumber)throw new Error('El número de lote es obligatorio.');if(list(state.inventoryLots).some(l=>ownerOf(state,l,'el lote de inventario')===organizationId&&l.productId===product.id&&l.siteId===input.siteId&&text(l.lotNumber).toLowerCase()===lotNumber.toLowerCase()))throw new Error('Ya existe ese lote para el producto y la sede seleccionados.')
 const openingQuantity=Number(input.quantity||0);if(!Number.isFinite(openingQuantity)||openingQuantity<0)throw new Error('La cantidad inicial no puede ser negativa.');const minimum=Number(input.minimum||0);if(!Number.isFinite(minimum)||minimum<0)throw new Error('El stock mínimo no puede ser negativo.')
 const createdAt=input.createdAt||new Date().toISOString(),lot={id:input.id||crypto.randomUUID(),organizationId,productId:product.id,siteId:input.siteId,unit,quantity:0,lotNumber,expiryDate:input.expiryDate||'',minimum,createdAt,updatedAt:createdAt};let next={...state,inventoryLots:[...list(state.inventoryLots),lot]};if(openingQuantity>0)next=transactInventory(next,{lotId:lot.id,type:'Saldo inicial',quantity:openingQuantity,date:input.date||createdAt.slice(0,10),createdAt,sourceType:'InventoryLot',sourceId:lot.id,reference:lotNumber,responsible:input.responsible,notes:'Registro de existencia inicial'});return next
}