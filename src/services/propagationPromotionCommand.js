import{DomainEvents,publishDomainEvent}from'../core/events/index.js'
import{POSITION_OCCUPANCY}from'../domain/facilityEngine.js'
import{activeOrganizationId,explicitOrganizationId,resolveOrganizationId}from'../domain/organizationOwnership.js'
import{PROMOTION_TARGETS,promotionTargetForBatch}from'../domain/propagationPromotion.js'
import{hasPermission}from'./permissions.js'
import{executeCoreOperationCommand}from'./coreOperationCommand.js'

const ROOTED_STATUSES=new Set(['Enraizado','Listo','Aprobado'])
const text=value=>String(value??'').trim()
const list=value=>Array.isArray(value)?value:[]
const unique=value=>[...new Set(list(value).map(text).filter(Boolean))]
const ownerOf=(state,record,{siteId='',label='el registro'}={})=>resolveOrganizationId(state,{record,siteId,label})
const sameTenant=(state,record,organizationId,{siteId='',label='el registro'}={})=>{try{return ownerOf(state,record,{siteId,label})===organizationId}catch{return false}}

function targetLotCode(prefix,batch,commandId){return`${prefix}-${batch.code||batch.id}-${commandId.slice(0,8)}`}

export function preparePropagationPromotion(state,input={}, {commandId,occurredAt=new Date().toISOString()}={}){
 const organizationId=activeOrganizationId(state),promotionCommandId=text(commandId||input.commandId)
 if(!promotionCommandId)throw new Error('commandId es obligatorio para promover esquejes.')
 const batchId=text(input.batchId),unitIds=unique(input.unitIds)
 if(!batchId)throw new Error('El lote de propagación es obligatorio.')
 if(!unitIds.length)throw new Error('Selecciona al menos un esqueje enraizado.')
 const batch=list(state.propagationBatches).find(item=>item.id===batchId&&sameTenant(state,item,organizationId,{siteId:item.siteId,label:'el lote de propagación'}))
 if(!batch)throw new Error('El lote de propagación no existe en la organización activa.')
 const target=promotionTargetForBatch(batch)
 if(![PROMOTION_TARGETS.MOTHER,PROMOTION_TARGETS.GRANDMOTHER,PROMOTION_TARGETS.PRODUCTION].includes(target))throw new Error('Este propósito no tiene una promoción operativa confirmada.')
 const allUnits=list(state.propagationUnits).filter(unit=>unit.batchId===batch.id&&sameTenant(state,unit,organizationId,{siteId:unit.siteId||batch.siteId,label:'el esqueje'}))
 const byId=new Map(allUnits.map(unit=>[unit.id,unit]))
 const selected=unitIds.map(id=>byId.get(id))
 if(selected.some(unit=>!unit))throw new Error('La selección contiene esquejes ajenos o inexistentes.')
 const alreadySame=selected.every(unit=>unit.promotionCommandId===promotionCommandId&&unit.status==='Promovido')
 if(alreadySame)return Object.freeze({organizationId,batch,target,units:Object.freeze(selected),retry:true,occurredAt})
 if(selected.some(unit=>unit.status==='Promovido'||unit.promotedAt||unit.promotionCommandId))throw new Error('La selección contiene esquejes ya promovidos por otra operación.')
 if(selected.some(unit=>!ROOTED_STATUSES.has(unit.status)))throw new Error('La selección contiene esquejes no disponibles para promoción.')
 const effectiveDate=text(input.effectiveDate)
 if(!/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate))throw new Error('La fecha efectiva es obligatoria y debe ser una fecha civil válida.')
 const responsible=text(input.responsible),notes=text(input.notes),siteId=text(batch.siteId)
 let destinationId=text(input.targetLotId),house=null,bed=null,positions=[]
 if(target===PROMOTION_TARGETS.PRODUCTION){
  const houseId=text(input.houseId),bedId=text(input.bedId)
  if(!houseId||!bedId)throw new Error('Selecciona nave y cama para promover a producción.')
  house=list(state.houses).find(item=>item.id===houseId&&item.siteId===siteId&&sameTenant(state,item,organizationId,{siteId,label:'la nave'}))||null
  if(!house)throw new Error('La nave no pertenece a la sede y organización del lote.')
  bed=list(state.beds).find(item=>item.id===bedId&&item.houseId===house.id&&sameTenant(state,item,organizationId,{siteId,label:'la cama'}))||null
  if(!bed)throw new Error('La cama no pertenece a la nave y organización indicadas.')
  positions=list(state.plantPositions).filter(position=>position.bedId===bed.id&&sameTenant(state,position,organizationId,{siteId,label:'la posición'})&&(position.occupancyState===POSITION_OCCUPANCY.EMPTY||position.active===false||position.status==='Vacía')&&!position.sourcePropagationUnitId).sort((a,b)=>Number(a.row||0)-Number(b.row||0)||Number(a.position||0)-Number(b.position||0)||String(a.id).localeCompare(String(b.id)))
  if(positions.length<selected.length)throw new Error(`La cama solo tiene ${positions.length} posiciones canónicas libres para ${selected.length} esquejes.`)
  positions=positions.slice(0,selected.length)
  destinationId=destinationId||batch.productionLotId||batch.id
 }
 if(target===PROMOTION_TARGETS.MOTHER)destinationId=destinationId||`${promotionCommandId}:mother`
 if(target===PROMOTION_TARGETS.GRANDMOTHER)destinationId=destinationId||`${promotionCommandId}:grandmother`
 return Object.freeze({organizationId,batch,target,units:Object.freeze(selected),positions:Object.freeze(positions),destinationId,houseId:house?.id||'',bedId:bed?.id||'',effectiveDate,responsible,notes,promotionCommandId,occurredAt,retry:false})
}

