import test from'node:test'
import assert from'node:assert/strict'
import{createCanonicalMipeIntervention}from'../src/domain/mipeInterventionAuthority.js'
import{MIPE_REVIEW_TASK_STATUS,interventionCompletesReview,projectMipeReviewTasks}from'../src/domain/mipeReviewTasks.js'

const finding={id:'finding-shared',organizationId:'org-a',siteId:'site-a',targetType:'POSITION',targetId:'position-a',plantPositionId:'position-a',status:'Seguimiento',reportedAt:'2026-08-17T08:00:00.000Z'}

function source(){return createCanonicalMipeIntervention({finding,organizationId:'org-a',commandId:'source',occurredAt:'2026-08-17T08:00:00.000Z',input:{type:'Seguimiento',outcome:'Inspección origen',nextReviewAt:'2026-08-17T12:00:00.000Z'}})}

test('M32-F006: a later Treatment does not satisfy a follow-up obligation',()=>{
 const origin=source(),canonicalTreatment={id:'treatment-a',organizationId:'org-a',siteId:'site-a',findingId:'finding-shared',productId:'product-a',status:'Ejecutado',executedAt:'2026-08-17T09:30:00.000Z'}
 const treatment=createCanonicalMipeIntervention({finding,treatment:canonicalTreatment,organizationId:'org-a',commandId:'later-treatment',occurredAt:'2026-08-17T10:00:00.000Z',input:{type:'Tratamiento'}})
 assert.equal(interventionCompletesReview(treatment,origin),false)
 const tasks=projectMipeReviewTasks({findings:[finding],mipeInterventions:[origin,treatment]},{now:'2026-08-17T13:00:00.000Z',includeCompleted:true})
 assert.equal(tasks.find(item=>item.interventionId==='source').status,MIPE_REVIEW_TASK_STATUS.OVERDUE)
})

test('M32-F006: unowned legacy intervention cannot complete a tenant-owned review',()=>{
 const origin=source(),legacy={id:'legacy',findingId:'finding-shared',type:'Seguimiento',outcome:'legacy',performedAt:'2026-08-17T10:00:00.000Z'}
 assert.equal(interventionCompletesReview(legacy,origin),false)
 const tasks=projectMipeReviewTasks({findings:[finding],mipeInterventions:[origin,legacy]},{now:'2026-08-17T13:00:00.000Z',includeCompleted:true})
 assert.equal(tasks[0].status,MIPE_REVIEW_TASK_STATUS.OVERDUE)
 assert.equal(tasks[0].completedByInterventionId,'')
})

test('M32-F006: tenant-owned review refuses an unowned Finding instead of adopting it by id',()=>{
 const origin=source(),legacyFinding={...finding};delete legacyFinding.organizationId
 assert.throws(()=>projectMipeReviewTasks({findings:[legacyFinding],mipeInterventions:[origin]},{now:'2026-08-17T13:00:00.000Z'}),/no se pudo resolver de forma inequívoca/i)
})

test('M32-F006: organization filter isolates foreign duplicate identities before resolution',()=>{
 const origin=source(),foreign={...finding,organizationId:'org-b',siteId:'site-b',plantPositionId:'position-b',targetId:'position-b'}
 const foreignDuplicate={...foreign,plantPositionId:'position-c',targetId:'position-c'}
 const tasks=projectMipeReviewTasks({findings:[finding,foreign,foreignDuplicate],mipeInterventions:[origin]},{organizationId:'org-a',now:'2026-08-17T13:00:00.000Z',includeCompleted:true})
 assert.equal(tasks.length,1)
 assert.equal(tasks[0].organizationId,'org-a')
})

test('M32-F006: duplicate Finding identity inside one tenant fails closed',()=>{
 const origin=source(),duplicate={...finding,plantPositionId:'position-b',targetId:'position-b'}
 assert.throws(()=>projectMipeReviewTasks({findings:[finding,duplicate],mipeInterventions:[origin]},{now:'2026-08-17T13:00:00.000Z'}),/duplicado dentro de la empresa/)
})

test('M32-F006: declared MATERIAL_PLANT target is preserved even when only targetId exists',()=>{
 const material={id:'finding-mat',organizationId:'org-a',siteId:'site-a',targetType:'MATERIAL_PLANT',targetId:'material-a',status:'Abierto',reportedAt:'2026-08-17T08:00:00.000Z'}
 const record=createCanonicalMipeIntervention({finding:material,organizationId:'org-a',commandId:'material-target',actor:{name:'Agrónomo'},occurredAt:'2026-08-17T09:00:00.000Z',input:{type:'Seguimiento',outcome:'Estable'}})
 assert.equal(record.findingSnapshot.targetType,'MATERIAL_PLANT')
 assert.equal(record.findingSnapshot.materialPlantId,'material-a')
 assert.equal(record.responsible,'Agrónomo')
})

test('M32-F006: an unverified treatmentId cannot be smuggled into canonical intervention',()=>{
 assert.throws(()=>createCanonicalMipeIntervention({finding,organizationId:'org-a',commandId:'fake-treatment',occurredAt:'2026-08-17T09:00:00.000Z',input:{type:'Seguimiento',outcome:'Revisión',treatmentId:'foreign-or-missing'}}),/Treatment no verificado/)
})
