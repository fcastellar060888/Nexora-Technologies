import test from'node:test'
import assert from'node:assert/strict'
import{projectMipePassportTrace}from'../src/core/passport/mipePassportProjection.js'

function baseState(){
 return{
  currentContext:{companyId:'org-a'},companies:[{id:'org-a'},{id:'org-b'}],
  sites:[{id:'site-a',organizationId:'org-a'},{id:'site-b',organizationId:'org-b'}],
  findings:[{id:'finding-a',organizationId:'org-a',siteId:'site-a',targetType:'POSITION',targetId:'plant-a',plantPositionId:'plant-a',incidentId:'incident-a',severity:2,status:'Seguimiento',reportedAt:'2026-08-17T10:00:00.000Z'}],
  incidents:[{id:'incident-a',organizationId:'org-a',name:'Botritis',active:true}],
  products:[{id:'product-a',organizationId:'org-a',name:'Producto A',unit:'mL'}],
  inventoryLots:[{id:'lot-a',organizationId:'org-a',siteId:'site-a',productId:'product-a',lotNumber:'LOT-A'}],
  treatments:[{id:'treatment-a',organizationId:'org-a',siteId:'site-a',findingId:'finding-a',productId:'product-a',lotId:'lot-a',status:'Ejecutado',executedAt:'2026-08-17T11:00:00.000Z',reentryUntil:'2026-08-17T23:00:00.000Z',harvestRestrictedUntil:'2026-08-20T11:00:00.000Z',productSnapshot:{name:'Producto histórico'}}],
  mipeInterventions:[]
 }
}
const project=state=>projectMipePassportTrace(state,{organizationId:'org-a',targetType:'POSITION',targetId:'plant-a'})

test('F011 causality: una Intervention de Tratamiento requiere Treatment canónico',()=>{
 const state=baseState();state.mipeInterventions=[{id:'intervention-a',organizationId:'org-a',siteId:'site-a',findingId:'finding-a',type:'Tratamiento',performedAt:'2026-08-17T12:00:00.000Z'}]
 assert.throws(()=>project(state),/Tratamiento.*Treatment canónico|Intervention.*Treatment/i)
})

test('F011 causality: un Seguimiento puede existir sin Treatment',()=>{
 const state=baseState();state.mipeInterventions=[{id:'followup-a',organizationId:'org-a',siteId:'site-a',findingId:'finding-a',type:'Seguimiento',performedAt:'2026-08-17T12:00:00.000Z',outcome:'Mejora'}]
 const trace=project(state)
 assert.ok(trace.relationships.some(item=>item.targetType==='mipe.intervention'&&item.targetId==='followup-a'))
})

test('F011 causality: Treatment homónimo de otro tenant no satisface una Intervention',()=>{
 const state=baseState();state.treatments=state.treatments.filter(item=>item.id!=='treatment-a');state.treatments.push({id:'treatment-foreign',organizationId:'org-b',siteId:'site-b',findingId:'finding-a',productId:'product-a',status:'Ejecutado',executedAt:'2026-08-17T11:00:00.000Z'});state.mipeInterventions=[{id:'intervention-a',organizationId:'org-a',siteId:'site-a',findingId:'finding-a',treatmentId:'treatment-foreign',type:'Seguimiento',performedAt:'2026-08-17T12:00:00.000Z',outcome:'Mejora'}]
 assert.throws(()=>project(state),/Treatment ajeno a su cadena causal/i)
})

