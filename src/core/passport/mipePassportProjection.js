import{mipeFindingHistory,verifyMipeFindingHistory}from'../../domain/mipeFindingWorkflow.js'
import{mipeRecordOrganizationId,mipeRecordsForOrganization}from'../../domain/mipeTenancy.js'
import{explicitOrganizationId}from'../../domain/organizationOwnership.js'
import{irrigationMirfeRecordOrganizationId}from'../../domain/irrigationMirfeTenancy.js'
import{passportIndicator,passportRelationship}from'./passportDomainSources.js'

const list=value=>Array.isArray(value)?value:[]
const text=value=>String(value??'').trim()
const TERMINAL=new Set(['Resuelto','Falso positivo','Planta eliminada'])
const EXECUTED=new Set(['Ejecutado','EXECUTED'])
const TREATMENT_INTERVENTION_TYPES=new Set(['Tratamiento','TREATMENT'])

function targetOf(finding){
 const materialId=text(finding?.materialPlantId)||(text(finding?.targetType)==='MATERIAL_PLANT'?text(finding?.targetId):'')
 if(materialId)return{targetType:'MATERIAL_PLANT',targetId:materialId}
 const positionId=text(finding?.plantPositionId)||(text(finding?.targetType)==='POSITION'?text(finding?.targetId):'')
 if(positionId)return{targetType:'POSITION',targetId:positionId}
 if(text(finding?.entityType)==='materialPlant'&&text(finding?.entityId))return{targetType:'MATERIAL_PLANT',targetId:text(finding.entityId)}
 if(text(finding?.plantId)&&!text(finding?.plantPositionId))return{targetType:'MATERIAL_PLANT',targetId:text(finding.plantId)}
 return{targetType:'',targetId:''}
}
function uniqueById(records,label){const seen=new Set();for(const record of records){const id=text(record?.id);if(!id)throw new Error(`${label} sin id en la proyección MIPE.`);if(seen.has(id))throw new Error(`${label} tiene identidad duplicada dentro de la empresa activa.`);seen.add(id)}return records}
function mipeForOrganization(state,collection,organizationId){return mipeRecordsForOrganization(state,collection,organizationId)}
function passportInterventions(state,organizationId,findingIds){const owner=text(organizationId);return uniqueById(list(state?.mipeInterventions).filter(item=>findingIds.has(text(item?.findingId))&&(mipeRecordOrganizationId(state,'mipeInterventions',item)===owner||explicitOrganizationId(item)===owner)),'Intervention')}
function sharedById(state,collection,id,organizationId,label){const key=text(id);if(!key)return null;const owned=list(state?.[collection]).filter(item=>text(item?.id)===key&&irrigationMirfeRecordOrganizationId(state,collection,item)===organizationId);if(owned.length>1)throw new Error(`${label} tiene identidad duplicada dentro de la empresa activa.`);return owned[0]||null}
function mipeById(state,collection,id,organizationId,label){const key=text(id);if(!key)return null;const owned=list(state?.[collection]).filter(item=>text(item?.id)===key&&mipeRecordOrganizationId(state,collection,item)===organizationId);if(owned.length>1)throw new Error(`${label} tiene identidad duplicada dentro de la empresa activa.`);return owned[0]||null}
function iso(value){const raw=text(value);if(!raw||Number.isNaN(Date.parse(raw)))return'';return new Date(raw).toISOString()}
function sorted(values){return[...new Set(values.map(text).filter(Boolean))].sort()}
function relation(type,targetType,targetId,label,organizationId,extra={}){return passportRelationship(type,targetType,targetId,label,{targetOrganizationId:organizationId,...extra})}
function findingTargets(state,{organizationId,targetType,targetId}){return uniqueById(mipeForOrganization(state,'findings',organizationId).filter(item=>{const target=targetOf(item);return target.targetType===targetType&&target.targetId===targetId}),'Finding')}
function historyFor(finding){if(list(finding?.mipeHistory).length){const verification=verifyMipeFindingHistory(finding);if(!verification.valid)throw new Error(`El historial MIPE de Finding ${text(finding?.id)} no es íntegro: ${verification.errors.join(' ')}`)}return mipeFindingHistory(finding)}
function resolutionEvents(finding){return historyFor(finding).filter(event=>TERMINAL.has(text(event?.to)))}
function findingFieldAt(finding,field,at){
 const when=iso(at);let value=finding?.[field]
 if(!when)return text(value)
 const targetTime=Date.parse(when),history=historyFor(finding)
 for(let index=history.length-1;index>=0;index--){
  const event=history[index],change=event?.type==='CORRECTION'?event?.changes?.[field]:null,eventTime=Date.parse(event?.occurredAt||'')
  if(change&&Number.isFinite(eventTime)&&eventTime>targetTime)value=change.before
 }
 return text(value)
}
function addHistoricalIncidentUse(map,state,organizationId,incidentId,{findingId='',interventionId='',correctionEventId=''}={}){
 const id=text(incidentId);if(!id)return
 const incident=mipeById(state,'incidents',id,organizationId,'Incident histórico'),use=map.get(id)||{incident:null,findingIds:[],interventionIds:[],correctionEventIds:[]}
 if(incident)use.incident=incident
 if(text(findingId))use.findingIds.push(text(findingId))
 if(text(interventionId))use.interventionIds.push(text(interventionId))
 if(text(correctionEventId))use.correctionEventIds.push(text(correctionEventId))
 map.set(id,use)
}
function currentProductLabel(state,treatment,organizationId){const product=sharedById(state,'products',treatment?.productId,organizationId,'Product');return text(treatment?.productSnapshot?.name)||text(product?.name)||text(treatment?.productId)||'Producto MIPE'}
function lotLabel(state,treatment,organizationId){const lot=sharedById(state,'inventoryLots',treatment?.lotId,organizationId,'Lote de inventario');return text(lot?.lotNumber||lot?.code)||text(treatment?.lotId)||'Lote de inventario'}
function assertFindingSnapshot(intervention,finding){
 const snapshot=intervention?.findingSnapshot;if(!snapshot)return
 const findingId=text(intervention?.findingId),target=targetOf(finding),snapshotAt=intervention?.performedAt||intervention?.createdAt,incidentAt=findingFieldAt(finding,'incidentId',snapshotAt)
 if(text(snapshot.id)&&text(snapshot.id)!==findingId)throw new Error(`Intervention ${text(intervention?.id)} contiene un findingSnapshot de otro Finding.`)
 if(text(snapshot.incidentId)&&text(snapshot.incidentId)!==incidentAt)throw new Error(`Intervention ${text(intervention?.id)} contradice el Incident histórico de su Finding.`)
 if(text(snapshot.targetType)&&text(snapshot.targetType)!==target.targetType)throw new Error(`Intervention ${text(intervention?.id)} contradice el targetType de su Finding.`)
 if(text(snapshot.targetId)&&text(snapshot.targetId)!==target.targetId)throw new Error(`Intervention ${text(intervention?.id)} contradice el targetId de su Finding.`)
}
function assertTreatmentSnapshot(intervention,treatment){
 const snapshot=intervention?.treatmentSnapshot;if(!snapshot)return
 if(!text(intervention?.treatmentId))throw new Error(`Intervention ${text(intervention?.id)} contiene treatmentSnapshot sin treatmentId.`)
 for(const field of['id','productId','lotId'])if(text(snapshot?.[field])&&text(snapshot[field])!==text(treatment?.[field]))throw new Error(`Intervention ${text(intervention?.id)} contiene treatmentSnapshot contradictorio en ${field}.`)
}
function assertPositiveRestrictionWindow(startsAt,endsAt,label,treatmentId){if(Date.parse(endsAt)<=Date.parse(startsAt))throw new Error(`La ${label} MIPE de Treatment ${text(treatmentId)} contiene una ventana de restricción imposible.`)}
function restrictionRecords(finding,treatments){
 const rows=[]
 for(const treatment of treatments){
  if(!EXECUTED.has(text(treatment?.status)))continue
  const startsAt=iso(treatment?.executedAt||treatment?.updatedAt||treatment?.createdAt),reentryUntil=iso(treatment?.reentryUntil||finding?.reentryUntil)
  if(startsAt&&reentryUntil){assertPositiveRestrictionWindow(startsAt,reentryUntil,'reentrada',treatment.id);rows.push({id:`${treatment.id}:reentry`,type:'REENTRY',findingId:finding.id,treatmentId:treatment.id,startsAt,endsAt:reentryUntil,label:`Reentrada hasta ${reentryUntil}`})}
  const withdrawalUntil=iso(treatment?.harvestRestrictedUntil||finding?.harvestRestrictedUntil)
  if(startsAt&&withdrawalUntil){assertPositiveRestrictionWindow(startsAt,withdrawalUntil,'carencia',treatment.id);rows.push({id:`${treatment.id}:withdrawal`,type:'HARVEST_WITHDRAWAL',findingId:finding.id,treatmentId:treatment.id,startsAt,endsAt:withdrawalUntil,label:`Carencia hasta ${withdrawalUntil}`})}
 }
 if(finding?.restrictsPropagation===true){const startsAt=iso(finding?.reportedAt||finding?.createdAt),resolution=resolutionEvents(finding).at(-1),endsAt=iso(resolution?.occurredAt);if(startsAt)rows.push({id:`${finding.id}:propagation-block`,type:'PROPAGATION_BLOCK',findingId:finding.id,treatmentId:'',startsAt,endsAt,label:endsAt?`Bloqueo de propagación hasta ${endsAt}`:'Bloqueo de propagación MIPE'})}
 return rows
}