function applyPromotion(current,prepared){
 if(prepared.retry)return current
 const tenant=prepared.organizationId,selectedIds=new Set(prepared.units.map(unit=>unit.id)),positionByUnit=new Map(prepared.units.map((unit,index)=>[unit.id,prepared.positions[index]]))
 const currentBatch=list(current.propagationBatches).find(item=>item.id===prepared.batch.id&&sameTenant(current,item,tenant,{siteId:item.siteId,label:'el lote'}))
 if(!currentBatch)throw new Error('El lote cambió o dejó de pertenecer a la organización durante la promoción.')
 const currentUnits=list(current.propagationUnits).filter(unit=>selectedIds.has(unit.id)&&unit.batchId===prepared.batch.id&&sameTenant(current,unit,tenant,{siteId:unit.siteId||prepared.batch.siteId,label:'el esqueje'}))
 if(currentUnits.length!==prepared.units.length)throw new Error('La selección cambió durante la promoción.')
 if(currentUnits.every(unit=>unit.promotionCommandId===prepared.promotionCommandId&&unit.status==='Promovido'))return current
 if(currentUnits.some(unit=>unit.status==='Promovido'||unit.promotedAt||unit.promotionCommandId))throw new Error('Un esqueje fue promovido concurrentemente por otra operación.')
 let plantPositions=list(current.plantPositions),motherPlants=list(current.motherPlants),grandmotherPlants=list(current.grandmotherPlants)
 if(prepared.target===PROMOTION_TARGETS.PRODUCTION){
  const reservedIds=new Set(prepared.positions.map(position=>position.id))
  const currentFree=new Map(plantPositions.filter(position=>reservedIds.has(position.id)&&sameTenant(current,position,tenant,{siteId:prepared.batch.siteId,label:'la posición'})).map(position=>[position.id,position]))
  if(currentFree.size!==prepared.positions.length||[...currentFree.values()].some(position=>position.sourcePropagationUnitId||position.occupancyState===POSITION_OCCUPANCY.OCCUPIED||position.active===true))throw new Error('La capacidad física cambió antes de confirmar la promoción.')
  const assignment=new Map(prepared.units.map((unit,index)=>[prepared.positions[index].id,unit]))
  plantPositions=plantPositions.map(position=>{const unit=assignment.get(position.id);if(!unit)return position;return{...position,organizationId:tenant,siteId:prepared.batch.siteId,lotId:prepared.destinationId,geneticId:prepared.batch.geneticId,active:true,status:'Activa',occupancyState:POSITION_OCCUPANCY.OCCUPIED,sourcePropagationUnitId:unit.id,directParentPlantId:unit.directParentPlantId||prepared.batch.sourcePlantId||'',plantIdentityId:unit.id,promotionCommandId:prepared.promotionCommandId,occupiedAt:prepared.occurredAt}})
 }
 if(prepared.target===PROMOTION_TARGETS.MOTHER&&!motherPlants.some(item=>item.id===prepared.destinationId&&sameTenant(current,item,tenant,{siteId:prepared.batch.siteId,label:'el lote de madres'})))motherPlants=[...motherPlants,{id:prepared.destinationId,organizationId:tenant,lotCode:targetLotCode('REN-MAD',prepared.batch,prepared.promotionCommandId),siteId:prepared.batch.siteId,geneticId:prepared.batch.geneticId,grandmotherPlantId:prepared.batch.grandmotherPlantId||prepared.batch.sourceLotId||'',quantity:prepared.units.length,cycleStartedAt:prepared.effectiveDate,renewalDays:180,alertDays:30,status:'Activa',healthStatus:'Sana',notes:prepared.notes,createdAt:prepared.occurredAt,sourcePropagationBatchId:prepared.batch.id,sourcePropagationUnitIds:prepared.units.map(unit=>unit.id),directParentPlantId:prepared.batch.sourcePlantId||'',promotionCommandId:prepared.promotionCommandId}]
 if(prepared.target===PROMOTION_TARGETS.GRANDMOTHER&&!grandmotherPlants.some(item=>item.id===prepared.destinationId&&sameTenant(current,item,tenant,{siteId:prepared.batch.siteId,label:'el lote de abuelas'})))grandmotherPlants=[...grandmotherPlants,{id:prepared.destinationId,organizationId:tenant,lotCode:targetLotCode('REN-ABU',prepared.batch,prepared.promotionCommandId),siteId:prepared.batch.siteId,geneticId:prepared.batch.geneticId,quantity:prepared.units.length,cycleStartedAt:prepared.effectiveDate,renewalDays:365,alertDays:45,status:'Activa',healthStatus:'Sana',notes:prepared.notes,createdAt:prepared.occurredAt,sourcePropagationBatchId:prepared.batch.id,sourcePropagationUnitIds:prepared.units.map(unit=>unit.id),directParentPlantId:prepared.batch.sourcePlantId||'',promotionCommandId:prepared.promotionCommandId}]
 const promotedAt=prepared.occurredAt
 const propagationUnits=list(current.propagationUnits).map(unit=>selectedIds.has(unit.id)?{...unit,status:'Promovido',promotedAt,promotionId:prepared.promotionCommandId,promotionCommandId:prepared.promotionCommandId,promotionTarget:prepared.target,destinationId:prepared.destinationId,houseId:prepared.houseId,bedId:prepared.bedId,plantPositionId:positionByUnit.get(unit.id)?.id||unit.plantPositionId||''}:unit)
 const remaining=propagationUnits.filter(unit=>unit.batchId===prepared.batch.id&&ROOTED_STATUSES.has(unit.status)&&!unit.promotedAt).length
 const propagationBatches=list(current.propagationBatches).map(item=>item.id===prepared.batch.id&&sameTenant(current,item,tenant,{siteId:item.siteId,label:'el lote'})?{...item,promotedQuantity:Number(item.promotedQuantity||0)+prepared.units.length,activeQuantity:Math.max(0,Number(item.activeQuantity||item.quantity||0)-prepared.units.length),promotionStatus:remaining?'Parcial':'Completada',lastPromotionCommandId:prepared.promotionCommandId}:item)
 const lotEvent={id:`${prepared.promotionCommandId}:promotion`,organizationId:tenant,lotId:prepared.batch.id,type:'Promoción',date:prepared.effectiveDate,title:`${prepared.units.length} esquejes promovidos a ${prepared.target}`,quantity:prepared.units.length,responsible:prepared.responsible,notes:prepared.notes,destinationId:prepared.destinationId,promotionId:prepared.promotionCommandId}
 return{...current,motherPlants,grandmotherPlants,plantPositions,propagationUnits,propagationBatches,lotEvents:[...list(current.lotEvents),lotEvent]}
}

