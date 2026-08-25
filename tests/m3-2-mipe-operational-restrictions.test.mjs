import test from'node:test'
import assert from'node:assert/strict'
import{MIPE_RESTRICTED_OPERATIONS,assertMipeOperationAllowed,projectMipeOperationalRestrictions}from'../src/domain/mipeOperationalRestrictions.js'

function baseState(){return{
 currentOrganizationId:'org-a',currentCompanyId:'org-a',
 companies:[{id:'org-a',name:'A'},{id:'org-b',name:'B'}],
 sites:[{id:'site-a',companyId:'org-a'},{id:'site-b',companyId:'org-b'}],
 houses:[],beds:[],materialPlantUnits:[],motherPlants:[],grandmotherPlants:[],
 plantPositions:[
  {id:'plant-1',organizationId:'org-a',siteId:'site-a',currentPhase:'Floración'},
  {id:'plant-1',organizationId:'org-b',siteId:'site-b',currentPhase:'Floración'}
 ],
 findings:[
  {id:'finding-1',organizationId:'org-a',siteId:'site-a',targetType:'POSITION',targetId:'plant-1',plantPositionId:'plant-1',status:'Seguimiento',createdAt:'2026-08-17T08:00:00.000Z',reportedAt:'2026-08-17T08:00:00.000Z'},
  {id:'finding-1',organizationId:'org-b',siteId:'site-b',targetType:'POSITION',targetId:'plant-1',plantPositionId:'plant-1',status:'Seguimiento',createdAt:'2026-08-17T08:00:00.000Z',reportedAt:'2026-08-17T08:00:00.000Z'}
 ],
 treatments:[
  {id:'treatment-1',organizationId:'org-a',siteId:'site-a',findingId:'finding-1',status:'Ejecutado',executedAt:'2026-08-17T09:00:00.000Z',reentryUntil:'2026-08-17T21:00:00.000Z',harvestRestrictedUntil:'2026-08-20T09:00:00.000Z'},
  {id:'treatment-1',organizationId:'org-b',siteId:'site-b',findingId:'finding-1',status:'Ejecutado',executedAt:'2026-08-17T09:00:00.000Z',reentryUntil:'2026-08-17T10:00:00.000Z',harvestRestrictedUntil:'2026-08-17T11:00:00.000Z'}
 ]
}}

const project=(state,at)=>projectMipeOperationalRestrictions(state,{targetType:'POSITION',targetId:'plant-1',organizationId:'org-a',at})

test('F009: reentrada y carencia se derivan solo de evidencia del tenant activo',()=>{
 const result=project(baseState(),'2026-08-17T10:00:00.000Z')
 assert.equal(result.reentryBlocked,true)
 assert.equal(result.harvestBlocked,true)
 assert.equal(result.reentryUntil,'2026-08-17T21:00:00.000Z')
 assert.equal(result.harvestRestrictedUntil,'2026-08-20T09:00:00.000Z')
 assert.deepEqual(result.treatmentIds,['treatment-1'])
 assert.ok(result.restrictions.every(item=>item.organizationId==='org-a'&&item.siteId==='site-a'))
})

test('F009: un tratamiento futuro no bloquea retroactivamente',()=>{
 const result=project(baseState(),'2026-08-17T08:30:00.000Z')
 assert.equal(result.reentryBlocked,false)
 assert.equal(result.harvestBlocked,false)
 assert.equal(result.restrictions.length,0)
})

test('F009: la reentrada expira antes que la carencia sin intervención manual',()=>{
 const result=project(baseState(),'2026-08-18T10:00:00.000Z')
 assert.equal(result.reentryBlocked,false)
 assert.equal(result.harvestBlocked,true)
 assert.equal(result.reentryUntil,'')
 assert.equal(result.harvestRestrictedUntil,'2026-08-20T09:00:00.000Z')
})

test('F009: todas las restricciones temporales expiran automáticamente',()=>{
 const result=project(baseState(),'2026-08-20T09:00:00.000Z')
 assert.equal(result.reentryBlocked,false)
 assert.equal(result.harvestBlocked,false)
 assert.equal(result.restrictions.length,0)
})

test('F009: cerrar el Finding no cancela prematuramente reentrada/carencia del Treatment ejecutado',()=>{
 const state=baseState();state.findings[0]={...state.findings[0],status:'Resuelto',closedAt:'2026-08-17T09:30:00.000Z'}
 const result=project(state,'2026-08-17T10:00:00.000Z')
 assert.equal(result.reentryBlocked,true)
 assert.equal(result.harvestBlocked,true)
})

