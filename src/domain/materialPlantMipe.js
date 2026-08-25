import{applyMaterialPlantUnitPatch}from'./materialPlantActions.js'
import{assertMipeIncidentUsable}from'./mipeCatalogAuthority.js'

const list=value=>Array.isArray(value)?value:[]
const required=value=>String(value||'').trim()
const organizationOf=value=>required(value?.organizationId||value?.companyId||value?._organizationId)
const closedStatuses=new Set(['Resuelto','Falso positivo','Planta eliminada'])

export const MIPE_BLOCKING_SEVERITIES=Object.freeze(['Crítica'])
export const MIPE_RESTRICTED_AVAILABILITY='Bloqueada por MIPE'
export const MIPE_RELEASED_AVAILABILITY='Disponible para corte'
export const MIPE_INTERVENTION_TYPES=Object.freeze({TREATMENT:'Tratamiento',FOLLOW_UP:'Seguimiento'})

function findingByIdentity(state,findingId,organizationId=''){
 const id=required(findingId),owner=required(organizationId),matches=list(state?.findings).filter(item=>item.id===id&&(!owner||organizationOf(item)===owner))
 if(matches.length>1)throw new Error('El hallazgo MIPE tiene identidad duplicada o ambigua entre organizaciones.')
 return matches[0]||null
}
function tenantFiltered(records,organizationId,label){
 const owner=required(organizationId)
 if(owner)return records.filter(item=>organizationOf(item)===owner)
 const owners=new Set(records.map(organizationOf).filter(Boolean))
 if(owners.size>1)throw new Error(`${label} es ambiguo entre organizaciones; especifica organizationId.`)
 return records
}
function stableFactory(candidate,fallback,label){const factory=typeof candidate==='function'?candidate:fallback;return(...args)=>{const id=required(factory(...args));if(!id)throw new Error(`${label} requiere una identidad estable.`);return id}}
function idPart(value){const normalized=required(value);return`${normalized.length}-${normalized}`}
function sameTenantIdentity(record,candidate){const owner=organizationOf(record),candidateOwner=organizationOf(candidate);return record?.id===candidate?.id&&owner===candidateOwner}
function creationEvidence(record){return JSON.stringify({organizationId:organizationOf(record),materialPlantId:required(record?.materialPlantId),targetType:required(record?.targetType),targetId:required(record?.targetId),incidentId:required(record?.incidentId),type:required(record?.type),severity:required(record?.severity),notes:required(record?.notes),reportedAt:required(record?.reportedAt),siteId:required(record?.siteId),plantType:required(record?.plantType),lotId:required(record?.lotId),unitIndex:Number(record?.unitIndex??0),restrictsPropagation:record?.restrictsPropagation===true})}
function assertReplayCompatible(existing,record){if(creationEvidence(existing)!==creationEvidence(record))throw new Error(`El Finding ${record.id} colisiona con evidencia MIPE diferente dentro de la empresa.`)}
function assertMaterialIncidentAuthority(state,targets,draft){
 const incidentId=required(draft?.incidentId)
 if(!incidentId||!Array.isArray(state?.incidents))return
 const owners=[...new Set(list(targets).map(organizationOf).filter(Boolean))]
 if(owners.length>1)throw new Error('El batch MIPE material mezcla plantas de organizaciones distintas.')
 const targetOwner=owners[0]||'',matches=list(state.incidents).filter(item=>item?.id===incidentId&&(!targetOwner||organizationOf(item)===targetOwner))
 if(matches.length!==1)throw new Error(matches.length?'La incidencia del batch material tiene identidad duplicada dentro de la empresa activa.':'No se encontró la incidencia del batch material dentro de la empresa activa.')
 const organizationId=targetOwner||organizationOf(matches[0])
 if(!organizationId)throw new Error('No se pudo resolver la organización de la incidencia del batch material.')
 assertMipeIncidentUsable(matches[0],{organizationId,at:draft?.reportedAt||new Date().toISOString()})
}

