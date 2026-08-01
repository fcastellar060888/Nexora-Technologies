const list=value=>Array.isArray(value)?value:[]
const text=value=>String(value??'').trim()
const closedFindingStatuses=new Set(['Resuelto','Falso positivo'])

export const MIPE_REVIEW_TASK_STATUS=Object.freeze({
 PENDING:'Pendiente',
 UPCOMING:'Próxima',
 OVERDUE:'Vencida',
 COMPLETED:'Completada',
 CANCELLED:'Cancelada'
})

const validDate=value=>value&&!Number.isNaN(Date.parse(value))
const timestamp=value=>validDate(value)?Date.parse(value):0

export function interventionCompletesReview(intervention,source){
 return intervention?.findingId===source?.findingId&&timestamp(intervention.performedAt)>timestamp(source.nextReviewAt)
}

export function projectMipeReviewTasks(state,{now=new Date(),siteId='',responsible='',includeCompleted=false}={}){
 const nowMs=now instanceof Date?now.getTime():Date.parse(now)
 if(Number.isNaN(nowMs))throw new Error('La fecha de referencia MIPE no es válida')
 const findings=new Map(list(state?.findings).map(item=>[item.id,item]))
 const interventions=list(state?.mipeInterventions)
 const tasks=interventions.filter(item=>validDate(item.nextReviewAt)).map(source=>{
  const finding=findings.get(source.findingId)||null
  const completedBy=interventions.find(item=>interventionCompletesReview(item,source))||null
  const dueMs=timestamp(source.nextReviewAt)
  const findingClosed=finding&&closedFindingStatuses.has(finding.status)
  let status=MIPE_REVIEW_TASK_STATUS.PENDING
  if(completedBy)status=MIPE_REVIEW_TASK_STATUS.COMPLETED
  else if(findingClosed)status=MIPE_REVIEW_TASK_STATUS.CANCELLED
  else if(dueMs<nowMs)status=MIPE_REVIEW_TASK_STATUS.OVERDUE
  else if(dueMs-nowMs<=24*60*60*1000)status=MIPE_REVIEW_TASK_STATUS.UPCOMING
  return Object.freeze({
   id:`mipe-review:${source.id}`,
   findingId:source.findingId,
   interventionId:source.id,
   materialPlantId:source.materialPlantId||source.plantId||finding?.materialPlantId||null,
   plantCode:finding?.plantCode||source.materialPlantId||source.plantId||'Planta',
   siteId:source.siteId||finding?.siteId||null,
   lotId:source.lotId||finding?.lotId||null,
   findingType:finding?.type||'Hallazgo MIPE',
   severity:finding?.severity||'—',
   responsible:text(source.responsible)||'Sin asignar',
   dueAt:new Date(source.nextReviewAt).toISOString(),
   status,
   completedAt:completedBy?.performedAt||'',
   completedByInterventionId:completedBy?.id||'',
   sourceInterventionType:source.type,
   notes:text(source.notes),
   findingStatus:finding?.status||'Desconocido'
  })
 }).filter(task=>(!siteId||task.siteId===siteId)&&(!responsible||task.responsible===responsible)&&(includeCompleted||![MIPE_REVIEW_TASK_STATUS.COMPLETED,MIPE_REVIEW_TASK_STATUS.CANCELLED].includes(task.status)))
 return Object.freeze(tasks.sort((a,b)=>timestamp(a.dueAt)-timestamp(b.dueAt)))
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
