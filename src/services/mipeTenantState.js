import{assertMipeIncidentUsable,createExecutableMipeProductSnapshot}from'../domain/mipeCatalogAuthority.js'
import{MIPE_FINDING_STATES}from'../domain/mipeFindingWorkflow.js'
import{activeOrganizationId}from'../domain/organizationOwnership.js'
import{mergeIrrigationMirfeState}from'../domain/irrigationMirfeTenancy.js'
import{mergeMipeState,scopeMipeState}from'../domain/mipeTenancy.js'

const list=value=>Array.isArray(value)?value:[]
const text=value=>String(value??'').trim()
const TERMINAL_FINDINGS=new Set([MIPE_FINDING_STATES.RESOLVED,MIPE_FINDING_STATES.PLANT_REMOVED,MIPE_FINDING_STATES.FALSE_POSITIVE])
const stable=value=>JSON.stringify(value)

function unique(records,id,label){
 const matches=list(records).filter(item=>text(item?.id)===text(id))
 if(matches.length!==1)throw new Error(matches.length?`${label} tiene identidad duplicada dentro de la empresa activa.`:`No se encontró ${label} dentro de la empresa activa.`)
 return matches[0]
}
function newRecords(before,after){
 const ids=new Set(list(before).map(item=>text(item?.id)).filter(Boolean))
 return list(after).filter(item=>text(item?.id)&&!ids.has(text(item.id)))
}
function assertNewFindingAuthority(base,candidate,organizationId){
 for(const finding of newRecords(base.findings,candidate.findings)){
  const incident=unique(base.incidents,finding.incidentId,'la incidencia del Finding')
  assertMipeIncidentUsable(incident,{organizationId,at:finding.reportedAt||finding.createdAt||new Date().toISOString()})
 }
}
function assertFindingOpen(base,findingId,label){
 const finding=unique(base.findings,findingId,label)
 if(TERMINAL_FINDINGS.has(text(finding.status)))throw new Error(`${label} está cerrado en ${finding.status} y no admite nueva evidencia MIPE.`)
 return finding
}
function assertNewInterventionAuthority(base,candidate){
 for(const intervention of newRecords(base.mipeInterventions,candidate.mipeInterventions)){
  const finding=assertFindingOpen(base,intervention.findingId,'El Finding de la intervención')
  if(intervention.treatmentId){
   const treatment=unique(base.treatments,intervention.treatmentId,'el Treatment de la intervención')
   if(text(treatment.findingId)!==text(finding.id))throw new Error('El Treatment de la intervención dejó de pertenecer a su Finding antes del commit.')
  }
 }
}
function assertNewTreatmentAuthority(base,candidate,organizationId){
 for(const treatment of newRecords(base.treatments,candidate.treatments)){
  const finding=assertFindingOpen(base,treatment.findingId,'El Finding del Treatment')
  const snapshot=treatment.productSnapshot
  if(!snapshot)continue
  const product=unique(base.products,treatment.productId,'el producto del Treatment')
  const currentSnapshot=createExecutableMipeProductSnapshot(product,{organizationId,siteId:treatment.siteId||finding.siteId,at:snapshot.approvedAt||treatment.createdAt||new Date().toISOString(),requestedDoseUnit:snapshot.doseUnit||treatment.doseUnit})
  if(stable(currentSnapshot)!==stable(snapshot))throw new Error('El perfil técnico del Product cambió entre requested y commit; vuelve a preparar el Treatment.')
 }
}
function assertCandidateAuthority(base,candidate,organizationId){
 assertNewFindingAuthority(base,candidate,organizationId)
 assertNewInterventionAuthority(base,candidate)
 assertNewTreatmentAuthority(base,candidate,organizationId)
}

export function mutateMipeTenantState(current,recipe){
 const organizationId=activeOrganizationId(current)
 const tenantBase=scopeMipeState(current,organizationId)
 const tenantCandidate=typeof recipe==='function'?recipe(tenantBase):recipe
 assertCandidateAuthority(tenantBase,tenantCandidate,organizationId)
 const withMipe=mergeMipeState(current,tenantBase,tenantCandidate,organizationId)
 return mergeIrrigationMirfeState(withMipe,tenantBase,tenantCandidate,organizationId)
}