export function shouldSuggestMipeBlock(severity){return MIPE_BLOCKING_SEVERITIES.includes(required(severity))}
export function isOpenMipeFinding(finding){return Boolean(finding)&&!closedStatuses.has(finding.status)}
export function openBlockingMipeFindings(state,plantId,{excludeFindingId='',organizationId=''}={}){
 const candidates=list(state?.findings).filter(item=>item.materialPlantId===plantId&&item.id!==excludeFindingId&&item.restrictsPropagation===true&&isOpenMipeFinding(item))
 return tenantFiltered(candidates,organizationId,'Los hallazgos bloqueantes MIPE')
}
export function interventionsForFinding(state,findingId,{organizationId=''}={}){
 const candidates=list(state?.mipeInterventions).filter(item=>item.findingId===findingId)
 return tenantFiltered(candidates,organizationId,'Las intervenciones MIPE').sort((a,b)=>Date.parse(b.performedAt)-Date.parse(a.performedAt))
}

export function createMaterialPlantFindingRecords(plants,{incidentId='',type,severity='Media',notes='',reportedAt=new Date().toISOString(),restrictAvailability=false,idFactory=null}={}){
 const targets=list(plants).filter(Boolean),findingType=required(type),canonicalIncidentId=required(incidentId)
 if(!targets.length)throw new Error('Selecciona al menos una planta para registrar MIPE')
 if(!findingType)throw new Error('El tipo de hallazgo MIPE es obligatorio')
 if(Number.isNaN(Date.parse(reportedAt)))throw new Error('La fecha del hallazgo MIPE no es válida')
 const when=new Date(reportedAt).toISOString(),makeId=stableFactory(idFactory,(plant,index)=>`mipe-material-finding:${idPart(organizationOf(plant)||'legacy')}:${idPart(plant?.id)}:${idPart(canonicalIncidentId||findingType)}:${idPart(when)}:${index}`,'El Finding material'),normalizedSeverity=required(severity)||'Media',normalizedNotes=required(notes)
 return targets.map((plant,index)=>({id:makeId(plant,index),...(organizationOf(plant)?{organizationId:organizationOf(plant)}:{}),incidentId:canonicalIncidentId||null,targetType:'MATERIAL_PLANT',targetId:plant.id,materialPlantId:plant.id,entityType:'materialPlant',entityId:plant.id,plantId:plant.id,type:findingType,severity:normalizedSeverity,status:'Detectado',notes:normalizedNotes,reportedAt:when,reportDate:when,source:'material-plant-action',plantType:plant.plantType,lotId:plant.lotId,siteId:plant.siteId||null,unitIndex:plant.unitIndex,plantCode:plant.code||plant.id,restrictsPropagation:Boolean(restrictAvailability),operationalAction:restrictAvailability?MIPE_RESTRICTED_AVAILABILITY:''}))
}

