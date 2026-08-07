import{createDomainEvent}from'./eventContract.js'
import{getEventBusForScope}from'./eventBus.js'

export function activeActor(state){
 const user=(state.users||[]).find(item=>item.activeSession)
 return{id:user?.remoteId||user?.id||'system',name:user?.name||'Sistema'}
}

export function publishDomainEvent(state,{
 name,
 aggregateType,
 aggregateId,
 organizationId,
 siteId=null,
 payload={},
 metadata={},
 eventId,
 occurredAt,
 version=1,
 correlationId=null,
 causationId=null
}){
 const actor=activeActor(state)
 const resolvedOrganizationId=organizationId||state.currentContext?.companyId||'local-installation'
 const event=createDomainEvent({
  name,
  aggregateType,
  aggregateId,
  organizationId:resolvedOrganizationId,
  siteId,
  actorId:actor.id,
  payload,
  metadata:{...metadata,actorName:actor.name},
  eventId,
  occurredAt,
  version,
  correlationId,
  causationId
 })
 return getEventBusForScope({organizationId:resolvedOrganizationId,actorId:actor.id}).publish(event)
}
