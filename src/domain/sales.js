import{activeOrganizationId,explicitOrganizationId,resolveOrganizationId}from'./organizationOwnership.js'

const list=value=>Array.isArray(value)?value:[]
const text=value=>String(value??'').trim()

function positive(value,label){const n=Number(value);if(!Number.isFinite(n)||n<=0)throw new Error(`${label} debe ser mayor que cero.`);return n}
function recordOrganizationId(state,record,label){try{return resolveOrganizationId(state,{record,siteId:record?.siteId,label})}catch{return''}}
function assertRequestedAuthority(state,input,organizationId,siteId,label){
 const requestedOrganizationId=explicitOrganizationId(input)
 if(requestedOrganizationId&&requestedOrganizationId!==organizationId)throw new Error(`${label} pertenece a otra empresa.`)
 const requestedSiteId=text(input?.siteId)
 if(requestedSiteId&&requestedSiteId!==text(siteId))throw new Error(`${label} pertenece a otra sede.`)
}
function scopedMatches(state,collection,id,organizationId,label){
 const identity=text(id)
 return list(state?.[collection]).map((record,index)=>({record,index})).filter(candidate=>text(candidate.record?.id)===identity&&recordOrganizationId(state,candidate.record,label)===organizationId)
}
function resolveScopedRecord(state,collection,id,organizationId,label){
 const identity=text(id)
 if(!identity)throw new Error(`Selecciona ${label} válido.`)
 const matches=scopedMatches(state,collection,identity,organizationId,label)
 if(matches.length>1)throw new Error(`${label} tiene identidad duplicada o ambigua dentro de la empresa activa.`)
 if(matches.length===0)throw new Error(`${label} pertenece a otra empresa o no tiene ownership inequívoco.`)
 return matches[0]
}
function resolveScopedStock(state,id,organizationId){return resolveScopedRecord(state,'finishedGoods',id,organizationId,'inventario de producto terminado')}
function resolveScopedSale(state,id,organizationId){return resolveScopedRecord(state,'sales',id,organizationId,'reserva comercial')}
function assertSaleStockConsistency(sale,stock){
 if(text(sale.stockId)!==text(stock.id)||text(sale.siteId)!==text(stock.siteId)||text(sale.lotId)!==text(stock.lotId)||text(sale.classification)!==text(stock.classification))throw new Error('La reserva comercial no coincide causalmente con el inventario de producto terminado.')
}
function reservationSignature(input,stock,organizationId){return JSON.stringify({operation:'RESERVE',organizationId,siteId:text(stock.siteId),stockId:text(stock.id),lotId:text(stock.lotId),classification:text(stock.classification),customer:text(input.customer),date:text(input.date),grams:Number(input.grams),pricePerGram:Number(input.pricePerGram||0),currency:text(input.currency||'COP'),exchangeRate:Number(input.exchangeRate||1),reference:text(input.reference),notes:text(input.notes)})}
function dispatchSignature(input,sale,stock,organizationId){return JSON.stringify({operation:'DISPATCH',organizationId,siteId:text(stock.siteId),saleId:text(sale.id),stockId:text(stock.id),dispatchReference:text(input.dispatchReference),responsible:text(input.responsible)})}
function cancelSignature(input,sale,stock,organizationId){return JSON.stringify({operation:'CANCEL',organizationId,siteId:text(stock.siteId),saleId:text(sale.id),stockId:text(stock.id),reason:text(input.reason)})}
function assertMovementIdentityAvailable(state,movementId,organizationId){
 const id=text(movementId)
 if(!id)return
 const matches=scopedMatches(state,'finishedGoodsMovements',id,organizationId,'movimiento comercial')
 if(matches.length)throw new Error('La identidad del movimiento comercial ya fue utilizada por otro comando; replay contradictorio rechazado.')
}
function movement(stock,input,grams,before,after,organizationId,commandSignature){return{id:input.movementId||crypto.randomUUID(),organizationId,siteId:stock.siteId||null,finishedGoodId:stock.id,lotId:stock.lotId,classification:stock.classification,type:input.type,grams,balanceBefore:before,balanceAfter:after,date:input.date||new Date().toISOString().slice(0,10),createdAt:input.createdAt||new Date().toISOString(),sourceType:'SaleOrder',sourceId:input.saleId||'',reference:input.reference||'',responsible:input.responsible||'',notes:input.notes||'',commandSignature}}

export function salesViewForActiveOrganization(state){
 const organizationId=activeOrganizationId(state)
 const scoped=collection=>list(state?.[collection]).flatMap(record=>recordOrganizationId(state,record,collection)===organizationId?[record.organizationId?record:{...record,organizationId}]:[])
 return{organizationId,finishedGoods:scoped('finishedGoods'),sales:scoped('sales'),finishedGoodsMovements:scoped('finishedGoodsMovements'),propagationBatches:scoped('propagationBatches')}
}