export function appendMaterialPlantFindings(state,plants,draft={}){
 const targets=list(plants).filter(Boolean)
 assertMaterialIncidentAuthority(state,targets,draft)
 const records=createMaterialPlantFindingRecords(targets,draft),existing=list(state?.findings),replays=[]
 for(const record of records){
  const sameOwner=existing.filter(item=>sameTenantIdentity(record,item)),unownedHomonyms=existing.filter(item=>item?.id===record.id&&!organizationOf(item)&&organizationOf(record))
  if(sameOwner.length>1||unownedHomonyms.length)throw new Error(`El Finding ${record.id} tiene identidad duplicada o ambigua dentro de la empresa.`)
  if(sameOwner.length){assertReplayCompatible(sameOwner[0],record);replays.push(record.id)}
 }
 if(replays.length){if(replays.length!==records.length)throw new Error('El batch MIPE material presenta evidencia parcial de un replay previo.');return state}
 let next={...state,findings:[...existing,...records]}
 if(!draft?.restrictAvailability)return next
 next=applyMaterialPlantUnitPatch(next,targets,{operationalAvailability:MIPE_RESTRICTED_AVAILABILITY})
 const createdAt=new Date(draft.reportedAt||new Date().toISOString()).toISOString(),makeEventId=stableFactory(draft.availabilityEventIdFactory,(plant,index)=>`mipe-material-block:${idPart(organizationOf(plant)||'legacy')}:${idPart(plant?.id)}:${idPart(required(draft.incidentId)||required(draft.type)||'mipe')}:${idPart(createdAt)}:${index}`,'El evento de bloqueo MIPE'),events=targets.map((plant,index)=>({id:makeEventId(plant,index),...(organizationOf(plant)?{organizationId:organizationOf(plant)}:{}),siteId:plant.siteId||null,plantId:plant.id,entityId:plant.id,type:'Disponibilidad operativa',title:'Planta bloqueada por MIPE',detail:`Hallazgo ${required(draft.type)} · Severidad ${required(draft.severity)||'Media'}`,date:createdAt,createdAt,source:'mipe-operational-rule'}))
 for(const event of events){const owner=organizationOf(event),matches=list(next.plantEvents).filter(item=>item?.id===event.id&&organizationOf(item)===owner),ambiguous=list(next.plantEvents).filter(item=>item?.id===event.id&&!organizationOf(item)&&owner);if(matches.length||ambiguous.length)throw new Error(`El evento ${event.id} colisiona con evidencia operacional existente.`)}
 return{...next,plantEvents:[...list(next.plantEvents),...events]}
}

export function appendMipeIntervention(state,{findingId,organizationId='',type=MIPE_INTERVENTION_TYPES.TREATMENT,product='',dose='',responsible='',outcome='',notes='',performedAt=new Date().toISOString(),nextReviewAt=''}={}){
 if(!findingId)throw new Error('Selecciona el hallazgo MIPE intervenido')
 if(!Object.values(MIPE_INTERVENTION_TYPES).includes(type))throw new Error('El tipo de intervención MIPE no es válido')
 if(Number.isNaN(Date.parse(performedAt)))throw new Error('La fecha de intervención MIPE no es válida')
 if(nextReviewAt&&Number.isNaN(Date.parse(nextReviewAt)))throw new Error('La próxima revisión MIPE no es válida')
 const finding=findingByIdentity(state,findingId,organizationId)
 if(!finding)throw new Error('No se encontró el hallazgo MIPE solicitado')
 if(!isOpenMipeFinding(finding))throw new Error('No se pueden agregar intervenciones a un hallazgo cerrado')
 if(type===MIPE_INTERVENTION_TYPES.TREATMENT&&!required(product))throw new Error('El producto o tratamiento aplicado es obligatorio')
 if(type===MIPE_INTERVENTION_TYPES.FOLLOW_UP&&!required(outcome))throw new Error('El resultado del seguimiento es obligatorio')
 const performed=new Date(performedAt).toISOString(),owner=organizationOf(finding),record={id:crypto.randomUUID(),...(owner?{organizationId:owner}:{}),findingId,materialPlantId:finding.materialPlantId,plantId:finding.materialPlantId,siteId:finding.siteId||null,lotId:finding.lotId||null,type,product:required(product),dose:required(dose),responsible:required(responsible),outcome:required(outcome),notes:required(notes),performedAt:performed,nextReviewAt:nextReviewAt?new Date(nextReviewAt).toISOString():'',createdAt:performed,source:'material-plant-mipe-intervention'}
 const title=type===MIPE_INTERVENTION_TYPES.TREATMENT?'Tratamiento MIPE registrado':'Seguimiento MIPE registrado'
 const detail=type===MIPE_INTERVENTION_TYPES.TREATMENT?`${record.product}${record.dose?` · ${record.dose}`:''}`:record.outcome
 return{...state,mipeInterventions:[...list(state?.mipeInterventions),record],plantEvents:[...list(state?.plantEvents),{id:crypto.randomUUID(),...(owner?{organizationId:owner}:{}),siteId:finding.siteId||null,plantId:finding.materialPlantId,entityId:finding.materialPlantId,type:'MIPE',title,detail,date:performed,createdAt:performed,source:'mipe-intervention-rule'}]}
}