test('F009: CULTIVATION_WORK y HARVEST fallan cerrado durante sus ventanas',()=>{
 const state=baseState()
 assert.throws(()=>assertMipeOperationAllowed(state,{operation:MIPE_RESTRICTED_OPERATIONS.CULTIVATION_WORK,targetType:'POSITION',targetId:'plant-1',organizationId:'org-a',at:'2026-08-17T10:00:00.000Z'}),/reentrada/i)
 assert.throws(()=>assertMipeOperationAllowed(state,{operation:MIPE_RESTRICTED_OPERATIONS.HARVEST,targetType:'POSITION',targetId:'plant-1',organizationId:'org-a',at:'2026-08-18T10:00:00.000Z'}),/carencia/i)
 assert.doesNotThrow(()=>assertMipeOperationAllowed(state,{operation:MIPE_RESTRICTED_OPERATIONS.HARVEST,targetType:'POSITION',targetId:'plant-1',organizationId:'org-a',at:'2026-08-20T09:00:00.000Z'}))
})

test('F009: Finding material abierto bloquea propagación y terminal lo libera',()=>{
 const state=baseState();state.findings.push({id:'material-finding',organizationId:'org-a',siteId:'site-a',targetType:'MATERIAL_PLANT',targetId:'mother-unit-1',materialPlantId:'mother-unit-1',status:'Detectado',restrictsPropagation:true,createdAt:'2026-08-17T08:00:00.000Z',reportedAt:'2026-08-17T08:00:00.000Z'})
 let result=projectMipeOperationalRestrictions(state,{targetType:'MATERIAL_PLANT',targetId:'mother-unit-1',organizationId:'org-a',at:'2026-08-17T10:00:00.000Z'})
 assert.equal(result.propagationBlocked,true)
 assert.throws(()=>assertMipeOperationAllowed(state,{operation:MIPE_RESTRICTED_OPERATIONS.PROPAGATION_CUT,targetType:'MATERIAL_PLANT',targetId:'mother-unit-1',organizationId:'org-a',at:'2026-08-17T10:00:00.000Z'}),/bloqueada|hallazgo/i)
 state.findings=state.findings.map(item=>item.id==='material-finding'?{...item,status:'Resuelto'}:item)
 result=projectMipeOperationalRestrictions(state,{targetType:'MATERIAL_PLANT',targetId:'mother-unit-1',organizationId:'org-a',at:'2026-08-17T10:00:00.000Z'})
 assert.equal(result.propagationBlocked,false)
})

test('F009: Finding material futuro no bloquea propagación retroactivamente',()=>{
 const state=baseState();state.findings.push({id:'future-material',organizationId:'org-a',siteId:'site-a',targetType:'MATERIAL_PLANT',targetId:'mother-unit-1',materialPlantId:'mother-unit-1',status:'Detectado',restrictsPropagation:true,createdAt:'2026-08-17T12:00:00.000Z',reportedAt:'2026-08-17T12:00:00.000Z'})
 const result=projectMipeOperationalRestrictions(state,{targetType:'MATERIAL_PLANT',targetId:'mother-unit-1',organizationId:'org-a',at:'2026-08-17T10:00:00.000Z'})
 assert.equal(result.propagationBlocked,false)
})

test('F009: homónimos foreign no pueden acortar ni extender restricciones del tenant activo',()=>{
 const state=baseState();state.treatments[1]={...state.treatments[1],reentryUntil:'2026-09-01T00:00:00.000Z',harvestRestrictedUntil:'2026-09-10T00:00:00.000Z'}
 const result=project(state,'2026-08-17T10:00:00.000Z')
 assert.equal(result.reentryUntil,'2026-08-17T21:00:00.000Z')
 assert.equal(result.harvestRestrictedUntil,'2026-08-20T09:00:00.000Z')
})

test('F009: identidad Finding duplicada dentro del mismo tenant falla cerrado',()=>{
 const state=baseState();state.findings.push({...state.findings[0],notes:'duplicado same tenant'})
 assert.throws(()=>project(state,'2026-08-17T10:00:00.000Z'),/duplicada/i)
})

test('F009: Treatment duplicado dentro del mismo tenant falla cerrado',()=>{
 const state=baseState();state.treatments.push({...state.treatments[0],notes:'duplicado same tenant'})
 assert.throws(()=>project(state,'2026-08-17T10:00:00.000Z'),/duplicada/i)
})
