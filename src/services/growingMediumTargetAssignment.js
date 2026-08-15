import{createGrowingMediumAssignment}from'../domain/growingMedium.js'
import{activeOrganizationId}from'../domain/organizationOwnership.js'
import{hasPermission}from'./permissions.js'
import{executeCoreOperationCommand}from'./coreOperationCommand.js'
import{DomainEvents,publishDomainEvent}from'../core/events/index.js'

const list=(state,key)=>Array.isArray(state?.[key])?state[key]:[]
const text=value=>String(value??'').trim()
const tenantItem=(items,id,organizationId,label)=>{const item=items.find(value=>value.id===id&&value.organizationId===organizationId);if(!item)throw new Error(`${label} no existe en la organización activa.`);return item}
const upsert=(items,value)=>items.some(item=>item.id===value.id&&item.organizationId===value.organizationId)?items.map(item=>item.id===value.id&&item.organizationId===value.organizationId?value:item):[...items,value]

export async function executeGrowingMediumTargetAssignment(state,{targetType,targetId,siteId,batchId,volumeLiters,reusePolicyId='',assignmentId='',commandId=crypto.randomUUID(),occurredAt=new Date().toISOString(),completedEventName=DomainEvents.GROWING_MEDIUM_ASSIGNMENT_CREATED,applyTarget}={},deps={}){
 if(!hasPermission(state,'manage_cultivation'))throw new Error('No tienes permiso para asignar medios de cultivo.')
 const organizationId=activeOrganizationId(state)
 if(typeof applyTarget!=='function')throw new TypeError('applyTarget es obligatorio.')
 const batch=tenantItem(list(state,'growingMediumBatches'),batchId,organizationId,'El batch')
 if(batch.active===false)throw new Error('El batch de medio está archivado.')
 if(reusePolicyId)tenantItem(list(state,'growingMediumReusePolicies'),reusePolicyId,organizationId,'La política de reutilización')
 const assignment=createGrowingMediumAssignment({id:assignmentId||`${commandId}:assignment`,organizationId,siteId,targetType,targetId,batchId,volumeLiters,reusePolicyId,assignedAt:occurredAt})
 if(Number(batch.availableVolumeLiters)<assignment.volumeLiters)throw new Error('El batch no tiene volumen suficiente para la asignación.')
 const publishEvent=deps.publishEvent||((event)=>publishDomainEvent(state,event)),commit=deps.commit
 if(typeof commit!=='function')throw new TypeError('commit es obligatorio para asignar medio de cultivo.')
 await executeCoreOperationCommand({
  commandId,organizationId,siteId,aggregateType:'growing-medium-assignment',aggregateId:assignment.id,completedEventName,occurredAt,
  payload:{assignmentId:assignment.id,targetType,targetId,batchId,volumeLiters:assignment.volumeLiters},metadata:{module:'growing-medium'},
  apply:current=>{
   if(list(current,'growingMediumAssignments').some(item=>item.id===assignment.id&&item.organizationId===organizationId))return current
   const currentBatch=tenantItem(list(current,'growingMediumBatches'),batchId,organizationId,'El batch')
   if(Number(currentBatch.availableVolumeLiters)<assignment.volumeLiters)throw new Error('El batch cambió y ya no tiene volumen suficiente.')
   const nextBatch={...currentBatch,availableVolumeLiters:Number(currentBatch.availableVolumeLiters)-assignment.volumeLiters}
   const withMedium={...current,growingMediumAssignments:[...list(current,'growingMediumAssignments'),assignment],growingMediumBatches:upsert(list(current,'growingMediumBatches'),nextBatch)}
   return applyTarget(withMedium,assignment)
  }
 },{publishEvent,commit})
 return Object.freeze({ok:true,commandId,assignment})
}

export function growingMediumLabel(state,assignment){
 if(!assignment)return''
 const batch=list(state,'growingMediumBatches').find(item=>item.id===assignment.batchId&&item.organizationId===assignment.organizationId)
 if(!batch)return''
 const product=batch.productId?list(state,'growingMediumProducts').find(item=>item.id===batch.productId&&item.organizationId===assignment.organizationId):null
 const formula=batch.formulaId?list(state,'growingMediumFormulas').find(item=>item.id===batch.formulaId&&item.organizationId===assignment.organizationId):null
 return text(product?.name||formula?.name||batch.supplierLot)
}
