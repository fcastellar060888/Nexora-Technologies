import{PROPAGATION_PURPOSES}from'./propagationPurpose.js'

const ROOTED_STATUSES=new Set(['Enraizado','Listo','Aprobado'])
const CLOSED_STATUSES=new Set(['Muerto','Descartado','Promovido'])

export const PROMOTION_TARGETS=Object.freeze({
 MOTHER:'MOTHER',
 GRANDMOTHER:'GRANDMOTHER',
 PRODUCTION:'PRODUCTION',
 GENETIC_RESERVE:'GENETIC_RESERVE',
 EVALUATION:'EVALUATION'
})

export function promotablePropagationUnits(state,batchId){
 return(state.propagationUnits||[]).filter(unit=>unit.batchId===batchId&&ROOTED_STATUSES.has(unit.status)&&!unit.promotedAt&&!CLOSED_STATUSES.has(unit.status))
}

export function promotionTargetForBatch(batch){
 if(batch?.purpose===PROPAGATION_PURPOSES.MOTHER_RENEWAL)return PROMOTION_TARGETS.MOTHER
 if(batch?.purpose===PROPAGATION_PURPOSES.GRANDMOTHER_RENEWAL)return PROMOTION_TARGETS.GRANDMOTHER
 if(batch?.purpose===PROPAGATION_PURPOSES.PRODUCTION||batch?.entersProduction)return PROMOTION_TARGETS.PRODUCTION
 if(batch?.purpose===PROPAGATION_PURPOSES.GENETIC_RESERVE)return PROMOTION_TARGETS.GENETIC_RESERVE
 return PROMOTION_TARGETS.EVALUATION
}

function requireSelection(state,batch,unitIds){
 if(!batch)throw new Error('El lote de propagación no existe.')
 const unique=[...new Set(unitIds||[])]
 if(!unique.length)throw new Error('Selecciona al menos un esqueje enraizado.')
 const available=new Map(promotablePropagationUnits(state,batch.id).map(unit=>[unit.id,unit]))
 const units=unique.map(id=>available.get(id))
 if(units.some(unit=>!unit))throw new Error('La selección contiene esquejes no disponibles para promoción.')
 return units
}

const nextLotCode=(prefix,batch,existing)=>{
 const base=`${prefix}-${batch.code}`
 let index=1,code=`${base}-${String(index).padStart(2,'0')}`
 while(existing.some(item=>item.lotCode===code)){index+=1;code=`${base}-${String(index).padStart(2,'0')}`}
 return code
}

export function promotePropagationUnits(state,{batchId,unitIds,effectiveDate,responsible='',notes='',targetLotId='',houseId='',bedId=''}){
 const batch=(state.propagationBatches||[]).find(item=>item.id===batchId)
 const units=requireSelection(state,batch,unitIds)
 const target=promotionTargetForBatch(batch),date=effectiveDate||new Date().toISOString().slice(0,10),promotionId=crypto.randomUUID()
 let motherPlants=state.motherPlants||[],grandmotherPlants=state.grandmotherPlants||[],plantPositions=state.plantPositions||[]
 let destinationId=targetLotId||''
 if(target===PROMOTION_TARGETS.MOTHER){
  destinationId=crypto.randomUUID()
  motherPlants=[...motherPlants,{id:destinationId,lotCode:nextLotCode('REN-MAD',batch,motherPlants),siteId:batch.siteId,geneticId:batch.geneticId,grandmotherPlantId:batch.grandmotherPlantId||batch.sourceLotId||'',quantity:units.length,cycleStartedAt:date,renewalDays:180,alertDays:30,status:'Activa',healthStatus:'Sana',notes,createdAt:new Date().toISOString(),sourcePropagationBatchId:batch.id,sourcePropagationUnitIds:units.map(unit=>unit.id),directParentPlantId:batch.sourcePlantId||''}]
 }
 if(target===PROMOTION_TARGETS.GRANDMOTHER){
  destinationId=crypto.randomUUID()
  grandmotherPlants=[...grandmotherPlants,{id:destinationId,lotCode:nextLotCode('REN-ABU',batch,grandmotherPlants),siteId:batch.siteId,geneticId:batch.geneticId,quantity:units.length,cycleStartedAt:date,renewalDays:365,alertDays:45,status:'Activa',healthStatus:'Sana',notes,createdAt:new Date().toISOString(),sourcePropagationBatchId:batch.id,sourcePropagationUnitIds:units.map(unit=>unit.id),directParentPlantId:batch.sourcePlantId||''}]
 }
 if(target===PROMOTION_TARGETS.PRODUCTION&&bedId){
  const bed=(state.beds||[]).find(item=>item.id===bedId)
  if(!bed||bed.houseId!==houseId)throw new Error('Selecciona una cama válida de la nave indicada.')
  const occupied=(state.plantPositions||[]).filter(item=>item.bedId===bedId).length
  plantPositions=[...plantPositions,...units.map((unit,index)=>({id:crypto.randomUUID(),bedId,lotId:targetLotId||batch.productionLotId||batch.id,geneticId:batch.geneticId,row:Math.floor((occupied+index)/Math.max(1,Number(bed.plantsPerRow)||1))+1,position:(occupied+index)%Math.max(1,Number(bed.plantsPerRow)||1)+1,active:true,code:unit.code,sourcePropagationUnitId:unit.id,directParentPlantId:unit.directParentPlantId||batch.sourcePlantId||''}))]
  destinationId=targetLotId||batch.productionLotId||batch.id
 }
 const promotedIds=new Set(units.map(unit=>unit.id)),promotedAt=new Date().toISOString()
 const propagationUnits=(state.propagationUnits||[]).map(unit=>promotedIds.has(unit.id)?{...unit,status:'Promovido',promotedAt,promotionId,promotionTarget:target,destinationId,houseId:target===PROMOTION_TARGETS.PRODUCTION?houseId:'',bedId:target===PROMOTION_TARGETS.PRODUCTION?bedId:''}:unit)
 const remaining=promotablePropagationUnits({...state,propagationUnits},batch.id).length
 const propagationBatches=(state.propagationBatches||[]).map(item=>item.id===batch.id?{...item,promotedQuantity:Number(item.promotedQuantity||0)+units.length,activeQuantity:Math.max(0,Number(item.activeQuantity||item.quantity||0)-units.length),promotionStatus:remaining?'Parcial':'Completada'}:item)
 const lotEvents=[...(state.lotEvents||[]),{id:crypto.randomUUID(),lotId:batch.id,type:'Promoción',date,title:`${units.length} esquejes promovidos a ${target}`,quantity:units.length,responsible,notes,destinationId,promotionId}]
 return{...state,motherPlants,grandmotherPlants,plantPositions,propagationUnits,propagationBatches,lotEvents}
}
