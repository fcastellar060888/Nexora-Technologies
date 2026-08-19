import{observabilityViewForActiveOrganization}from'../../domain/observability.js'

const LABELS={
 'organization.company.created':['Configuración','Empresa creada'],
 'organization.company.updated':['Configuración','Empresa actualizada'],
 'organization.company.deleted':['Configuración','Empresa eliminada'],
 'organization.site.created':['Configuración','Sede creada'],
 'organization.site.updated':['Configuración','Sede actualizada'],
 'organization.site.deleted':['Configuración','Sede eliminada'],
 'identity.user.created':['Usuarios','Usuario creado'],
 'identity.user.activated':['Usuarios','Usuario activado'],
 'identity.user.deactivated':['Usuarios','Usuario desactivado'],
 'identity.user.deleted':['Usuarios','Usuario eliminado'],
 'identity.user.session_selected':['Usuarios','Sesión local cambiada']
}

export function domainEventToAuditEntry(event){
 const[module,action]=LABELS[event.name]||['Sistema',event.name]
 const label=event.payload?.label||event.payload?.name||event.aggregate.id
 return{
  id:event.eventId,
  createdAt:event.occurredAt,
  actor:event.metadata?.actorName||event.context.actorId||'Sistema',
  action,
  module,
  detail:String(label||''),
  collections:Array.isArray(event.metadata?.collections)?event.metadata.collections:[],
  eventName:event.name,
  aggregateType:event.aggregate.type,
  aggregateId:event.aggregate.id,
  organizationId:event.context.organizationId,
  siteId:event.context.siteId
 }
}

export function auditTrailForActiveOrganization(state){
 const view=observabilityViewForActiveOrganization(state)
 const byId=new Map()
 for(const entry of view.auditLog||[]){
  if(!entry?.id)continue
  byId.set(entry.id,{...entry,source:'generic-audit'})
 }
 for(const ledgerEntry of view.operationalLedgerEntries||[]){
  if(!ledgerEntry?.event?.eventId)continue
  const entry=domainEventToAuditEntry(ledgerEntry.event)
  byId.set(entry.id,{...entry,source:'operational-ledger',sequence:ledgerEntry.sequence,recordedAt:ledgerEntry.recordedAt})
 }
 return[...byId.values()].sort((a,b)=>{
  const at=Date.parse(a.createdAt||a.recordedAt||0)||0,bт=Date.parse(b.createdAt||b.recordedAt||0)||0
  return at-bт||String(a.id).localeCompare(String(b.id))
 })
}
