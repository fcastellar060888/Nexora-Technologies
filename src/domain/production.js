import{nextPhase}from'./lifecycle.js'
import{activeOrganizationId,resolveOrganizationId}from'./organizationOwnership.js'

const WEIGHT_PHASES=new Set(['Cosecha','Secado','Manicura','Selección','Empaque','Finalizado'])
const SOURCE_PHASE={Cosecha:null,Secado:'Cosecha',Manicura:'Secado',Selección:'Manicura',Empaque:'Selección',Finalizado:'Empaque'}
const list=value=>Array.isArray(value)?value:[]
const text=value=>String(value??'').trim()

function nonNegative(value,label){const n=Number(value);if(!Number.isFinite(n)||n<0)throw new Error(`${label} no puede ser negativo.`);return n}
function positive(value,label){const n=nonNegative(value,label);if(n<=0)throw new Error(`${label} debe ser mayor que cero.`);return n}
function lotOrganizationId(state,lot){try{return resolveOrganizationId(state,{record:lot,siteId:lot?.siteId,label:'lote productivo'})}catch{return''}}
function resolveScopedProductionLot(state,lotId,organizationId){
 const id=text(lotId)
 if(!id)throw new Error('Selecciona un lote válido.')
 const homonyms=list(state?.propagationBatches).map((lot,index)=>({lot,index})).filter(candidate=>text(candidate.lot?.id)===id)
 if(!homonyms.length)throw new Error('Selecciona un lote válido.')
 const matches=homonyms.filter(candidate=>lotOrganizationId(state,candidate.lot)===organizationId)
 if(matches.length>1)throw new Error('El lote productivo tiene identidad duplicada o ambigua dentro de la empresa activa.')
 if(matches.length===0)throw new Error('El lote productivo pertenece a otra empresa o no tiene ownership inequívoco.')
 return matches[0]
}
function finishedGoodOrganizationId(state,item){return resolveOrganizationId(state,{record:item,siteId:item?.siteId,label:'producto terminado'})}
function scopedFinishedGoodsForLot(state,lot,organizationId){
 const lotId=text(lot?.id),matches=[]
 for(const item of list(state?.finishedGoods).filter(candidate=>text(candidate?.lotId)===lotId)){
  let owner=''
  try{owner=finishedGoodOrganizationId(state,item)}catch{throw new Error('Existe producto terminado legacy con ownership ambiguo; migra organizationId/siteId antes de continuar.')}
  if(!owner)throw new Error('Existe producto terminado sin ownership inequívoco.')
  if(owner===organizationId)matches.push(item)
 }
 return matches
}

export function pctLoss(input,output){const i=Number(input||0),o=Number(output||0);return i>0?(i-o)/i*100:0}
export function unitCost(totalCost,grams){return Number(grams||0)>0?Number(totalCost||0)/Number(grams||0):0}
export function phaseOutput(lot,phase){return Number(lot?.productionLedger?.[phase]?.outputGrams||0)}
export function packedAvailableGrams(state,lotId,options={}){
 const organizationId=activeOrganizationId(state)
 const requestedOrganizationId=text(options?.organizationId)
 if(requestedOrganizationId&&requestedOrganizationId!==organizationId)throw new Error('El cálculo de producto terminado pertenece a otra empresa.')
 const{lot}=resolveScopedProductionLot(state,lotId,organizationId)
 const packed=phaseOutput(lot,'Empaque')
 const entered=scopedFinishedGoodsForLot(state,lot,organizationId).reduce((sum,item)=>sum+Number(item.initialGrams??item.packedGrams??item.availableGrams??0),0)
 return Math.max(0,packed-entered)
}

