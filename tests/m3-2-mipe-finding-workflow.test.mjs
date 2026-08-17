import test from'node:test'
import assert from'node:assert/strict'
import{
 MIPE_FINDING_STATES,
 MIPE_FINDING_TRANSITIONS,
 availableMipeFindingTransitions,
 correctMipeFinding,
 createMipeFindingWorkflow,
 mipeFindingHistory,
 transitionMipeFinding,
 verifyMipeFindingHistory
}from'../src/domain/mipeFindingWorkflow.js'

const actor={id:'user-a',name:'Agrónomo'}
const base=()=>({id:'finding-a',organizationId:'org-a',siteId:'site-a',incidentId:'incident-a',status:'Detectado',severity:2,notes:'Inicial',createdAt:'2026-08-17T01:00:00.000Z',reportedAt:'2026-08-17T01:00:00.000Z'})

test('M32-F005: new finding starts in Detectado with one immutable CREATED event',()=>{
 const finding=createMipeFindingWorkflow(base(),{commandId:'cmd-create',actor,occurredAt:'2026-08-17T01:00:00.000Z'})
 assert.equal(finding.status,MIPE_FINDING_STATES.DETECTED)
 assert.equal(finding.mipeHistory.length,1)
 assert.equal(finding.mipeHistory[0].type,'CREATED')
 assert.equal(finding.mipeHistory[0].to,'Detectado')
 assert.equal(Object.isFrozen(finding.mipeHistory[0]),true)
 assert.deepEqual(verifyMipeFindingHistory(finding),{valid:true,errors:[]})
})

test('M32-F005: legacy finding imports current state explicitly without fabricating an operational transition',()=>{
 const finding={...base(),status:'Seguimiento',createdAt:undefined,reportedAt:undefined,updatedAt:undefined}
 const history=mipeFindingHistory(finding)
 assert.equal(history.length,1)
 assert.equal(history[0].type,'IMPORTED')
 assert.equal(history[0].to,'Seguimiento')
 assert.equal(history[0].occurredAt,'1970-01-01T00:00:00.000Z')
 assert.equal(history[0].metadata.legacyImported,true)
})

test('M32-F005: correction appends before/after evidence and cannot rewrite status or original time',()=>{
 const created=createMipeFindingWorkflow(base(),{commandId:'cmd-create',actor,occurredAt:'2026-08-17T01:00:00.000Z'})
 const corrected=correctMipeFinding(created,{severity:3,notes:'Confirmado por lupa'},{commandId:'cmd-correct',actor,occurredAt:'2026-08-17T02:00:00.000Z',reason:'Corrección posterior a verificación de campo'})
 assert.equal(corrected.createdAt,created.createdAt)
 assert.equal(corrected.status,'Detectado')
 assert.equal(corrected.severity,3)
 assert.equal(corrected.mipeHistory.length,2)
 assert.equal(corrected.mipeHistory[1].type,'CORRECTION')
 assert.deepEqual(corrected.mipeHistory[1].changes.severity,{before:2,after:3})
 assert.equal(corrected.mipeHistory[1].reason,'Corrección posterior a verificación de campo')
 assert.throws(()=>correctMipeFinding(created,{createdAt:'2020-01-01'},{commandId:'bad',actor,reason:'No permitido'}),/no puede reescribirse/)
 assert.throws(()=>correctMipeFinding(created,{status:'Resuelto'},{commandId:'bad2',actor,reason:'No permitido'}),/no puede reescribirse/)
 assert.deepEqual(verifyMipeFindingHistory(corrected),{valid:true,errors:[]})
})

test('M32-F005: workflow exposes only legal transitions and rejects skips',()=>{
 let finding=createMipeFindingWorkflow(base(),{commandId:'cmd-create',actor,occurredAt:'2026-08-17T01:00:00.000Z'})
 const options=availableMipeFindingTransitions(finding).map(item=>item.name)
 assert.ok(options.includes(MIPE_FINDING_TRANSITIONS.START_EVALUATION))
 assert.ok(options.includes(MIPE_FINDING_TRANSITIONS.APPROVE_TREATMENT))
 assert.ok(options.includes(MIPE_FINDING_TRANSITIONS.MARK_FALSE_POSITIVE))
 assert.throws(()=>transitionMipeFinding(finding,MIPE_FINDING_TRANSITIONS.START_FOLLOW_UP,{commandId:'skip',actor,occurredAt:'2026-08-17T02:00:00.000Z'}),/no está permitida/)
 finding=transitionMipeFinding(finding,MIPE_FINDING_TRANSITIONS.START_EVALUATION,{commandId:'eval',actor,occurredAt:'2026-08-17T02:00:00.000Z'})
 assert.equal(finding.status,'En evaluación')
 finding=transitionMipeFinding(finding,MIPE_FINDING_TRANSITIONS.RESOLVE,{commandId:'resolve',actor,occurredAt:'2026-08-17T03:00:00.000Z',notes:'Sin signos activos'})
 assert.equal(finding.status,'Resuelto')
 assert.equal(finding.closedAt,'2026-08-17T03:00:00.000Z')
 assert.deepEqual(availableMipeFindingTransitions(finding),[])
 assert.throws(()=>transitionMipeFinding(finding,MIPE_FINDING_TRANSITIONS.START_EVALUATION,{commandId:'after-close',actor,occurredAt:'2026-08-17T04:00:00.000Z'}),/está cerrado/)
 assert.deepEqual(verifyMipeFindingHistory(finding),{valid:true,errors:[]})
})

test('M32-F005: workflow history rejects time regression and duplicate/tampered chains',()=>{
 const created=createMipeFindingWorkflow(base(),{commandId:'cmd-create',actor,occurredAt:'2026-08-17T02:00:00.000Z'})
 assert.throws(()=>transitionMipeFinding(created,MIPE_FINDING_TRANSITIONS.START_EVALUATION,{commandId:'back',actor,occurredAt:'2026-08-17T01:59:00.000Z'}),/retroceder el tiempo/)
 const tampered=structuredClone(created);tampered.status='Seguimiento'
 const verified=verifyMipeFindingHistory(tampered)
 assert.equal(verified.valid,false)
 assert.ok(verified.errors.some(item=>item.includes('estado actual')))
})
