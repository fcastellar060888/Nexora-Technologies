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

export function projectMipeReviewTasks(state,{now=new Date(),siteId='',responsible='',status='',includeCompleted=false}={}){
 const nowMs=now instanceof Date?now.getTime():Date.parse(now)
 if(Number.isNaN(nowMs))throw new Error('La fecha de referencia MIPE no es válida')
 const findings=new Map(list(state?.findings).map(item=>[item.id,item]))
 const interventions=list(state?.mipeInterventions)
 const tasks=interventions.filter(item=>validDate(item.nextReviewAt)).map(source=>{
  const finding=findings.get(source.findingId)||null
  const completedBy=interventions.find(item=>interventionCompletesReview(item,source))||null
  const dueMs=timestamp(source.nextReviewAt)
  const findingClosed=finding&&closedFindingStatuses.has(finding.status)
  let taskStatus=MIPE_REVIEW_TASK_STATUS.PENDING
  if(completedBy)taskStatus=MIPE_REVIEW_TASK_STATUS.COMPLETED
  else if(findingClosed)taskStatus=MIPE_REVIEW_TASK_STATUS.CANCELLED
  else if(dueMs<nowMs)taskStatus=MIPE_REVIEW_TASK_STATUS.OVERDUE
  else if(dueMs-nowMs<=24*60*60*1000)taskStatus=MIPE_REVIEW_TASK_STATUS.UPCOMING
  return Object.freeze({
   id:`mipe-review:${source.id}`,
   findingId:source.findingId,
   interventionId:source.id,
   materialPlantId:source.materialPlantId||source.plantId||finding?.materialPlantId||null,
   plantCode:finding?.plantCode||source.materialPlantId||source.plantId||'Planta',
   plantType:finding?.plantType||'',
   siteId:source.siteId||finding?.siteId||null,
   lotId:source.lotId||finding?.lotId||null,
   findingType:finding?.type||'Hallazgo MIPE',
   severity:finding?.severity||'—',
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
 return Object.freeze(tasks.sort((a,b)=>timestamp(a.dueAt)-timestamp(b.dueAt)))
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