export function advanceProductionLot(state,input){
 const organizationId=activeOrganizationId(state)
 const requestedOrganizationId=text(input?.organizationId)
 if(requestedOrganizationId&&requestedOrganizationId!==organizationId)throw new Error('El avance de producción pertenece a otra empresa.')
 const{lot,index:lotIndex}=resolveScopedProductionLot(state,input?.lotId,organizationId)
 const requestedSiteId=text(input?.siteId)
 if(requestedSiteId&&requestedSiteId!==text(lot.siteId))throw new Error('El lote productivo pertenece a otra sede.')
 if(input.phase!==nextPhase(lot.phase))throw new Error(`El lote debe avanzar de ${lot.phase} a ${nextPhase(lot.phase)}.`)
 const quantity=nonNegative(input.quantity??lot.activeQuantity??0,'La cantidad que avanza')
 const discarded=nonNegative(input.discarded||0,'Los descartes')
 if(discarded>quantity)throw new Error('Los descartes no pueden superar la cantidad que avanza.')
 const activeQuantity=quantity-discarded
 let ledger={...(lot.productionLedger||{})},outputGrams=0,inputGrams=0,lossGrams=0,yieldPct=0
 if(WEIGHT_PHASES.has(input.phase)){
  outputGrams=positive(input.outputWeight,'El peso de salida')
  const source=SOURCE_PHASE[input.phase]
  inputGrams=source?phaseOutput(lot,source):outputGrams
  if(source&&inputGrams<=0)throw new Error(`Falta registrar el peso de salida de ${source}.`)
  if(source&&outputGrams>inputGrams)throw new Error(`El peso de ${input.phase} no puede superar el peso disponible de ${source}.`)
  lossGrams=Math.max(0,inputGrams-outputGrams)
  yieldPct=inputGrams?Math.round(outputGrams/inputGrams*1000)/10:100
  ledger[input.phase]={inputGrams,outputGrams,lossGrams,yieldPct,date:input.date,responsible:input.responsible||'',notes:input.notes||''}
 }
 const createdAt=input.createdAt||new Date().toISOString()
 const event={id:input.eventId||crypto.randomUUID(),organizationId,siteId:lot.siteId||null,lotId:lot.id,type:'Cambio de fase',date:input.date,title:`${lot.phase} → ${input.phase}`,quantity:activeQuantity,discarded,outputWeight:outputGrams,inputWeight:inputGrams,lossWeight:lossGrams,yieldPct,responsible:input.responsible||'',notes:input.notes||'',createdAt}
 return{...state,propagationBatches:list(state?.propagationBatches).map((item,index)=>index===lotIndex?{...item,organizationId,phase:input.phase,phaseStartedAt:input.date,activeQuantity,lastOutputWeight:outputGrams||item.lastOutputWeight||0,productionLedger:ledger,updatedAt:createdAt}:item),lotEvents:[...list(state?.lotEvents),event]}
}

export function receiveFinishedGoods(state,input){
 const organizationId=activeOrganizationId(state)
 const requestedOrganizationId=text(input?.organizationId)
 if(requestedOrganizationId&&requestedOrganizationId!==organizationId)throw new Error('El ingreso de producto terminado pertenece a otra empresa.')
 const{lot}=resolveScopedProductionLot(state,input?.lotId,organizationId)
 if(!['Empaque','Finalizado'].includes(lot.phase))throw new Error('Selecciona un lote empacado válido.')
 const requestedSiteId=text(input?.siteId)
 if(requestedSiteId&&requestedSiteId!==text(lot.siteId))throw new Error('El lote empacado pertenece a otra sede.')
 const grams=positive(input.packedGrams,'Los gramos empacados')
 const available=packedAvailableGrams(state,lot.id,{organizationId})
 if(grams>available)throw new Error(`Solo quedan ${available} g empacados disponibles para ingresar.`)
 const classification=text(input.classification);if(!classification)throw new Error('Selecciona una clasificación.')
 const scopedFinishedGoods=scopedFinishedGoodsForLot(state,lot,organizationId)
 if(scopedFinishedGoods.some(item=>text(item.classification)===classification))throw new Error('Ya existe inventario de esa clasificación para el lote en la empresa activa.')
 const createdAt=input.createdAt||new Date().toISOString(),id=input.id||crypto.randomUUID()
 const item={...input,id,organizationId,siteId:lot.siteId||null,lotId:lot.id,geneticId:lot.geneticId,classification,createdAt,availableGrams:grams,initialGrams:grams,reservedGrams:0,soldGrams:0,packedGrams:grams}
 const movement={id:input.movementId||crypto.randomUUID(),organizationId,siteId:lot.siteId||null,finishedGoodId:id,lotId:lot.id,type:'Entrada por empaque',grams,date:input.packedAt||createdAt.slice(0,10),balanceAfter:grams,sourceType:'ProductionLot',sourceId:lot.id,createdAt}
 return{...state,finishedGoods:[...list(state?.finishedGoods),item],finishedGoodsMovements:[...list(state?.finishedGoodsMovements),movement]}
}
