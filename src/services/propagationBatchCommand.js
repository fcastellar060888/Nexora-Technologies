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

export function preparePropagationBatch(state,input={}, {commandId,occurredAt=new Date().toISOString()}={}){
 const organizationId=activeOrganizationId(state)
 const id=text(input.batchId||commandId)
 if(!id)throw new Error('commandId o batchId es obligatorio para crear el corte.')
 const siteId=text(input.siteId),bankId=text(input.bankId),sourcePlantId=text(input.sourcePlantId),geneticId=text(input.geneticId)
 const quantity=positive(input.quantity)
 if(!siteId||!bankId||!sourcePlantId)throw new Error('Sede, banco y planta de origen son obligatorios.')
 if(quantity<=0)throw new Error('La cantidad debe ser mayor que cero.')
 const site=(state.sites||[]).find(item=>item.id===siteId&&sameTenant(item,organizationId))
 if(!site||resolveOrganizationId(state,{record:site,label:'la sede'})!==organizationId)throw new Error('La sede no pertenece a la organización activa.')
 const bank=(state.propagationBanks||[]).find(item=>item.id===bankId&&item.active!==false&&item.siteId===siteId&&sameTenant(item,organizationId))
 if(!bank||resolveOrganizationId(state,{record:bank,siteId,label:'el banco'})!==organizationId)throw new Error('El banco no pertenece a la sede y organización activas.')
 const source=propagationSourceUnits(state,{organizationId,siteId}).find(item=>item.id===sourcePlantId)
 if(!source)throw new Error('La planta de origen no es elegible dentro de la organización y sede activas.')
 assertMipeOperationAllowed(state,{operation:MIPE_RESTRICTED_OPERATIONS.PROPAGATION_CUT,targetType:'MATERIAL_PLANT',targetId:source.id,organizationId,at:occurredAt})
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
 const collision=(state.propagationBatches||[]).find(item=>item.id===id)
 if(collision){
  if(explicitOrganizationId(collision)&&explicitOrganizationId(collision)!==organizationId)throw new Error('El identificador del batch ya pertenece a otra organización.')
  if(collision.commandId===commandId)return Object.freeze({organizationId,batch:collision,units:(state.propagationUnits||[]).filter(unit=>unit.batchId===id&&sameTenant(unit,organizationId)),event:null,retry:true})
  throw new Error('El identificador del batch ya existe con otra operación.')
 }
 if((state.propagationBatches||[]).some(item=>sameTenant(item,organizationId)&&item.code===code))throw new Error('Ese código de lote ya existe en la organización.')
 const rawUnits=Array.from({length:quantity},(_,index)=>({id:`${id}:clone:${index+1}`,organizationId,batchId:id,code:`${code}-E${String(index+1).padStart(4,'0')}`,status:'Cortado',cutDate,rootDate:'',discardDate:'',discardReason:'',plantPositionId:'',sourcePlantId:source.id,purpose,targetLifecycleStage:''}))
 const allocated=allocateUnitsToBank(rawUnits,bank,(state.propagationUnits||[]).filter(unit=>sameTenant(unit,organizationId)))
 const base={id,commandId,organizationId,code,createdAt:occurredAt,phase:'Propagación',phaseStartedAt:cutDate,activeQuantity:quantity,geneticId:resolvedGeneticId,siteId,bankId:bank.id,cutDate,sequence,quantity,substrate:text(input.substrate),hormone:text(input.hormone),operator:text(input.operator),expectedRootDate:text(input.expectedRootDate),notes:text(input.notes),motherPlantId:source.plantType==='MOTHER'?source.lotId:'',authorizedGrandmotherProduction:directGrandmotherProduction&&input.authorizedGrandmotherProduction===true}
 const batch=createPurposeAwareBatch(base,{sourceUnit:source,purpose,productionLotId:text(input.productionLotId),organizationId})
 const units=allocated.map(unit=>({...unit,organizationId,purpose:batch.purpose,targetLifecycleStage:batch.targetLifecycleStage,entersProduction:batch.entersProduction,directParentPlantId:source.id,geneticId:resolvedGeneticId,siteId}))
 const event={id:`${id}:created`,organizationId,lotId:id,type:'Creación',date:cutDate,title:batch.entersProduction?`Corte productivo de ${quantity} esquejes`:`Corte de ${quantity} esquejes · ${batch.purposeLabel}`,quantity,responsible:text(input.operator),notes:`Origen ${source.code}. ${text(input.notes)}`.trim()}
 return Object.freeze({organizationId,batch:Object.freeze(batch),units:Object.freeze(units),event:Object.freeze(event),retry:false})
}

function applyPrepared(current,prepared){
 if(prepared.retry)return current
 const existingBatch=(current.propagationBatches||[]).find(item=>item.id===prepared.batch.id&&sameTenant(item,prepared.organizationId))
 if(existingBatch){if(existingBatch.commandId===prepared.batch.commandId)return current;throw new Error('Colisión de batch durante el commit.')}
 const existingUnitIds=new Set((current.propagationUnits||[]).filter(unit=>sameTenant(unit,prepared.organizationId)).map(unit=>unit.id))
 if(prepared.units.some(unit=>existingUnitIds.has(unit.id)))throw new Error('Colisión de identidad de esqueje durante el commit.')
 return{...current,propagationBatches:[...(current.propagationBatches||[]),prepared.batch],propagationUnits:[...(current.propagationUnits||[]),...prepared.units],lotEvents:[...(current.lotEvents||[]),prepared.event]}
}

export async function executePropagationBatchCommand(state,input={},deps={}){
 if(!hasPermission(state,'manage_cultivation'))throw new Error('No tienes permiso para crear cortes de propagación.')
 const commandId=text(input.commandId)||crypto.randomUUID(),occurredAt=input.occurredAt||new Date().toISOString()
 const prepared=preparePropagationBatch(state,input,{commandId,occurredAt})
 if(prepared.retry)return Object.freeze({ok:true,retry:true,commandId,batch:prepared.batch,units:prepared.units})
 const publishEvent=deps.publishEvent||((event)=>publishDomainEvent(state,event)),commit=deps.commit
 if(typeof commit!=='function')throw new TypeError('commit es obligatorio para crear el corte.')
 await executeCoreOperationCommand({commandId,organizationId:prepared.organizationId,siteId:prepared.batch.siteId,aggregateType:'propagation-batch',aggregateId:prepared.batch.id,completedEventName:DomainEvents.PROPAGATION_BATCH_CREATED,occurredAt,payload:{code:prepared.batch.code,purpose:prepared.batch.purpose,quantity:prepared.batch.quantity,sourcePlantId:prepared.batch.sourcePlantId,bankId:prepared.batch.bankId},metadata:{module:'propagation'},apply:current=>applyPrepared(current,prepared)},{publishEvent,commit})
 return Object.freeze({ok:true,retry:false,commandId,batch:prepared.batch,units:prepared.units})
}
