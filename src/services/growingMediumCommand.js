import{DomainEvents,publishDomainEvent}from'../core/events/index.js'
import{activeOrganizationId}from'../domain/organizationOwnership.js'
import{createGrowingMediumProduct,createGrowingMediumFormula,nextGrowingMediumFormulaVersion,createGrowingMediumBatch,assignmentFromBatch,createReusePolicy,planReuseCycle,createPurchaseRequirement,REUSE_ACTIONS}from'../domain/growingMedium.js'
import{hasPermission}from'./permissions.js'
import{executeCoreOperationCommand}from'./coreOperationCommand.js'

export const GROWING_MEDIUM_OPERATIONS=Object.freeze({CREATE_PRODUCT:'CREATE_PRODUCT',UPDATE_PRODUCT:'UPDATE_PRODUCT',ARCHIVE_PRODUCT:'ARCHIVE_PRODUCT',CREATE_FORMULA:'CREATE_FORMULA',CREATE_FORMULA_VERSION:'CREATE_FORMULA_VERSION',REGISTER_BATCH:'REGISTER_BATCH',CREATE_ASSIGNMENT:'CREATE_ASSIGNMENT',ARCHIVE_ASSIGNMENT:'ARCHIVE_ASSIGNMENT',CREATE_REUSE_POLICY:'CREATE_REUSE_POLICY',RECORD_REUSE:'RECORD_REUSE',CREATE_PURCHASE_REQUIREMENT:'CREATE_PURCHASE_REQUIREMENT'})

const list=(state,key)=>Array.isArray(state?.[key])?state[key]:[]
const text=value=>String(value??'').trim()
const tenantItem=(items,id,organizationId,label)=>{const found=items.find(item=>item.id===id&&item.organizationId===organizationId);if(!found)throw new Error(`${label} no existe en la organización activa.`);return found}
const upsert=(items,value)=>items.some(item=>item.id===value.id&&item.organizationId===value.organizationId)?items.map(item=>item.id===value.id&&item.organizationId===value.organizationId?value:item):[...items,value]

function purchaseScopeAssignments(state,organizationId,input){
 const assignments=list(state,'growingMediumAssignments').filter(item=>item.organizationId===organizationId&&item.active!==false)
 const siteId=text(input.siteId),scopeType=text(input.scopeType||'SITE'),scopeId=text(input.scopeId||siteId)
 if(!siteId)throw new Error('siteId es obligatorio para planificar compra.')
 if(scopeType==='SITE')return assignments.filter(item=>item.siteId===siteId)
 if(scopeType==='BED')return assignments.filter(item=>item.siteId===siteId&&item.targetType==='BED'&&item.targetId===scopeId)
 if(scopeType==='TRAY')return assignments.filter(item=>item.siteId===siteId&&item.targetType==='TRAY'&&item.targetId===scopeId)
 if(scopeType==='HOUSE'){
  const bedIds=new Set(list(state,'beds').filter(item=>item.houseId===scopeId&&item.active!==false).map(item=>item.id))
  return assignments.filter(item=>item.siteId===siteId&&item.targetType==='BED'&&bedIds.has(item.targetId))
 }
 throw new Error('scopeType de requerimiento de compra inválido.')
}

function purchasePlans(state,organizationId,input){
 const assignments=purchaseScopeAssignments(state,organizationId,input)
 if(!assignments.length)throw new Error('No existen asignaciones activas para el alcance seleccionado.')
 return assignments.map(assignment=>{
  const policy=assignment.reusePolicyId?tenantItem(list(state,'growingMediumReusePolicies'),assignment.reusePolicyId,organizationId,'La política de reutilización'):null
  const plan=policy?planReuseCycle({assignment,policy,completedUses:assignment.currentUse}):{action:REUSE_ACTIONS.FULL_REPLACEMENT,reusedVolumeLiters:0,freshVolumeLiters:Number(assignment.volumeLiters),replacementPercent:100}
  return{assignmentId:assignment.id,targetType:assignment.targetType,targetId:assignment.targetId,batchId:assignment.batchId,supplierId:assignment.supplierId,supplierLot:assignment.supplierLot,action:plan.action,currentUse:assignment.currentUse,freshVolumeLiters:plan.freshVolumeLiters,reusedVolumeLiters:plan.reusedVolumeLiters}
 })
}

