const LABELS={
 'organization.company.created':{title:'Empresa creada',category:'Organización',tone:'success'},
 'organization.company.updated':{title:'Empresa actualizada',category:'Organización',tone:'info'},
 'organization.company.deleted':{title:'Empresa eliminada',category:'Organización',tone:'danger'},
 'organization.site.created':{title:'Sede creada',category:'Organización',tone:'success'},
 'organization.site.updated':{title:'Sede actualizada',category:'Organización',tone:'info'},
 'organization.site.deleted':{title:'Sede eliminada',category:'Organización',tone:'danger'},
 'identity.user.created':{title:'Usuario creado',category:'Identidad',tone:'success'},
 'identity.user.activated':{title:'Usuario activado',category:'Identidad',tone:'success'},
 'identity.user.deactivated':{title:'Usuario desactivado',category:'Identidad',tone:'warning'},
 'identity.user.deleted':{title:'Usuario eliminado',category:'Identidad',tone:'danger'},
 'identity.user.session_selected':{title:'Perfil local seleccionado',category:'Identidad',tone:'info'},
 'cultivation.lot.created':{title:'Lote creado',category:'Cultivo',tone:'success'},
 'cultivation.lot.phase_changed':{title:'Cambio de fase',category:'Cultivo',tone:'info'},
 'mipe.finding.recorded':{title:'Hallazgo MIPE registrado',category:'MIPE',tone:'warning'},
 'mirfe.application.completed':{title:'Aplicación MIRFE completada',category:'MIRFE',tone:'success'},
 'inventory.movement.recorded':{title:'Movimiento de inventario',category:'Inventario',tone:'info'},
 'production.stage.completed':{title:'Etapa productiva completada',category:'Producción',tone:'success'}
}

function summaryFor(event){
 return String(event.payload?.summary||event.payload?.label||event.payload?.name||event.aggregate.id||'')
}

export function domainEventToTimelineEntry(event){
 const presentation=LABELS[event.name]||{title:event.name,category:'Sistema',tone:'neutral'}
 return Object.freeze({
  id:event.eventId,
  eventName:event.name,
  version:event.version,
  occurredAt:event.occurredAt,
  title:presentation.title,
  summary:summaryFor(event),
  category:presentation.category,
  tone:event.metadata?.tone||presentation.tone,
  actorId:event.context.actorId,
  actorName:event.metadata?.actorName||event.context.actorId||'Sistema',
  organizationId:event.context.organizationId,
  siteId:event.context.siteId,
  aggregateType:event.aggregate.type,
  aggregateId:event.aggregate.id,
  correlationId:event.correlationId,
  causationId:event.causationId,
  payload:event.payload,
  metadata:event.metadata
 })
}
