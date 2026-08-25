import{DomainEvents,publishDomainEvent}from'../core/events/index.js'
import{geneticProfilesForOrganization}from'../domain/geneticProfile.js'
import{lotCode}from'../domain/lifecycle.js'
import{MIPE_RESTRICTED_OPERATIONS,assertMipeOperationAllowed}from'../domain/mipeOperationalRestrictions.js'
import{activeOrganizationId,explicitOrganizationId,resolveOrganizationId}from'../domain/organizationOwnership.js'
import{allocateUnitsToBank}from'../domain/propagationAllocation.js'
import{createPurposeAwareBatch,PROPAGATION_PURPOSES,propagationSourceUnits}from'../domain/propagationPurpose.js'
import{hasPermission}from'./permissions.js'
import{executeCoreOperationCommand}from'./coreOperationCommand.js'

const text=value=>String(value??'').trim()
const positive=value=>Math.max(0,Math.trunc(Number(value)||0))
const sameTenant=(record,organizationId)=>{const owner=explicitOrganizationId(record);return!owner||owner===organizationId}
const unique=(records,label)=>{if(records.length!==1)throw new Error(records.length?`${label} tiene identidad duplicada dentro de la organización activa.`:`No se encontró ${label} dentro de la organización activa.`);return records[0]}
function assertTargetPermission(state,organizationId,siteId){if(!hasPermission(state,'manage_cultivation',{companyId:organizationId,siteId}))throw new Error('No tienes permiso manage_cultivation sobre la sede real de este corte de propagación.')}
function activeBatchById(state,id,organizationId){
 const matches=(state.propagationBatches||[]).filter(item=>item.id===id&&sameTenant(item,organizationId))
 if(matches.length>1)throw new Error('El identificador del batch tiene identidad duplicada dentro de la organización activa.')
 return matches[0]||null
}
function siteAndBank(state,{organizationId,siteId,bankId}){
 const sites=(state.sites||[]).filter(item=>item.id===siteId&&sameTenant(item,organizationId)&&resolveOrganizationId(state,{record:item,label:'la sede'})===organizationId),site=unique(sites,'la sede del corte')
 const banks=(state.propagationBanks||[]).filter(item=>item.id===bankId&&item.active!==false&&item.siteId===siteId&&sameTenant(item,organizationId)&&resolveOrganizationId(state,{record:item,siteId,label:'el banco'})===organizationId),bank=unique(banks,'el banco de propagación')
 return{site,bank}
}
function sourceForCut(state,{organizationId,siteId,sourcePlantId,at}){
 const matches=propagationSourceUnits(state,{organizationId,siteId,at}).filter(item=>item.id===sourcePlantId)
 if(matches.length!==1)throw new Error(matches.length?'La planta de origen tiene identidad duplicada dentro de la organización y sede activas.':'La planta de origen no es elegible dentro de la organización y sede activas.')
 const source=matches[0]
 assertMipeOperationAllowed(state,{operation:MIPE_RESTRICTED_OPERATIONS.PROPAGATION_CUT,targetType:'MATERIAL_PLANT',targetId:source.id,organizationId,at})
 return source
}

export function preparePropagationBatch(state,input={}, {commandId,occurredAt=new Date().toISOString()}={}){
 const organizationId=activeOrganizationId(state)
 const id=text(input.batchId||commandId)
 if(!id)throw new Error('commandId o batchId es obligatorio para crear el corte.')
 const siteId=text(input.siteId),bankId=text(input.bankId),sourcePlantId=text(input.sourcePlantId),geneticId=text(input.geneticId)
 const quantity=positive(input.quantity)
 if(!siteId||!bankId||!sourcePlantId)throw new Error('Sede, banco y planta de origen son obligatorios.')
 if(quantity<=0)throw new Error('La cantidad debe ser mayor que cero.')
 const{site,bank}=siteAndBank(state,{organizationId,siteId,bankId})
 const source=sourceForCut(state,{organizationId,siteId,sourcePlantId,at:occurredAt})
 const resolvedGeneticId=geneticId||source.geneticId
 if(resolvedGeneticId!==source.geneticId)throw new Error('La genética del corte no coincide con la planta de origen.')
 const genetic=geneticProfilesForOrganization(state,organizationId).find(item=>item.id===resolvedGeneticId&&item.active)
 if(!genetic)throw new Error('La genética del corte no está activa en la organización.')
 const purpose=input.purpose||PROPAGATION_PURPOSES.PRODUCTION
 const directGrandmotherProduction=purpose===PROPAGATION_PURPOSES.PRODUCTION&&source.plantType==='GRANDMOTHER'
 if(directGrandmotherProduction&&input.authorizedGrandmotherProduction!==true)throw new Error('El uso productivo directo de una Abuela requiere autorización explícita.')
 const cutDate=text(input.cutDate)
 if(!/^\d{4}-\d{2}-\d{2}$/.test(cutDate))throw new Error('La fecha de corte es obligatoria y debe ser una fecha civil válida.')
 const sequence=Math.max(1,positive(input.sequence)||1)
 const code=text(input.code)||lotCode(site,genetic,cutDate,sequence)
 const collision=activeBatchById(state,id,organizationId)
 if(collision){
  if(collision.commandId===commandId)return Object.freeze({organizationId,batch:collision,units:(state.propagationUnits||[]).filter(unit=>unit.batchId===id&&sameTenant(unit,organizationId)),event:null,retry:true})
  throw new Error('El identificador del batch ya existe con otra operación dentro de la organización activa.')
 }
 if((state.propagationBatches||[]).some(item=>sameTenant(item,organizationId)&&item.code===code))throw new Error('Ese código de lote ya existe en la organización.')
 const rawUnits=Array.from({length:quantity},(_,index)=>({id:`${id}:clone:${index+1}`,organizationId,batchId:id,code:`${code}-E${String(index+1).padStart(4,'0')}`,status:'Cortado',cutDate,rootDate:'',discardDate:'',discardReason:'',plantPositionId:'',sourcePlantId:source.id,purpose,targetLifecycleStage:''}))
 const allocated=allocateUnitsToBank(rawUnits,bank,(state.propagationUnits||[]).filter(unit=>sameTenant(unit,organizationId)))
 const base={id,commandId,organizationId,code,createdAt:occurredAt,phase:'Propagación',phaseStartedAt:cutDate,activeQuantity:quantity,geneticId:resolvedGeneticId,siteId,bankId:bank.id,cutDate,sequence,quantity,substrate:text(input.substrate),hormone:text(input.hormone),operator:text(input.operator),expectedRootDate:text(input.expectedRootDate),notes:text(input.notes),motherPlantId:source.plantType==='MOTHER'?source.lotId:'',authorizedGrandmotherProduction:directGrandmotherProduction&&input.authorizedGrandmotherProduction===true}
 const batch=createPurposeAwareBatch(base,{sourceUnit:source,purpose,productionLotId:text(input.productionLotId),organizationId})
 const units=allocated.map(unit=>({...unit,organizationId,purpose:batch.purpose,targetLifecycleStage:batch.targetLifecycleStage,entersProduction:batch.entersProduction,directParentPlantId:source.id,geneticId:resolvedGeneticId,siteId}))
 const event={id:`${organizationId}:${id}:created`,organizationId,lotId:id,type:'Creación',date:cutDate,title:batch.entersProduction?`Corte productivo de ${quantity} esquejes`:`Corte de ${quantity} esquejes · ${batch.purposeLabel}`,quantity,responsible:text(input.operator),notes:`Origen ${source.code}. ${text(input.notes)}`.trim()}
 return Object.freeze({organizationId,batch:Object.freeze(batch),units:Object.freeze(units),event:Object.freeze(event),retry:false})
}

