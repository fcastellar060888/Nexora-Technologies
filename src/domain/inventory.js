import{activeOrganizationId,explicitOrganizationId,resolveOrganizationId}from'./organizationOwnership.js'

const POSITIVE_TYPES=new Set(['Entrada','Ajuste positivo','Saldo inicial','Devolución'])
const NEGATIVE_TYPES=new Set(['Salida','Ajuste negativo','Consumo','Baja','Vencimiento'])
const list=value=>Array.isArray(value)?value:[]
const text=value=>String(value??'').trim()

function asPositiveNumber(value,label='La cantidad'){
 const number=Number(value)
 if(!Number.isFinite(number)||number<=0)throw new Error(`${label} debe ser mayor que cero.`)
 return number
}
function ownerOf(state,record,label){return resolveOrganizationId(state,{record,siteId:record?.siteId,label})}
function tenantRecord(state,collection,id,organizationId,label){
 const matches=list(state?.[collection]).filter(item=>text(item?.id)===text(id)&&ownerOf(state,item,label)===organizationId)
 if(matches.length>1)throw new Error(`${label} tiene identidad duplicada dentro de la empresa activa.`)
 if(!matches.length)throw new Error(`${label} no existe en la empresa activa.`)
 return matches[0]
}
function assertSite(state,siteId,organizationId){
 const matches=list(state?.sites).filter(item=>text(item?.id)===text(siteId)&&ownerOf(state,item,'la sede de inventario')===organizationId)
 if(matches.length!==1)throw new Error(matches.length?'La sede de inventario es ambigua dentro de la empresa activa.':'La sede de inventario no pertenece a la empresa activa.')
 return matches[0]
}

export function movementSign(type){
 if(POSITIVE_TYPES.has(type))return 1
 if(NEGATIVE_TYPES.has(type))return-1
 throw new Error(`Tipo de movimiento no soportado: ${type}`)
}

export function transactInventory(state,input){
 const organizationId=activeOrganizationId(state)
 const lot=tenantRecord(state,'inventoryLots',input.lotId,organizationId,'El lote de inventario')
 const lotOwner=ownerOf(state,lot,'el lote de inventario')
 if(lotOwner!==organizationId)throw new Error('El lote de inventario pertenece a otra empresa.')
 const product=tenantRecord(state,'products',lot.productId,organizationId,'El producto de inventario')
 assertSite(state,lot.siteId,organizationId)
 if(explicitOrganizationId(product)&&ownerOf(state,product,'el producto de inventario')!==organizationId)throw new Error('El producto de inventario pertenece a otra empresa.')

 const quantity=asPositiveNumber(input.quantity)
 const signedQuantity=movementSign(input.type)*quantity
 const currentBalance=Number(lot.quantity||0)
 const balanceAfter=currentBalance+signedQuantity
 if(balanceAfter<0)throw new Error('El movimiento supera la existencia disponible.')

 const movement={
  id:input.id||crypto.randomUUID(),organizationId,
  lotId:lot.id,productId:lot.productId,siteId:lot.siteId,
  type:input.type,quantity,signedQuantity,balanceBefore:currentBalance,balanceAfter,
  date:input.date||new Date().toISOString().slice(0,10),createdAt:input.createdAt||new Date().toISOString(),
  sourceType:input.sourceType||'Manual',sourceId:input.sourceId||'',supplier:input.supplier||'',reference:input.reference||'',responsible:input.responsible||'',notes:input.notes||''
 }

 return{
  ...state,
  inventoryLots:list(state.inventoryLots).map(item=>item===lot?{...item,organizationId,quantity:balanceAfter,updatedAt:movement.createdAt}:item),
  inventoryMovements:[...list(state.inventoryMovements),movement]
 }
}

export function createInventoryLot(state,input){
 const organizationId=activeOrganizationId(state)
 if(!input.productId)throw new Error('Selecciona un producto.')
 if(!input.siteId)throw new Error('Selecciona una sede.')
 const product=tenantRecord(state,'products',input.productId,organizationId,'El producto de inventario')
 assertSite(state,input.siteId,organizationId)
 if(input.organizationId&&text(input.organizationId)!==organizationId)throw new Error('El lote de inventario no puede crearse para otra empresa.')
 const lotNumber=text(input.lotNumber)
 if(!lotNumber)throw new Error('El número de lote es obligatorio.')
 if(list(state.inventoryLots).some(l=>ownerOf(state,l,'el lote de inventario')===organizationId&&l.productId===product.id&&l.siteId===input.siteId&&text(l.lotNumber).toLowerCase()===lotNumber.toLowerCase()))throw new Error('Ya existe ese lote para el producto y la sede seleccionados.')

 const openingQuantity=Number(input.quantity||0)
 if(!Number.isFinite(openingQuantity)||openingQuantity<0)throw new Error('La cantidad inicial no puede ser negativa.')
 const minimum=Number(input.minimum||0)
 if(!Number.isFinite(minimum)||minimum<0)throw new Error('El stock mínimo no puede ser negativo.')

 const createdAt=input.createdAt||new Date().toISOString()
 const lot={id:input.id||crypto.randomUUID(),organizationId,productId:product.id,siteId:input.siteId,quantity:0,lotNumber,expiryDate:input.expiryDate||'',minimum,createdAt,updatedAt:createdAt}
 let next={...state,inventoryLots:[...list(state.inventoryLots),lot]}
 if(openingQuantity>0)next=transactInventory(next,{lotId:lot.id,type:'Saldo inicial',quantity:openingQuantity,date:input.date,createdAt,sourceType:'InventoryLot',sourceId:lot.id,reference:lotNumber,responsible:input.responsible,notes:'Registro de existencia inicial'})
 return next
}
