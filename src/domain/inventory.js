const POSITIVE_TYPES=new Set(['Entrada','Ajuste positivo','Saldo inicial','Devolución'])
const NEGATIVE_TYPES=new Set(['Salida','Ajuste negativo','Consumo','Baja','Vencimiento'])

function asPositiveNumber(value,label='La cantidad'){
 const number=Number(value)
 if(!Number.isFinite(number)||number<=0)throw new Error(`${label} debe ser mayor que cero.`)
 return number
}

export function movementSign(type){
 if(POSITIVE_TYPES.has(type))return 1
 if(NEGATIVE_TYPES.has(type))return-1
 throw new Error(`Tipo de movimiento no soportado: ${type}`)
}

export function transactInventory(state,input){
 const lot=(state.inventoryLots||[]).find(item=>item.id===input.lotId)
 if(!lot)throw new Error('Selecciona un lote de inventario válido.')

 const quantity=asPositiveNumber(input.quantity)
 const signedQuantity=movementSign(input.type)*quantity
 const currentBalance=Number(lot.quantity||0)
 const balanceAfter=currentBalance+signedQuantity
 if(balanceAfter<0)throw new Error('El movimiento supera la existencia disponible.')

 const movement={
  id:input.id||crypto.randomUUID(),
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
  inventoryLots:(state.inventoryLots||[]).map(item=>item.id===lot.id?{...item,quantity:balanceAfter,updatedAt:movement.createdAt}:item),
  inventoryMovements:[...(state.inventoryMovements||[]),movement]
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
 const lot={
  id:input.id||crypto.randomUUID(),
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