export async function executePropagationPromotionCommand(state,input={},deps={}){
 if(!hasPermission(state,'manage_cultivation'))throw new Error('No tienes permiso para promover esquejes.')
 const commandId=text(input.commandId)||crypto.randomUUID(),occurredAt=input.occurredAt||new Date().toISOString()
 const prepared=preparePropagationPromotion(state,input,{commandId,occurredAt})
 if(prepared.retry)return Object.freeze({ok:true,retry:true,commandId,target:prepared.target,destinationId:prepared.units[0]?.destinationId||''})
 const publishEvent=deps.publishEvent||((event)=>publishDomainEvent(state,event)),commit=deps.commit
 if(typeof commit!=='function')throw new TypeError('commit es obligatorio para promover esquejes.')
 await executeCoreOperationCommand({commandId,organizationId:prepared.organizationId,siteId:prepared.batch.siteId,aggregateType:'propagation-batch',aggregateId:prepared.batch.id,completedEventName:DomainEvents.PROPAGATION_BATCH_PROMOTED,occurredAt,payload:{target:prepared.target,unitIds:prepared.units.map(unit=>unit.id),destinationId:prepared.destinationId,houseId:prepared.houseId,bedId:prepared.bedId},metadata:{module:'propagation'},apply:current=>applyPromotion(current,prepared)},{publishEvent,commit})
 return Object.freeze({ok:true,retry:false,commandId,target:prepared.target,destinationId:prepared.destinationId})
}