test('F011 causality: snapshots contradictorios fallan cerrado',()=>{
 const findingSnapshot=baseState();findingSnapshot.mipeInterventions=[{id:'intervention-f',organizationId:'org-a',siteId:'site-a',findingId:'finding-a',type:'Seguimiento',performedAt:'2026-08-17T12:00:00.000Z',outcome:'Mejora',findingSnapshot:{id:'finding-other'}}]
 assert.throws(()=>project(findingSnapshot),/findingSnapshot de otro Finding/i)
 const treatmentSnapshot=baseState();treatmentSnapshot.mipeInterventions=[{id:'intervention-t',organizationId:'org-a',siteId:'site-a',findingId:'finding-a',treatmentId:'treatment-a',type:'Seguimiento',performedAt:'2026-08-17T12:00:00.000Z',outcome:'Mejora',treatmentSnapshot:{id:'treatment-other'}}]
 assert.throws(()=>project(treatmentSnapshot),/treatmentSnapshot contradictorio/i)
})

test('F011 causality: una corrección posterior de Incident no invalida el snapshot histórico de una Intervention previa',()=>{
 const state=baseState();state.incidents.push({id:'incident-b',organizationId:'org-a',name:'Trips',active:true})
 state.findings[0]={...state.findings[0],incidentId:'incident-b',mipeHistory:[
  {id:'finding-a:workflow:legacy-import',type:'IMPORTED',from:null,to:'Seguimiento',occurredAt:'2026-08-17T10:00:00.000Z',actor:{id:'legacy',name:'Legacy'},metadata:{legacyImported:true}},
  {id:'cmd-correct:correction',type:'CORRECTION',from:'Seguimiento',to:'Seguimiento',occurredAt:'2026-08-17T13:00:00.000Z',actor:{id:'user-a',name:'Agrónomo'},reason:'Reclasificación taxonómica',changes:{incidentId:{before:'incident-a',after:'incident-b'}}}
 ],mipeHistoryVersion:2}
 state.mipeInterventions=[{id:'followup-before-correction',organizationId:'org-a',siteId:'site-a',findingId:'finding-a',type:'Seguimiento',performedAt:'2026-08-17T12:00:00.000Z',outcome:'Observación previa',findingSnapshot:{id:'finding-a',incidentId:'incident-a',targetType:'POSITION',targetId:'plant-a'}}]
 const trace=project(state),intervention=trace.relationships.find(item=>item.targetType==='mipe.intervention'&&item.targetId==='followup-before-correction')
 assert.equal(intervention.incidentId,'incident-a')
 assert.ok(trace.relationships.some(item=>item.type==='historically_classified_by_mipe_incident'&&item.targetId==='incident-a'&&item.historical===true))
 assert.ok(trace.relationships.some(item=>item.type==='classified_by_mipe_incident'&&item.targetId==='incident-b'))
})

test('F011 causality: una corrección de Incident conserva la clasificación anterior aun sin Interventions',()=>{
 const state=baseState();state.incidents.push({id:'incident-b',organizationId:'org-a',name:'Trips',active:true})
 state.findings[0]={...state.findings[0],incidentId:'incident-b',mipeHistory:[
  {id:'finding-a:workflow:legacy-import',type:'IMPORTED',from:null,to:'Seguimiento',occurredAt:'2026-08-17T10:00:00.000Z',actor:{id:'legacy',name:'Legacy'},metadata:{legacyImported:true}},
  {id:'cmd-correct:correction',type:'CORRECTION',from:'Seguimiento',to:'Seguimiento',occurredAt:'2026-08-17T13:00:00.000Z',actor:{id:'user-a',name:'Agrónomo'},reason:'Reclasificación taxonómica',changes:{incidentId:{before:'incident-a',after:'incident-b'}}}
 ],mipeHistoryVersion:2}
 const trace=project(state),historical=trace.relationships.find(item=>item.type==='historically_classified_by_mipe_incident'&&item.targetId==='incident-a')
 assert.ok(historical)
 assert.deepEqual(historical.findingIds,['finding-a'])
 assert.deepEqual(historical.interventionIds,[])
 assert.deepEqual(historical.correctionEventIds,['cmd-correct:correction'])
 assert.ok(trace.relationships.some(item=>item.type==='classified_by_mipe_incident'&&item.targetId==='incident-b'))
})

