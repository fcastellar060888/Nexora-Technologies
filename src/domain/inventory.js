import{activeOrganizationId,explicitOrganizationId}from'./organizationOwnership.js'

const POSITIVE_TYPES=new Set(['Entrada','Ajuste positivo','Saldo inicial','Devolución'])
const NEGATIVE_TYPES=new Set(['Salida','Ajuste negativo','Consumo','Baja','Vencimiento'])
const list=value=>Array.isArray(value)?value:[]
const text=value=>String(value??'').trim()

function asPositiveNumber(value,label='La cantidad'){
 const number=Number(value)
 if(!Number.isFinite(number)||number<=0)throw new Error(`${label} debe ser mayor que cero.`)
 return number
}

function siteOwners(state,siteId){
 const id=text(siteId)
 if(!id)return[]
 return[...new Set(list(state?.sites).filter(site=>text(site?.id)===id).map(explicitOrganizationId).filter(Boolean))]
}

function inventoryLotOrganizationId(state,lot){
 const explicit=explicitOrganizationId(lot)
 const owners=siteOwners(state,lot?.siteId)
 if(explicit){
  if(owners.length&&!owners.includes(explicit))return''
  return explicit
 }
 if(owners.length===1)return owners[0]
 if(owners.length>1)return''
 const companies=list(state?.companies)
 if(companies.length===1)return text(companies[0]?.id)
 if(companies.length===0)return'local-installation'
 return''
}

function resolveScopedInventoryLot(state,lotId,organizationId){
 const id=text(lotId)
 if(!id)throw new Error('Selecciona un lote de inventario válido.')
 const lots=list(state?.inventoryLots)
 const homonyms=lots.map((lot,index)=>({lot,index})).filter(candidate=>text(candidate.lot?.id)===id)
 if(!homonyms.length)throw new Error('Selecciona un lote de inventario válido.')
 const matches=homonyms.filter(candidate=>inventoryLotOrganizationId(state,candidate.lot)===organizationId)
 if(matches.length>1)throw new Error('El lote de inventario tiene identidad duplicada o ambigua dentro de la empresa activa.')
 if(matches.length===0)throw new Error('El lote de inventario pertenece a otra empresa o no tiene ownership inequívoco.')
 return matches[0]
}

export function movementSign(type){
 if(POSITIVE_TYPES.has(type))return 1
 if(NEGATIVE_TYPES.has(type))return-1
 throw new Error(`Tipo de movimiento no soportado: ${type}`)
}

export function transactInventory(state,input){
 const organizationId=activeOrganizationId(state)
 const requestedOrganizationId=text(input?.organizationId)
 if(requestedOrganizationId&&requestedOrganizationId!==organizationId)throw new Error('La transacción de inventario pertenece a otra empresa.')
 const{lot, index:lotIndex}=resolveScopedInventoryLot(state,input?.lotId,organizationId)
 const requestedSiteId=text(input?.siteId)
 if(requestedSiteId&&requestedSiteId!==text(lot.siteId))throw new Error('El lote de inventario pertenece a otra sede.')

 const quantity=asPositiveNumber(input.quantity)
 const signedQuantity=movementSign(input.type)*quantity
 const currentBalance=Number(lot.quantity||0)
 const balanceAfter=currentBalance+signedQuantity
 if(balanceAfter<0)throw new Error('El movimiento supera la existencia disponible.')

 const movement={
  id:input.id||crypto.randomUUID(),
  organizationId,
  lotId:lot.id,
  productId:lot.productId,
  siteId:lot.siteId,
  type:input.type,
  quantity,
  signedQuantity,
  balanceBefore:currentBalance,
  balanceAfter,
  date:input.date||new Date().toISOString().slice(0,10),
  createdAt:input.createdAt||new Date().toISOString(),
  sourceType:input.sourceType||'Manual',
  sourceId:input.sourceId||'',
  supplier:input.supplier||'',
  reference:input.reference||'',
  responsible:input.responsible||'',
  notes:input.notes||''
 }

 return{
  ...state,
  inventoryLots:list(state?.inventoryLots).map((item,index)=>index===lotIndex?{...item,organizationId,quantity:balanceAfter,updatedAt:movement.createdAt}:item),
  inventoryMovements:[...list(state?.inventoryMovements),movement]
 }
}

export function createInventoryLot(state,input){
 if(!input.productId)throw new Error('Selecciona un producto.')
 if(!input.siteId)throw new Error('Selecciona una sede.')
 const lotNumber=String(input.lotNumber||'').trim()
 if(!lotNumber)throw new Error('El número de lote es obligatorio.')
 if((state.inventoryLots||[]).some(l=>l.productId===input.productId&&l.siteId===input.siteId&&String(l.lotNumber||'').trim().toLowerCase()===lotNumber.toLowerCase()))throw new Error('Ya existe ese lote para el producto y la sede seleccionados.')

 const openingQuantity=Number(input.quantity||0)
 if(!Number.isFinite(openingQuantity)||openingQuantity<0)throw new Error('La cantidad inicial no puede ser negativa.')
 const minimum=Number(input.minimum||0)
 if(!Number.isFinite(minimum)||minimum<0)throw new Error('El stock mínimo no puede ser negativo.')

 const createdAt=input.createdAt||new Date().toISOString()
 const organizationId=activeOrganizationId(state)
 const lot={
  id:input.id||crypto.randomUUID(),
  organizationId,
  productId:input.productId,
  siteId:input.siteId,
  quantity:0,
  lotNumber,
  expiryDate:input.expiryDate||'',
  minimum,
  createdAt,
  updatedAt:createdAt
 }
 let next={...state,inventoryLots:[...(state.inventoryLots||[]),lot]}
 if(openingQuantity>0){
  next=transactInventory(next,{
   organizationId,
   siteId:lot.siteId,
   lotId:lot.id,
   type:'Saldo inicial',
   quantity:openingQuantity,
   date:input.date,
   createdAt,
   sourceType:'InventoryLot',
   sourceId:lot.id,
   reference:lotNumber,
   responsible:input.responsible,
   notes:'Registro de existencia inicial'
  })
 }
 return next
}