export function reserveFinishedGoods(state,input={}){
 const organizationId=activeOrganizationId(state)
 const{record:stock,index:stockIndex}=resolveScopedStock(state,input.stockId,organizationId)
 assertRequestedAuthority(state,input,organizationId,stock.siteId,'La reserva comercial')
 const grams=positive(input.grams,'Los gramos'),createdAt=input.createdAt||new Date().toISOString(),saleId=input.id||crypto.randomUUID()
 const commandSignature=reservationSignature({...input,grams},stock,organizationId)
 const existingSales=scopedMatches(state,'sales',saleId,organizationId,'reserva comercial')
 if(existingSales.length>1)throw new Error('La reserva comercial tiene identidad duplicada o ambigua dentro de la empresa activa.')
 if(existingSales.length===1){
  const existing=existingSales[0].record
  if(text(existing.reserveCommandSignature)===commandSignature)return state
  throw new Error('La identidad de la reserva comercial fue reutilizada con un comando contradictorio; replay rechazado.')
 }
 assertMovementIdentityAvailable(state,input.movementId,organizationId)
 const available=Number(stock.availableGrams||0)
 if(grams>available)throw new Error('La reserva supera el inventario disponible.')
 const sale={id:saleId,organizationId,siteId:stock.siteId||null,stockId:stock.id,lotId:stock.lotId,classification:stock.classification,customer:text(input.customer),date:input.date||createdAt.slice(0,10),grams,pricePerGram:Number(input.pricePerGram||0),currency:input.currency||'COP',exchangeRate:Number(input.exchangeRate||1),reference:input.reference||'',notes:input.notes||'',status:'Reservada',reservedAt:createdAt,createdAt,totalOriginal:grams*Number(input.pricePerGram||0),totalBase:grams*Number(input.pricePerGram||0)*Number(input.exchangeRate||1),reserveCommandSignature:commandSignature,reserveMovementId:input.movementId||null}
 if(!sale.customer)throw new Error('El cliente es obligatorio.')
 const nextStock={...stock,organizationId,availableGrams:available-grams,reservedGrams:Number(stock.reservedGrams||0)+grams}
 return{...state,finishedGoods:list(state?.finishedGoods).map((item,index)=>index===stockIndex?nextStock:item),sales:[...list(state?.sales),sale],finishedGoodsMovements:[...list(state?.finishedGoodsMovements),movement(stock,{...input,type:'Reserva',saleId:sale.id,createdAt},-grams,available,available-grams,organizationId,commandSignature)]}
}

export function dispatchSale(state,input={}){
 const organizationId=activeOrganizationId(state)
 const{record:sale,index:saleIndex}=resolveScopedSale(state,input.saleId,organizationId)
 assertRequestedAuthority(state,input,organizationId,sale.siteId,'La reserva comercial')
 const{record:stock,index:stockIndex}=resolveScopedStock(state,sale.stockId,organizationId)
 assertSaleStockConsistency(sale,stock)
 const commandSignature=dispatchSignature(input,sale,stock,organizationId)
 if(sale.status==='Despachada'){
  if(text(sale.dispatchCommandSignature)===commandSignature)return state
  throw new Error('La venta ya fue despachada con un comando distinto; redispatch contradictorio rechazado.')
 }
 if(sale.status!=='Reservada')throw new Error('Solo se pueden despachar ventas reservadas.')
 assertMovementIdentityAvailable(state,input.movementId,organizationId)
 const grams=Number(sale.grams||0),reserved=Number(stock.reservedGrams||0)
 if(grams>reserved)throw new Error('La reserva del inventario es insuficiente para despachar.')
 const at=input.createdAt||new Date().toISOString(),nextStock={...stock,organizationId,reservedGrams:reserved-grams,soldGrams:Number(stock.soldGrams||0)+grams}
 const nextSale={...sale,organizationId,siteId:stock.siteId||null,status:'Despachada',dispatchedAt:at,dispatchReference:input.dispatchReference||'',responsible:input.responsible||'',dispatchCommandSignature:commandSignature,dispatchMovementId:input.movementId||null}
 return{...state,finishedGoods:list(state?.finishedGoods).map((item,index)=>index===stockIndex?nextStock:item),sales:list(state?.sales).map((item,index)=>index===saleIndex?nextSale:item),finishedGoodsMovements:[...list(state?.finishedGoodsMovements),movement(stock,{...input,type:'Despacho',saleId:sale.id,createdAt:at,reference:input.dispatchReference||sale.reference},-grams,reserved,reserved-grams,organizationId,commandSignature)]}
}

export function cancelReservation(state,input={}){
 const organizationId=activeOrganizationId(state)
 const{record:sale,index:saleIndex}=resolveScopedSale(state,input.saleId,organizationId)
 assertRequestedAuthority(state,input,organizationId,sale.siteId,'La reserva comercial')
 const{record:stock,index:stockIndex}=resolveScopedStock(state,sale.stockId,organizationId)
 assertSaleStockConsistency(sale,stock)
 const commandSignature=cancelSignature(input,sale,stock,organizationId)
 if(sale.status==='Cancelada'){
  if(text(sale.cancelCommandSignature)===commandSignature)return state
  throw new Error('La reserva ya fue cancelada con un comando distinto; replay contradictorio rechazado.')
 }
 if(sale.status!=='Reservada')throw new Error('Solo se pueden cancelar ventas reservadas.')
 assertMovementIdentityAvailable(state,input.movementId,organizationId)
 const grams=Number(sale.grams||0),reserved=Number(stock.reservedGrams||0)
 if(grams>reserved)throw new Error('La reserva del inventario es insuficiente para cancelar.')
 const available=Number(stock.availableGrams||0),at=input.createdAt||new Date().toISOString()
 const nextStock={...stock,organizationId,reservedGrams:reserved-grams,availableGrams:available+grams}
 const nextSale={...sale,organizationId,siteId:stock.siteId||null,status:'Cancelada',cancelledAt:at,cancelReason:input.reason||'',cancelCommandSignature:commandSignature,cancelMovementId:input.movementId||null}
 return{...state,finishedGoods:list(state?.finishedGoods).map((item,index)=>index===stockIndex?nextStock:item),sales:list(state?.sales).map((item,index)=>index===saleIndex?nextSale:item),finishedGoodsMovements:[...list(state?.finishedGoodsMovements),movement(stock,{...input,type:'Liberación de reserva',saleId:sale.id,createdAt:at},grams,available,available+grams,organizationId,commandSignature)]}
}