test('F011 causality: varias Interventions históricas del mismo Incident se agregan en una sola relación',()=>{
 const state=baseState();state.incidents.push({id:'incident-b',organizationId:'org-a',name:'Trips',active:true})
 state.findings[0]={...state.findings[0],incidentId:'incident-b',mipeHistory:[
  {id:'finding-a:workflow:legacy-import',type:'IMPORTED',from:null,to:'Seguimiento',occurredAt:'2026-08-17T10:00:00.000Z',actor:{id:'legacy',name:'Legacy'},metadata:{legacyImported:true}},
  {id:'cmd-correct:correction',type:'CORRECTION',from:'Seguimiento',to:'Seguimiento',occurredAt:'2026-08-17T13:00:00.000Z',actor:{id:'user-a',name:'Agrónomo'},reason:'Reclasificación taxonómica',changes:{incidentId:{before:'incident-a',after:'incident-b'}}}
 ],mipeHistoryVersion:2}
 const snapshot={id:'finding-a',incidentId:'incident-a',targetType:'POSITION',targetId:'plant-a'}
 state.mipeInterventions=[
  {id:'followup-historical-2',organizationId:'org-a',siteId:'site-a',findingId:'finding-a',type:'Seguimiento',performedAt:'2026-08-17T12:00:00.000Z',outcome:'Segunda observación',findingSnapshot:snapshot},
  {id:'followup-historical-1',organizationId:'org-a',siteId:'site-a',findingId:'finding-a',type:'Seguimiento',performedAt:'2026-08-17T11:00:00.000Z',outcome:'Primera observación',findingSnapshot:snapshot}
 ]
 const trace=project(state),historical=trace.relationships.filter(item=>item.type==='historically_classified_by_mipe_incident'&&item.targetId==='incident-a')
 assert.equal(historical.length,1)
 assert.deepEqual(historical[0].findingIds,['finding-a'])
 assert.deepEqual(historical[0].interventionIds,['followup-historical-1','followup-historical-2'])
 assert.deepEqual(historical[0].correctionEventIds,['cmd-correct:correction'])
})

test('F011 causality: snapshot viejo después de corregir Incident falla cerrado',()=>{
 const state=baseState();state.incidents.push({id:'incident-b',organizationId:'org-a',name:'Trips',active:true})
 state.findings[0]={...state.findings[0],incidentId:'incident-b',mipeHistory:[
  {id:'finding-a:workflow:legacy-import',type:'IMPORTED',from:null,to:'Seguimiento',occurredAt:'2026-08-17T10:00:00.000Z',actor:{id:'legacy',name:'Legacy'},metadata:{legacyImported:true}},
  {id:'cmd-correct:correction',type:'CORRECTION',from:'Seguimiento',to:'Seguimiento',occurredAt:'2026-08-17T13:00:00.000Z',actor:{id:'user-a',name:'Agrónomo'},reason:'Reclasificación taxonómica',changes:{incidentId:{before:'incident-a',after:'incident-b'}}}
 ],mipeHistoryVersion:2}
 state.mipeInterventions=[{id:'followup-after-correction',organizationId:'org-a',siteId:'site-a',findingId:'finding-a',type:'Seguimiento',performedAt:'2026-08-17T14:00:00.000Z',outcome:'Observación posterior',findingSnapshot:{id:'finding-a',incidentId:'incident-a',targetType:'POSITION',targetId:'plant-a'}}]
 assert.throws(()=>project(state),/Incident histórico|contradice el Incident/i)
})

test('F011 causality: ventanas de restricción no pueden terminar antes o al inicio de la ejecución',()=>{
 const state=baseState();state.treatments[0].reentryUntil='2026-08-17T10:59:59.000Z'
 assert.throws(()=>project(state),/restricción|reentrada|ventana/i)
 const equal=baseState();equal.treatments[0].harvestRestrictedUntil=equal.treatments[0].executedAt
 assert.throws(()=>project(equal),/restricción|carencia|ventana/i)
})
