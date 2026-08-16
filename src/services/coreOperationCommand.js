import{DomainEvents,isKnownDomainEvent}from'../core/events/eventCatalog.js'

const text=value=>String(value??'').trim()
const plainObject=value=>value&&typeof value==='object'&&!Array.isArray(value)

function normalizeSpec(input={}){
 const commandId=text(input.commandId),organizationId=text(input.organizationId),aggregateType=text(input.aggregateType),aggregateId=text(input.aggregateId),completedEventName=text(input.completedEventName),siteId=text(input.siteId)||null
 if(!commandId)throw new Error('commandId es obligatorio.')
 if(!organizationId)throw new Error('organizationId es obligatorio.')
 if(!aggregateType||!aggregateId)throw new Error('aggregateType y aggregateId son obligatorios.')
 if(!isKnownDomainEvent(completedEventName)||completedEventName===DomainEvents.CORE_OPERATION_REQUESTED)throw new Error('completedEventName no pertenece al catálogo de eventos finales.')
 if(typeof input.apply!=='function')throw new TypeError('apply es obligatorio y debe ser función idempotente.')
 return Object.freeze({commandId,organizationId,siteId,aggregateType,aggregateId,completedEventName,occurredAt:input.occurredAt||new Date().toISOString(),payload:plainObject(input.payload)?input.payload:{},metadata:plainObject(input.metadata)?input.metadata:{},prepareCommit:typeof input.prepareCommit==='function'?input.prepareCommit:null,commitMeta:plainObject(input.commitMeta)?input.commitMeta:{},apply:input.apply})
}

function eventSpec(spec,phase){
 const requested=phase==='requested'
 return{
  name:requested?DomainEvents.CORE_OPERATION_REQUESTED:spec.completedEventName,
  aggregateType:spec.aggregateType,
  aggregateId:spec.aggregateId,
  organizationId:spec.organizationId,
  siteId:spec.siteId,
  eventId:`${spec.commandId}:${phase}`,
  occurredAt:spec.occurredAt,
  correlationId:spec.commandId,
  causationId:requested?null:`${spec.commandId}:requested`,
  payload:requested?{commandId:spec.commandId,completedEventName:spec.completedEventName,operationPayload:spec.payload}:{commandId:spec.commandId,...spec.payload},
  metadata:{source:'m1.1-core-operation-command',...spec.metadata}
 }
}

export async function executeCoreOperationCommand(input,{publishEvent,commit}={}){
 if(typeof publishEvent!=='function')throw new TypeError('publishEvent es obligatorio.')
 if(typeof commit!=='function')throw new TypeError('commit es obligatorio.')
 const spec=normalizeSpec(input)
 await publishEvent(eventSpec(spec,'requested'))
 const confirmation=spec.prepareCommit?await spec.prepareCommit():null
 commit(current=>spec.apply(current,confirmation),{...spec.commitMeta,audit:false})
 await publishEvent(eventSpec(spec,'completed'))
 return Object.freeze({ok:true,commandId:spec.commandId,aggregateId:spec.aggregateId})
}
