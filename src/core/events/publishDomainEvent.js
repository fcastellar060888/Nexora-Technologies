import{createDomainEvent}from'./eventContract.js'
import{eventBus}from'./eventBus.js'

export function activeActor(state){
 const user=(state.users||[]).find(item=>item.activeSession)
 return{id:user?.remoteId||user?.id||'system',name:user?.name||'Sistema'}
}

export function publishDomainEvent(state,{name,aggregateType,aggregateId,organizationId,siteId=null,payload={},metadata={}}){
 const actor=activeActor(state)
 const event=createDomainEvent({
  name,
  aggregateType,
  aggregateId,
  organizationId:organizationId||state.currentContext?.companyId||'local-installation',
  siteId,
  actorId:actor.id,
  payload,
  metadata:{...metadata,actorName:actor.name}
 })
 return eventBus.publish(event)
}