export async function executeGrowingMediumCommand(state,{operation,input={},entityId='',commandId=crypto.randomUUID(),occurredAt=new Date().toISOString()}={},deps={}){
 if(!hasPermission(state,'manage_cultivation'))throw new Error('No tienes permiso para administrar medios de cultivo.')
 const organizationId=activeOrganizationId(state),publishEvent=deps.publishEvent||((event)=>publishDomainEvent(state,event)),commit=deps.commit
 if(typeof commit!=='function')throw new TypeError('commit es obligatorio para ejecutar el comando de medio de cultivo.')
 let aggregateId=entityId||input.id||crypto.randomUUID(),eventName,payload,apply

 if(operation===GROWING_MEDIUM_OPERATIONS.CREATE_PRODUCT){
  const product=createGrowingMediumProduct({...input,id:aggregateId,organizationId})
  if(list(state,'growingMediumProducts').some(item=>item.organizationId===organizationId&&item.active!==false&&item.name.trim().toLowerCase()===product.name.trim().toLowerCase()))throw new Error('Ya existe un producto de medio activo con ese nombre en la organización.')
  eventName=DomainEvents.GROWING_MEDIUM_PRODUCT_CREATED;payload={productId:product.id,name:product.name,kind:product.kind};apply=current=>({...current,growingMediumProducts:upsert(list(current,'growingMediumProducts'),product)})
 }else if(operation===GROWING_MEDIUM_OPERATIONS.UPDATE_PRODUCT){
  const previous=tenantItem(list(state,'growingMediumProducts'),aggregateId,organizationId,'El producto'),product=createGrowingMediumProduct({...previous,...input,id:previous.id,organizationId})
  eventName=DomainEvents.GROWING_MEDIUM_PRODUCT_UPDATED;payload={productId:product.id,name:product.name,kind:product.kind};apply=current=>({...current,growingMediumProducts:upsert(list(current,'growingMediumProducts'),product)})
 }else if(operation===GROWING_MEDIUM_OPERATIONS.ARCHIVE_PRODUCT){
  const previous=tenantItem(list(state,'growingMediumProducts'),aggregateId,organizationId,'El producto'),product=Object.freeze({...previous,active:false,archivedAt:occurredAt})
  if(list(state,'growingMediumBatches').some(item=>item.organizationId===organizationId&&item.productId===aggregateId&&item.active!==false&&Number(item.availableVolumeLiters)>0))throw new Error('No puedes archivar un producto con batches activos disponibles.')
  eventName=DomainEvents.GROWING_MEDIUM_PRODUCT_ARCHIVED;payload={productId:product.id};apply=current=>({...current,growingMediumProducts:upsert(list(current,'growingMediumProducts'),product)})
 }else if(operation===GROWING_MEDIUM_OPERATIONS.CREATE_FORMULA){
  const formula=createGrowingMediumFormula({...input,id:aggregateId,organizationId})
  for(const component of formula.components)tenantItem(list(state,'growingMediumProducts'),component.productId,organizationId,'El componente de fórmula')
  eventName=DomainEvents.GROWING_MEDIUM_FORMULA_CREATED;payload={formulaId:formula.id,formulaKey:formula.formulaKey,name:formula.name,version:formula.version};apply=current=>({...current,growingMediumFormulas:upsert(list(current,'growingMediumFormulas'),formula)})
 }else if(operation===GROWING_MEDIUM_OPERATIONS.CREATE_FORMULA_VERSION){
  const previous=tenantItem(list(state,'growingMediumFormulas'),input.previousFormulaId,organizationId,'La fórmula anterior'),formula=nextGrowingMediumFormulaVersion(previous,{...input,id:aggregateId,createdAt:occurredAt})
  for(const component of formula.components)tenantItem(list(state,'growingMediumProducts'),component.productId,organizationId,'El componente de fórmula')
  if(list(state,'growingMediumFormulas').some(item=>item.organizationId===organizationId&&item.formulaKey===formula.formulaKey&&Number(item.version)===formula.version))throw new Error('Ya existe esa versión de la fórmula.')
  eventName=DomainEvents.GROWING_MEDIUM_FORMULA_UPDATED;payload={formulaId:formula.id,formulaKey:formula.formulaKey,version:formula.version,supersedesFormulaId:formula.supersedesFormulaId};apply=current=>({...current,growingMediumFormulas:[...list(current,'growingMediumFormulas'),formula]})
 }else if(operation===GROWING_MEDIUM_OPERATIONS.REGISTER_BATCH){
  const batch=createGrowingMediumBatch({...input,id:aggregateId,organizationId})
  if(batch.productId)tenantItem(list(state,'growingMediumProducts'),batch.productId,organizationId,'El producto del batch')
  if(batch.formulaId)tenantItem(list(state,'growingMediumFormulas'),batch.formulaId,organizationId,'La fórmula del batch')
  eventName=DomainEvents.GROWING_MEDIUM_BATCH_REGISTERED;payload={batchId:batch.id,supplierLot:batch.supplierLot,receivedVolumeLiters:batch.receivedVolumeLiters};apply=current=>({...current,growingMediumBatches:upsert(list(current,'growingMediumBatches'),batch)})
 }else if(operation===GROWING_MEDIUM_OPERATIONS.CREATE_REUSE_POLICY){
  const policy=createReusePolicy({...input,id:aggregateId,organizationId})
  eventName=DomainEvents.GROWING_MEDIUM_REUSE_POLICY_CREATED;payload={reusePolicyId:policy.id,replacementPercent:policy.replacementPercent,maxUses:policy.maxUses};apply=current=>({...current,growingMediumReusePolicies:upsert(list(current,'growingMediumReusePolicies'),policy)})
 }else if(operation===GROWING_MEDIUM_OPERATIONS.CREATE_ASSIGNMENT){
  const batch=tenantItem(list(state,'growingMediumBatches'),input.batchId,organizationId,'El batch'),assignment=assignmentFromBatch({...input,id:aggregateId,organizationId},batch)
  if(Number(batch.availableVolumeLiters)<assignment.volumeLiters)throw new Error('El batch no tiene volumen suficiente para la asignación.')
  if(assignment.reusePolicyId)tenantItem(list(state,'growingMediumReusePolicies'),assignment.reusePolicyId,organizationId,'La política de reutilización')
  eventName=DomainEvents.GROWING_MEDIUM_ASSIGNMENT_CREATED;payload={assignmentId:assignment.id,targetType:assignment.targetType,targetId:assignment.targetId,batchId:assignment.batchId,volumeLiters:assignment.volumeLiters,supplierLot:assignment.supplierLot,totalCost:assignment.totalCost,currency:assignment.currency}
  apply=current=>{
   if(list(current,'growingMediumAssignments').some(item=>item.id===assignment.id&&item.organizationId===organizationId))return current
   const currentBatch=tenantItem(list(current,'growingMediumBatches'),assignment.batchId,organizationId,'El batch')
   if(Number(currentBatch.availableVolumeLiters)<assignment.volumeLiters)throw new Error('El batch cambió y ya no tiene volumen suficiente.')
   const updatedBatch={...currentBatch,availableVolumeLiters:Number(currentBatch.availableVolumeLiters)-assignment.volumeLiters}
   return{...current,growingMediumAssignments:[...list(current,'growingMediumAssignments'),assignment],growingMediumBatches:upsert(list(current,'growingMediumBatches'),updatedBatch)}
  }
 }else if(operation===GROWING_MEDIUM_OPERATIONS.ARCHIVE_ASSIGNMENT){
  const previous=tenantItem(list(state,'growingMediumAssignments'),aggregateId,organizationId,'La asignación'),assignment=Object.freeze({...previous,active:false,archivedAt:occurredAt})
  eventName=DomainEvents.GROWING_MEDIUM_ASSIGNMENT_ARCHIVED;payload={assignmentId:assignment.id,targetType:assignment.targetType,targetId:assignment.targetId};apply=current=>({...current,growingMediumAssignments:upsert(list(current,'growingMediumAssignments'),assignment)})
 }else if(operation===GROWING_MEDIUM_OPERATIONS.RECORD_REUSE){
  const assignment=tenantItem(list(state,'growingMediumAssignments'),input.assignmentId,organizationId,'La asignación'),policy=tenantItem(list(state,'growingMediumReusePolicies'),assignment.reusePolicyId,organizationId,'La política de reutilización'),plan=planReuseCycle({assignment,policy,completedUses:input.completedUses})
  const cycle=Object.freeze({id:aggregateId,organizationId,siteId:assignment.siteId,assignmentId:assignment.id,completedUses:Number(input.completedUses??assignment.currentUse),action:plan.action,reusedVolumeLiters:plan.reusedVolumeLiters,freshVolumeLiters:plan.freshVolumeLiters,replacementPercent:plan.replacementPercent,responsibleId:text(input.responsibleId),recordedAt:occurredAt})
  eventName=DomainEvents.GROWING_MEDIUM_REUSE_RECORDED;payload={reuseCycleId:cycle.id,assignmentId:assignment.id,action:cycle.action,freshVolumeLiters:cycle.freshVolumeLiters,reusedVolumeLiters:cycle.reusedVolumeLiters};apply=current=>list(current,'growingMediumReuseCycles').some(item=>item.id===cycle.id&&item.organizationId===organizationId)?current:{...current,growingMediumReuseCycles:[...list(current,'growingMediumReuseCycles'),cycle],growingMediumAssignments:upsert(list(current,'growingMediumAssignments'),{...assignment,currentUse:plan.nextUse,updatedAt:occurredAt})}
 }else if(operation===GROWING_MEDIUM_OPERATIONS.CREATE_PURCHASE_REQUIREMENT){
  const plans=purchasePlans(state,organizationId,input),requirement=createPurchaseRequirement({...input,id:aggregateId,organizationId,plans,createdAt:occurredAt,createdBy:text(input.createdBy)})
  eventName=DomainEvents.GROWING_MEDIUM_PURCHASE_REQUIREMENT_CREATED;payload={purchaseRequirementId:requirement.id,siteId:requirement.siteId,scopeType:requirement.scopeType,scopeId:requirement.scopeId,periodStart:requirement.periodStart,periodEnd:requirement.periodEnd,baseVolumeLiters:requirement.baseVolumeLiters,reservePercent:requirement.reservePercent,requiredVolumeLiters:requirement.requiredVolumeLiters,assignmentIds:requirement.plans.map(plan=>plan.assignmentId)}
  apply=current=>list(current,'growingMediumPurchaseRequirements').some(item=>item.id===requirement.id&&item.organizationId===organizationId)?current:{...current,growingMediumPurchaseRequirements:[...list(current,'growingMediumPurchaseRequirements'),requirement]}
 }else throw new Error('Operación de medio de cultivo no soportada.')

 await executeCoreOperationCommand({commandId,organizationId,siteId:text(input.siteId)||null,aggregateType:'growing-medium',aggregateId,completedEventName:eventName,occurredAt,payload,metadata:{module:'growing-medium'},apply},{publishEvent,commit})
 return Object.freeze({ok:true,commandId,aggregateId,eventName})
}