function applyPrepared(current,prepared){
 if(prepared.retry)return current
 const{organizationId,batch}=prepared
 if(activeOrganizationId(current)!==organizationId)throw new Error('La organización activa cambió antes de confirmar el corte de propagación.')
 const existingBatch=activeBatchById(current,batch.id,organizationId)
 if(existingBatch){if(existingBatch.commandId===batch.commandId)return current;throw new Error('Colisión de batch durante el commit.')}
 assertTargetPermission(current,organizationId,batch.siteId)
 siteAndBank(current,{organizationId,siteId:batch.siteId,bankId:batch.bankId})
 const source=sourceForCut(current,{organizationId,siteId:batch.siteId,sourcePlantId:batch.sourcePlantId,at:batch.createdAt})
 if(source.geneticId!==batch.geneticId||source.plantType!==batch.sourcePlantType)throw new Error('La identidad agronómica de la planta de origen cambió antes de confirmar el corte.')
 const genetic=geneticProfilesForOrganization(current,organizationId).find(item=>item.id===batch.geneticId&&item.active)
 if(!genetic)throw new Error('La genética del corte dejó de estar activa antes del commit.')
 if((current.propagationBatches||[]).some(item=>sameTenant(item,organizationId)&&item.id!==batch.id&&item.code===batch.code))throw new Error('El código de lote colisionó antes de confirmar el corte.')
 const existingUnitIds=new Set((current.propagationUnits||[]).filter(unit=>sameTenant(unit,organizationId)).map(unit=>unit.id))
 if(prepared.units.some(unit=>existingUnitIds.has(unit.id)))throw new Error('Colisión de identidad de esqueje durante el commit.')
 if((current.lotEvents||[]).some(item=>item.id===prepared.event.id&&sameTenant(item,organizationId)))throw new Error('El evento de creación del corte ya existe dentro de la organización activa.')
 return{...current,propagationBatches:[...(current.propagationBatches||[]),batch],propagationUnits:[...(current.propagationUnits||[]),...prepared.units],lotEvents:[...(current.lotEvents||[]),prepared.event]}
}

export async function executePropagationBatchCommand(state,input={},deps={}){
 const commandId=text(input.commandId)||crypto.randomUUID(),occurredAt=input.occurredAt||new Date().toISOString()
 const prepared=preparePropagationBatch(state,input,{commandId,occurredAt})
 assertTargetPermission(state,prepared.organizationId,prepared.batch.siteId)
 if(prepared.retry)return Object.freeze({ok:true,retry:true,commandId,batch:prepared.batch,units:prepared.units})
 const publishEvent=deps.publishEvent||((event)=>publishDomainEvent(state,event)),commit=deps.commit
 if(typeof commit!=='function')throw new TypeError('commit es obligatorio para crear el corte.')
 await executeCoreOperationCommand({commandId,organizationId:prepared.organizationId,siteId:prepared.batch.siteId,aggregateType:'propagation-batch',aggregateId:prepared.batch.id,completedEventName:DomainEvents.PROPAGATION_BATCH_CREATED,occurredAt,payload:{code:prepared.batch.code,purpose:prepared.batch.purpose,quantity:prepared.batch.quantity,sourcePlantId:prepared.batch.sourcePlantId,bankId:prepared.batch.bankId},metadata:{module:'propagation',restrictionGuard:'mipe'},apply:current=>applyPrepared(current,prepared)},{publishEvent,commit})
 return Object.freeze({ok:true,retry:false,commandId,batch:prepared.batch,units:prepared.units})
}
