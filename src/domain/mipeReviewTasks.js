const list=value=>Array.isArray(value)?value:[]
const text=value=>String(value??'').trim()
const organizationOf=value=>text(value?.organizationId||value?.companyId||value?._organizationId)
const closedFindingStatuses=new Set(['Resuelto','Falso positivo','Planta eliminada'])

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

function sameTenant(left,right){const a=organizationOf(left),b=organizationOf(right);return!a||!b||a===b}

export function interventionCompletesReview(intervention,source){
 if(!intervention||!source||text(intervention.id)===text(source.id))return false
 if(text(intervention.findingId)!==text(source.findingId)||!sameTenant(intervention,source))return false
 const sourceAt=timestamp(source.performedAt||source.createdAt),performedAt=timestamp(intervention.performedAt)
 return sourceAt>0&&performedAt>sourceAt
}

function resolveFinding(findingsByIdentity,findingsById,source){
 const organizationId=organizationOf(source),id=text(source?.findingId)
 if(!id)return null
 if(organizationId){const exact=findingsByIdentity.get(identity(organizationId,id));if(exact)return exact}
 const matches=findingsById.get(id)||[]
 return matches.length===1?matches[0]:null
}

export function projectMipeReviewTasks(state,{now=new Date(),organizationId='',siteId='',responsible='',status='',includeCompleted=false}={}){
 const nowMs=now instanceof Date?now.getTime():Date.parse(now)
 if(Number.isNaN(nowMs))throw new Error('La fecha de referencia MIPE no es válida')
 const findingsByIdentity=new Map(),findingsById=new Map()
 for(const finding of list(state?.findings)){
  const id=text(finding?.id),owner=organizationOf(finding);if(!id)continue
  if(owner)findingsByIdentity.set(identity(owner,id),finding)
  findingsById.set(id,[...(findingsById.get(id)||[]),finding])
 }
 const interventions=list(state?.mipeInterventions)
 const tasks=interventions.filter(item=>validDate(item.nextReviewAt)).map(source=>{
  const owner=organizationOf(source),finding=resolveFinding(findingsByIdentity,findingsById,source)
  if(!finding)throw new Error(`No se pudo resolver de forma inequívoca el Finding ${text(source.findingId)} de la revisión MIPE.`)
  if(owner&&organizationOf(finding)&&owner!==organizationOf(finding))throw new Error('La tarea MIPE referencia un Finding de otra empresa.')
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
 }).filter(task=>(!organizationId||task.organizationId===organizationId)&&(!siteId||task.siteId===siteId)&&(!responsible||task.responsible===responsible)&&(!status||task.status===status)&&(includeCompleted||![MIPE_REVIEW_TASK_STATUS.COMPLETED,MIPE_REVIEW_TASK_STATUS.CANCELLED].includes(task.status)))
 return Object.freeze(tasks.sort((a,b)=>timestamp(a.dueAt)-timestamp(b.dueAt)||a.id.localeCompare(b.id)))
}

export function reassignMipeReviewTask(state,{interventionId,responsible}={}){
 if(!interventionId)throw new Error('Selecciona la tarea MIPE que deseas reasignar')
 const assigned=text(responsible)
 if(!assigned)throw new Error('Selecciona o escribe el nuevo responsable')
 const interventions=list(state?.mipeInterventions)
 const source=interventions.find(item=>item.id===interventionId)
 if(!source)throw new Error('No se encontró la intervención que originó la tarea MIPE')
 if(!validDate(source.nextReviewAt))throw new Error('La intervención no tiene una próxima revisión programada')
 const updatedAt=new Date().toISOString()
 const mipeInterventions=interventions.map(item=>item.id===interventionId?{...item,responsible:assigned,updatedAt}:item)
 return{...state,mipeInterventions}
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