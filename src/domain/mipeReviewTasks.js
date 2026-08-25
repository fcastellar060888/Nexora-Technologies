const list=value=>Array.isArray(value)?value:[]
const text=value=>String(value??'').trim()
const organizationOf=value=>text(value?.organizationId||value?.companyId||value?._organizationId)
const closedFindingStatuses=new Set(['Resuelto','Falso positivo','Planta eliminada'])
const FOLLOW_UP_TYPE='Seguimiento'

export const MIPE_REVIEW_TASK_STATUS=Object.freeze({
 PENDING:'Pendiente',
 UPCOMING:'Próxima',
 OVERDUE:'Vencida',
 COMPLETED:'Completada',
 CANCELLED:'Cancelada'
})

const validDate=value=>value&&!Number.isNaN(Date.parse(value))
const timestamp=value=>validDate(value)?Date.parse(value):0
const identity=(organizationId,id)=>`${text(organizationId)}\u0000${text(id)}`

function sameTenant(left,right){
 const a=organizationOf(left),b=organizationOf(right)
 if(a||b)return Boolean(a&&b&&a===b)
 return true
}

export function interventionCompletesReview(intervention,source){
 if(!intervention||!source||text(intervention.id)===text(source.id))return false
 if(text(intervention.type)!==FOLLOW_UP_TYPE)return false
 if(text(intervention.findingId)!==text(source.findingId)||!sameTenant(intervention,source))return false
 const sourceAt=timestamp(source.performedAt||source.createdAt),performedAt=timestamp(intervention.performedAt)
 return sourceAt>0&&performedAt>sourceAt
}

function resolveFinding(findingsByIdentity,findingsById,source){
 const organizationId=organizationOf(source),id=text(source?.findingId)
 if(!id)return null
 if(organizationId)return findingsByIdentity.get(identity(organizationId,id))||null
 const matches=findingsById.get(id)||[]
 return matches.length===1?matches[0]:null
}

export function projectMipeReviewTasks(state,{now=new Date(),organizationId='',siteId='',responsible='',status='',includeCompleted=false}={}){
 const nowMs=now instanceof Date?now.getTime():Date.parse(now)
 if(Number.isNaN(nowMs))throw new Error('La fecha de referencia MIPE no es válida')
 const findingsByIdentity=new Map(),findingsById=new Map(),requestedOrganization=text(organizationId)
 for(const finding of list(state?.findings)){
  const id=text(finding?.id),owner=organizationOf(finding);if(!id)continue
  if(requestedOrganization&&owner!==requestedOrganization)continue
  if(owner){const key=identity(owner,id);if(findingsByIdentity.has(key))throw new Error(`Finding MIPE duplicado dentro de la empresa: ${id}.`);findingsByIdentity.set(key,finding)}
  findingsById.set(id,[...(findingsById.get(id)||[]),finding])
 }
 const interventions=list(state?.mipeInterventions),taskSources=interventions.filter(item=>validDate(item.nextReviewAt)&&(!requestedOrganization||organizationOf(item)===requestedOrganization))
 const tasks=taskSources.map(source=>{
  const owner=organizationOf(source),finding=resolveFinding(findingsByIdentity,findingsById,source)
  if(!finding)throw new Error(`No se pudo resolver de forma inequívoca el Finding ${text(source.findingId)} de la revisión MIPE.`)
  if(owner&&organizationOf(finding)!==owner)throw new Error('La tarea MIPE referencia un Finding sin ownership exacto o de otra empresa.')
  const completedBy=interventions.filter(item=>interventionCompletesReview(item,source)).sort((a,b)=>timestamp(a.performedAt)-timestamp(b.performedAt)||text(a.id).localeCompare(text(b.id)))[0]||null
  const dueMs=timestamp(source.nextReviewAt),findingClosed=closedFindingStatuses.has(finding.status)
  let taskStatus=MIPE_REVIEW_TASK_STATUS.PENDING
  if(completedBy)taskStatus=MIPE_REVIEW_TASK_STATUS.COMPLETED
  else if(findingClosed)taskStatus=MIPE_REVIEW_TASK_STATUS.CANCELLED
  else if(dueMs<nowMs)taskStatus=MIPE_REVIEW_TASK_STATUS.OVERDUE
  else if(dueMs-nowMs<=24*60*60*1000)taskStatus=MIPE_REVIEW_TASK_STATUS.UPCOMING
  return Object.freeze({
   id:`mipe-review:${owner||organizationOf(finding)||'legacy'}:${source.id}`,
   organizationId:owner||organizationOf(finding)||'',
   findingId:source.findingId,
   interventionId:source.id,
   materialPlantId:source.materialPlantId||source.findingSnapshot?.materialPlantId||finding?.materialPlantId||null,
   plantPositionId:source.plantPositionId||source.findingSnapshot?.plantPositionId||finding?.plantPositionId||null,
   plantCode:finding?.plantCode||source.findingSnapshot?.targetId||source.materialPlantId||source.plantPositionId||'Planta',
   plantType:finding?.plantType||'',
   siteId:source.siteId||finding?.siteId||null,
   lotId:source.lotId||finding?.lotId||null,
   findingType:finding?.type||finding?.incidentId||'Hallazgo MIPE',
   severity:finding?.severity??source.findingSnapshot?.severity??'—',
   responsible:text(source.responsible)||'Sin asignar',
   dueAt:new Date(source.nextReviewAt).toISOString(),
   status:taskStatus,
   completedAt:completedBy?.performedAt||'',
   completedByInterventionId:completedBy?.id||'',
   sourceInterventionType:source.type,
   notes:text(source.notes),
   findingStatus:finding?.status||'Desconocido'
  })
 }).filter(task=>(!siteId||task.siteId===siteId)&&(!responsible||task.responsible===responsible)&&(!status||task.status===status)&&(includeCompleted||![MIPE_REVIEW_TASK_STATUS.COMPLETED,MIPE_REVIEW_TASK_STATUS.CANCELLED].includes(task.status)))
 return Object.freeze(tasks.sort((a,b)=>timestamp(a.dueAt)-timestamp(b.dueAt)||a.id.localeCompare(b.id)))
}

export function summarizeMipeReviewTasks(tasks){
 const source=list(tasks)
 return Object.freeze({
  total:source.length,
  pending:source.filter(item=>item.status===MIPE_REVIEW_TASK_STATUS.PENDING).length,
  upcoming:source.filter(item=>item.status===MIPE_REVIEW_TASK_STATUS.UPCOMING).length,
  overdue:source.filter(item=>item.status===MIPE_REVIEW_TASK_STATUS.OVERDUE).length,
  completed:source.filter(item=>item.status===MIPE_REVIEW_TASK_STATUS.COMPLETED).length
 })
}