export function resolveMaterialPlantFinding(state,{findingId,organizationId='',status='Resuelto',resolutionNotes='',resolvedAt=new Date().toISOString(),releaseAvailability=true}={}){
 if(!findingId)throw new Error('Selecciona el hallazgo MIPE que deseas cerrar')
 if(!closedStatuses.has(status))throw new Error('El estado de cierre MIPE no es válido')
 if(Number.isNaN(Date.parse(resolvedAt)))throw new Error('La fecha de resolución MIPE no es válida')
 const finding=findingByIdentity(state,findingId,organizationId)
 if(!finding)throw new Error('No se encontró el hallazgo MIPE solicitado')
 if(!isOpenMipeFinding(finding))throw new Error('El hallazgo MIPE ya está cerrado')
 const owner=organizationOf(finding),interventions=interventionsForFinding(state,findingId,{organizationId:owner})
 if(status==='Resuelto'&&!interventions.length)throw new Error('Registra al menos un tratamiento o seguimiento antes de resolver el hallazgo')
 if(status==='Falso positivo'&&!required(resolutionNotes))throw new Error('Justifica técnicamente el falso positivo')
 const closedAt=new Date(resolvedAt).toISOString(),removed=status==='Planta eliminada',findings=list(state.findings).map(item=>item.id===findingId&&(!owner||organizationOf(item)===owner)?{...item,status,resolutionNotes:required(resolutionNotes),resolvedAt:closedAt,updatedAt:closedAt,interventionCount:interventions.length}:item)
 let next={...state,findings},released=false
 const plant={id:finding.materialPlantId,organizationId:owner,lotId:finding.lotId,plantType:finding.plantType,unitIndex:finding.unitIndex??0,code:finding.plantCode||finding.materialPlantId,siteId:finding.siteId||null}
 if(removed&&finding.materialPlantId)next=applyMaterialPlantUnitPatch(next,[plant],{status:'Retirada',operationalAvailability:'No disponible',retiredAt:closedAt})
 else if(releaseAvailability&&finding.restrictsPropagation===true){const remaining=openBlockingMipeFindings(next,finding.materialPlantId,{excludeFindingId:findingId,organizationId:owner});if(!remaining.length){next=applyMaterialPlantUnitPatch(next,[plant],{operationalAvailability:MIPE_RELEASED_AVAILABILITY});released=true}}
 const title=removed?'Hallazgo MIPE cerrado por planta eliminada':released?'Hallazgo MIPE resuelto y planta rehabilitada':'Hallazgo MIPE resuelto'
 const plantEvents=[...list(next.plantEvents),{id:crypto.randomUUID(),...(owner?{organizationId:owner}:{}),siteId:finding.siteId||null,plantId:finding.materialPlantId,entityId:finding.materialPlantId,type:'MIPE',title,detail:`${finding.type} · ${status} · ${interventions.length} intervención${interventions.length===1?'':'es'}${required(resolutionNotes)?` · ${required(resolutionNotes)}`:''}`,date:closedAt,createdAt:closedAt,source:'mipe-resolution-rule'}]
 return{state:{...next,plantEvents},released,interventionCount:interventions.length,remainingBlockingFindings:openBlockingMipeFindings(next,finding.materialPlantId,{excludeFindingId:findingId,organizationId:owner}).length}
}

export function materialPlantFindingDetail(plants,{type,severity='Media',restrictAvailability=false}={}){const count=list(plants).length;return`${count} planta${count===1?'':'s'} · ${required(type)||'Hallazgo MIPE'} · Severidad ${required(severity)||'Media'}${restrictAvailability?' · Bloqueo para corte':''}`}
