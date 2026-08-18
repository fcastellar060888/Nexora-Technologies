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

function fallbackRecordOrganizationId(state,record){
 const explicit=explicitOrganizationId(record)
 if(explicit)return explicit
 const companies=list(state?.companies)
 if(companies.length===1)return text(companies[0]?.id)
 if(companies.length===0)return'local-installation'
 return''
}

function resolveScopedReference(state,collection,id,organizationId,label){
 const referenceId=text(id)
 if(!referenceId)throw new Error(`Selecciona ${label==='producto'?'un producto':'una sede'} válido.`)
 const homonyms=list(state?.[collection]).filter(item=>text(item?.id)===referenceId)
 if(!homonyms.length)throw new Error(`El ${label} seleccionado no existe.`)
 const resolved=homonyms.map(item=>({item,owner:fallbackRecordOrganizationId(state,item)}))
 const matches=resolved.filter(candidate=>candidate.owner===organizationId)
 if(matches.length>1)throw new Error(`La identidad del ${label} está duplicada o es ambigua dentro de la empresa activa.`)
 if(matches.length===1)return matches[0].item
 if(resolved.some(candidate=>!candidate.owner))throw new Error(`No se puede determinar el ownership del ${label} seleccionado en un estado multiempresa.`)
 throw new Error(`El ${label} seleccionado pertenece a otra empresa.`)
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

function assertTenantLocalLotUniqueness(state,{organizationId,productId,siteId,lotNumber,lotId}){
 const normalizedLotNumber=text(lotNumber).toLowerCase()
 for(const existing of list(state?.inventoryLots)){
  const owner=inventoryLotOrganizationId(state,existing)
  const sameBusinessKey=text(existing?.productId)===productId&&text(existing?.siteId)===siteId&&text(existing?.lotNumber).toLowerCase()===normalizedLotNumber
  const sameIdentity=lotId&&text(existing?.id)===lotId
  if(!sameBusinessKey&&!sameIdentity)continue
  if(!owner)throw new Error('Existe un lote legacy con ownership ambiguo que debe migrarse antes de crear el lote.')
  if(owner!==organizationId)continue
  if(sameIdentity)throw new Error('Ya existe un lote con esa identidad dentro de la empresa activa.')
  throw new Error('Ya existe ese lote para el producto y la sede seleccionados dentro de la empresa activa.')
 }
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
 const organizationId=activeOrganizationId(state)
 const requestedOrganizationId=text(input?.organizationId)
 if(requestedOrganizationId&&requestedOrganizationId!==organizationId)throw new Error('El lote de inventario pertenece a otra empresa.')

 const productId=text(input?.productId)
 const siteId=text(input?.siteId)
 if(!productId)throw new Error('Selecciona un producto.')
 if(!siteId)throw new Error('Selecciona una sede.')
 resolveScopedReference(state,'products',productId,organizationId,'producto')
 resolveScopedReference(state,'sites',siteId,organizationId,'sede')

 const lotNumber=text(input?.lotNumber)
 if(!lotNumber)throw new Error('El número de lote es obligatorio.')
 const lotId=text(input?.id)
 assertTenantLocalLotUniqueness(state,{organizationId,productId,siteId,lotNumber,lotId})

 const openingQuantity=Number(input.quantity||0)
 if(!Number.isFinite(openingQuantity)||openingQuantity<0)throw new Error('La cantidad inicial no puede ser negativa.')
 const minimum=Number(input.minimum||0)
 if(!Number.isFinite(minimum)||minimum<0)throw new Error('El stock mínimo no puede ser negativo.')

 const createdAt=input.createdAt||new Date().toISOString()
 const lot={
  id:lotId||crypto.randomUUID(),
  organizationId,
  productId,
  siteId,
  quantity:0,
  lotNumber,
  expiryDate:input.expiryDate||'',
  minimum,
  createdAt,
  updatedAt:createdAt
 }
 let next={...state,inventoryLots:[...list(state?.inventoryLots),lot]}
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