export function projectMipePassportTrace(state,{organizationId,targetType,targetId,includeTreatmentTimeline=false}={}){
 const owner=text(organizationId),type=text(targetType),id=text(targetId)
 if(!owner)throw new Error('organizationId es obligatorio para proyectar el Knowledge Graph MIPE.')
 if(!['POSITION','MATERIAL_PLANT'].includes(type))throw new Error('targetType no es válido para el Knowledge Graph MIPE.')
 if(!id)throw new Error('targetId es obligatorio para el Knowledge Graph MIPE.')
 const findings=findingTargets(state,{organizationId:owner,targetType:type,targetId:id}),findingIds=new Set(findings.map(item=>item.id)),findingsById=new Map(findings.map(item=>[text(item.id),item]))
 const allTreatments=uniqueById(mipeForOrganization(state,'treatments',owner).filter(item=>findingIds.has(text(item?.findingId))),'Treatment'),treatmentsById=new Map(allTreatments.map(item=>[text(item.id),item]))
 const allInterventions=passportInterventions(state,owner,findingIds)
 const relationships=[],timeline=[],incidentUses=new Map(),historicalIncidentUses=new Map(),productUses=new Map(),lotUses=new Map(),restrictions=[],resolutions=[]
 for(const finding of findings){
  const findingId=text(finding.id),reportedAt=iso(finding.reportedAt||finding.createdAt||finding.updatedAt),incidentId=text(finding.incidentId)
  relationships.push(relation('has_mipe_finding','mipe.finding',findingId,text(finding.type||finding.pest)||`Finding ${findingId}`,owner,{status:text(finding.status),severity:finding.severity??null,siteId:text(finding.siteId),reportedAt}))
  if(incidentId){const incident=mipeById(state,'incidents',incidentId,owner,'Incident'),current=incidentUses.get(incidentId)||{incident:null,findingIds:[],fallbackLabels:[]};if(incident)current.incident=incident;current.findingIds.push(findingId);current.fallbackLabels.push(text(finding.type||finding.pest));incidentUses.set(incidentId,current)}
  for(const event of historyFor(finding)){
   const occurredAt=iso(event?.occurredAt);if(!occurredAt)continue
   const previousIncidentId=event?.type==='CORRECTION'?text(event?.changes?.incidentId?.before):''
   if(previousIncidentId&&previousIncidentId!==incidentId)addHistoricalIncidentUse(historicalIncidentUses,state,owner,previousIncidentId,{findingId,correctionEventId:event.id})
   timeline.push({id:`mipekg:workflow:${event.id}`,sourceId:findingId,occurredAt,category:'MIPE workflow',type:text(event.type),title:event.type==='CORRECTION'?'Corrección auditable':event.type==='TRANSITION'?`MIPE: ${text(event.from)} → ${text(event.to)}`:'Hallazgo MIPE registrado',summary:text(event.notes||event.reason),status:text(event.to||finding.status),findingId,transition:text(event.transition),actor:event.actor||null})
   if(TERMINAL.has(text(event.to)))resolutions.push({id:text(event.id),findingId,status:text(event.to),occurredAt,transition:text(event.transition),notes:text(event.notes||event.reason),actor:event.actor||null,legacyImported:event.type==='IMPORTED'})
  }
  restrictions.push(...restrictionRecords(finding,allTreatments.filter(item=>text(item.findingId)===findingId)))
 }
 for(const[incidentId,use]of incidentUses){const label=text(use.incident?.name)||use.fallbackLabels.find(Boolean)||incidentId;relationships.push(relation('classified_by_mipe_incident','mipe.incident',incidentId,label,owner,{findingIds:sorted(use.findingIds),active:use.incident?use.incident.active!==false:null,catalogPresent:Boolean(use.incident)}))}
 for(const intervention of allInterventions){
  const interventionId=text(intervention.id),findingId=text(intervention.findingId),finding=findingsById.get(findingId)
  if(!finding)throw new Error(`Intervention ${interventionId} no tiene un Finding causal dentro del Passport.`)
  if(text(intervention.siteId)&&text(finding.siteId)&&text(intervention.siteId)!==text(finding.siteId))throw new Error(`Intervention ${interventionId} pertenece a otra sede que su Finding.`)
  assertFindingSnapshot(intervention,finding)
  const interventionAt=intervention.performedAt||intervention.createdAt,historicalIncidentId=findingFieldAt(finding,'incidentId',interventionAt)
  if(historicalIncidentId&&historicalIncidentId!==text(finding.incidentId))addHistoricalIncidentUse(historicalIncidentUses,state,owner,historicalIncidentId,{findingId,interventionId})
  const treatmentId=text(intervention.treatmentId)
  if(treatmentId){const treatment=treatmentsById.get(treatmentId);if(!treatment)throw new Error(`Intervention ${interventionId} referencia un Treatment ajeno a su cadena causal.`);if(text(treatment.findingId)!==findingId)throw new Error(`Intervention ${interventionId} referencia un Treatment de otro Finding.`);assertTreatmentSnapshot(intervention,treatment)}else{
   if(intervention.treatmentSnapshot)throw new Error(`Intervention ${interventionId} contiene treatmentSnapshot sin treatmentId.`)
   if(TREATMENT_INTERVENTION_TYPES.has(text(intervention.type)))throw new Error(`Intervention ${interventionId} de tipo Tratamiento requiere un Treatment canónico.`)
  }
  relationships.push(relation('has_mipe_intervention','mipe.intervention',interventionId,text(intervention.type)||`Intervention ${interventionId}`,owner,{findingId,treatmentId,incidentId:historicalIncidentId,performedAt:iso(intervention.performedAt),outcome:text(intervention.outcome),responsible:text(intervention.responsible||intervention.responsibleId)}))
  const occurredAt=iso(intervention.performedAt||intervention.createdAt);if(occurredAt)timeline.push({id:`mipekg:intervention:${interventionId}`,sourceId:interventionId,occurredAt,category:'MIPE intervention',type:text(intervention.type),title:text(intervention.type)||'Intervención MIPE',summary:text(intervention.outcome||intervention.notes),status:text(intervention.outcome),findingId,treatmentId,incidentId:historicalIncidentId})
 }
 for(const[incidentId,use]of historicalIncidentUses){relationships.push(relation('historically_classified_by_mipe_incident','mipe.incident',incidentId,text(use.incident?.name)||incidentId,owner,{findingIds:sorted(use.findingIds),interventionIds:sorted(use.interventionIds),correctionEventIds:sorted(use.correctionEventIds),active:use.incident?use.incident.active!==false:null,catalogPresent:Boolean(use.incident),historical:true}))}
 for(const treatment of allTreatments){
  const treatmentId=text(treatment.id),findingId=text(treatment.findingId),finding=findingsById.get(findingId),productId=text(treatment.productId),lotId=text(treatment.lotId),productLabel=currentProductLabel(state,treatment,owner)
  if(!finding)throw new Error(`Treatment ${treatmentId} no tiene un Finding causal dentro del Passport.`)
  if(text(treatment.siteId)&&text(finding.siteId)&&text(treatment.siteId)!==text(finding.siteId))throw new Error(`Treatment ${treatmentId} pertenece a otra sede que su Finding.`)
  relationships.push(relation('has_mipe_treatment','mipe.treatment',treatmentId,productLabel,owner,{findingId,status:text(treatment.status),productId,lotId,dose:treatment.dose??null,doseUnit:text(treatment.doseUnit),mixVolumeLiters:treatment.mixVolumeLiters??treatment.mixVolume??null,executedAt:iso(treatment.executedAt),productSnapshot:treatment.productSnapshot||null}))
  if(productId){const use=productUses.get(productId)||{labels:[],findingIds:[],treatmentIds:[],snapshots:[]};use.labels.push(productLabel);use.findingIds.push(findingId);use.treatmentIds.push(treatmentId);if(treatment.productSnapshot)use.snapshots.push(treatment.productSnapshot);productUses.set(productId,use)}
  if(lotId){const use=lotUses.get(lotId)||{findingIds:[],treatmentIds:[],label:lotLabel(state,treatment,owner)};use.findingIds.push(findingId);use.treatmentIds.push(treatmentId);lotUses.set(lotId,use)}
  if(includeTreatmentTimeline){const occurredAt=iso(treatment.executedAt||treatment.date||treatment.scheduledFor||treatment.createdAt);if(occurredAt)timeline.push({id:`mipekg:treatment:${treatmentId}`,sourceId:treatmentId,occurredAt,category:'MIPE treatment',type:'Tratamiento',title:productLabel,summary:text(treatment.executionNotes||treatment.notes||`${treatment.totalQuantity||0} ${treatment.inventoryUnit||''}`),status:text(treatment.status),findingId,productId,lotId})}
 }
 for(const[productId,use]of productUses)relationships.push(relation('treated_with_product','inventory.product',productId,use.labels[0]||productId,owner,{findingIds:sorted(use.findingIds),treatmentIds:sorted(use.treatmentIds),historicalSnapshots:use.snapshots}))
 for(const[lotId,use]of lotUses)relationships.push(relation('consumed_from_inventory_lot','inventory.lot',lotId,use.label||lotId,owner,{findingIds:sorted(use.findingIds),treatmentIds:sorted(use.treatmentIds)}))
 for(const restriction of restrictions){relationships.push(relation('generated_mipe_restriction','mipe.restriction',restriction.id,restriction.label,owner,{restrictionType:restriction.type,findingId:restriction.findingId,treatmentId:restriction.treatmentId,startsAt:restriction.startsAt,endsAt:restriction.endsAt||null}));timeline.push({id:`mipekg:restriction:${restriction.id}`,sourceId:restriction.id,occurredAt:restriction.startsAt,category:'MIPE restriction',type:restriction.type,title:restriction.label,summary:restriction.endsAt?`Vigencia hasta ${restriction.endsAt}`:'Sin fin hasta resolución',status:restriction.endsAt?'bounded':'open',findingId:restriction.findingId,treatmentId:restriction.treatmentId})}
 for(const resolution of resolutions)relationships.push(relation('resolved_mipe_finding','mipe.resolution',resolution.id,`${resolution.status} · ${resolution.findingId}`,owner,{findingId:resolution.findingId,status:resolution.status,occurredAt:resolution.occurredAt,transition:resolution.transition,notes:resolution.notes,actor:resolution.actor,legacyImported:resolution.legacyImported}))
 const indicators=[passportIndicator('mipe_graph_findings',findings.length,'findings'),passportIndicator('mipe_graph_interventions',allInterventions.length,'interventions'),passportIndicator('mipe_graph_treatments',allTreatments.length,'treatments'),passportIndicator('mipe_graph_restrictions',restrictions.length,'restrictions'),passportIndicator('mipe_graph_resolutions',resolutions.length,'resolutions')]
 return Object.freeze({relationships:Object.freeze(relationships),timeline:Object.freeze(timeline),indicators:Object.freeze(indicators),summary:Object.freeze({findingIds:sorted(findings.map(item=>item.id)),interventionIds:sorted(allInterventions.map(item=>item.id)),treatmentIds:sorted(allTreatments.map(item=>item.id)),restrictionIds:sorted(restrictions.map(item=>item.id)),resolutionIds:sorted(resolutions.map(item=>item.id))})})
}