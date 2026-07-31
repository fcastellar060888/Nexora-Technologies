import{nextPhase}from'./lifecycle.js'

const WEIGHT_PHASES=new Set(['Cosecha','Secado','Manicura','Selección','Empaque','Finalizado'])
const SOURCE_PHASE={Cosecha:null,Secado:'Cosecha',Manicura:'Secado',Selección:'Manicura',Empaque:'Selección',Finalizado:'Empaque'}

function nonNegative(value,label){const n=Number(value);if(!Number.isFinite(n)||n<0)throw new Error(`${label} no puede ser negativo.`);return n}
function positive(value,label){const n=nonNegative(value,label);if(n<=0)throw new Error(`${label} debe ser mayor que cero.`);return n}
export function pctLoss(input,output){const i=Number(input||0),o=Number(output||0);return i>0?(i-o)/i*100:0}
export function unitCost(totalCost,grams){return Number(grams||0)>0?Number(totalCost||0)/Number(grams||0):0}
export function phaseOutput(lot,phase){return Number(lot?.productionLedger?.[phase]?.outputGrams||0)}
export function packedAvailableGrams(state,lotId){const lot=(state.propagationBatches||[]).find(x=>x.id===lotId);const packed=phaseOutput(lot,'Empaque');const entered=(state.finishedGoods||[]).filter(x=>x.lotId===lotId).reduce((sum,x)=>sum+Number(x.initialGrams??x.packedGrams??x.availableGrams??0),0);return Math.max(0,packed-entered)}

export function advanceProductionLot(state,input){
 const lot=(state.propagationBatches||[]).find(x=>x.id===input.lotId)
 if(!lot)throw new Error('Selecciona un lote válido.')
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
 const event={id:input.eventId||crypto.randomUUID(),lotId:lot.id,type:'Cambio de fase',date:input.date,title:`${lot.phase} → ${input.phase}`,quantity:activeQuantity,discarded,outputWeight:outputGrams,inputWeight:inputGrams,lossWeight:lossGrams,yieldPct,responsible:input.responsible||'',notes:input.notes||'',createdAt}
 return{...state,propagationBatches:(state.propagationBatches||[]).map(x=>x.id===lot.id?{...x,phase:input.phase,phaseStartedAt:input.date,activeQuantity,lastOutputWeight:outputGrams||x.lastOutputWeight||0,productionLedger:ledger,updatedAt:createdAt}:x),lotEvents:[...(state.lotEvents||[]),event]}
}

export function receiveFinishedGoods(state,input){
 const lot=(state.propagationBatches||[]).find(x=>x.id===input.lotId)
 if(!lot||!['Empaque','Finalizado'].includes(lot.phase))throw new Error('Selecciona un lote empacado válido.')
 const grams=positive(input.packedGrams,'Los gramos empacados')
 const available=packedAvailableGrams(state,lot.id)
 if(grams>available)throw new Error(`Solo quedan ${available} g empacados disponibles para ingresar.`)
 const classification=String(input.classification||'').trim();if(!classification)throw new Error('Selecciona una clasificación.')
 if((state.finishedGoods||[]).some(x=>x.lotId===lot.id&&x.classification===classification))throw new Error('Ya existe inventario de esa clasificación para el lote.')
 const createdAt=input.createdAt||new Date().toISOString(),id=input.id||crypto.randomUUID()
 const item={id,createdAt,geneticId:lot.geneticId,availableGrams:grams,initialGrams:grams,reservedGrams:0,soldGrams:0,...input,packedGrams:grams}
 const movement={id:input.movementId||crypto.randomUUID(),finishedGoodId:id,lotId:lot.id,type:'Entrada por empaque',grams,date:input.packedAt||createdAt.slice(0,10),balanceAfter:grams,sourceType:'ProductionLot',sourceId:lot.id,createdAt}
 return{...state,finishedGoods:[...(state.finishedGoods||[]),item],finishedGoodsMovements:[...(state.finishedGoodsMovements||[]),movement]}
}
