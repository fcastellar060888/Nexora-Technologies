import test from'node:test'
import assert from'node:assert/strict'
import{projectMipePassportTrace}from'../src/core/passport/mipePassportProjection.js'
import{isOpenPassportFinding}from'../src/core/passport/passportDomainSources.js'

const created=(id,to='Detectado',organizationId='org-a')=>({id:`${id}:created`,type:'CREATED',from:null,to,occurredAt:'2026-08-17T10:00:00.000Z',actor:{id:`actor-${organizationId}`,name:'Operario'},metadata:{}})
const resolved=id=>({id:`${id}:resolve`,type:'TRANSITION',transition:'RESOLVE',from:'Seguimiento',to:'Resuelto',occurredAt:'2026-08-17T13:00:00.000Z',actor:{id:'actor-org-a',name:'Operario'},notes:'Sin signos activos',metadata:{}})

function state(){
 const site=(organizationId,name)=>({id:'site-shared',organizationId,companyId:organizationId,name})
 const house=(organizationId)=>({id:'house-shared',organizationId,siteId:'site-shared'})
 const bed=(organizationId)=>({id:'bed-shared',organizationId,houseId:'house-shared'})
 const plant=(organizationId)=>({id:'plant-shared',organizationId,bedId:'bed-shared'})
 const finding=(organizationId,notes)=>({id:'finding-shared',organizationId,siteId:'site-shared',targetType:'POSITION',targetId:'plant-shared',plantPositionId:'plant-shared',incidentId:'incident-shared',severity:3,status:'Resuelto',reportedAt:'2026-08-17T10:00:00.000Z',notes,mipeHistory:[created('finding-shared','Detectado',organizationId),{id:`finding-shared:followup:${organizationId}`,type:'IMPORTED',from:null,to:'Seguimiento',occurredAt:'2026-08-17T11:00:00.000Z',actor:{id:'legacy-import',name:'Migración legacy'},metadata:{legacyImported:true}},...(organizationId==='org-a'?[resolved('finding-shared')]:[{id:'finding-shared:resolve:org-b',type:'TRANSITION',transition:'RESOLVE',from:'Seguimiento',to:'Resuelto',occurredAt:'2026-08-17T13:00:00.000Z',actor:{id:'actor-org-b',name:'Operario B'},notes:'Foreign',metadata:{}}])],mipeHistoryVersion:3})
 const treatment=(organizationId,snapshotName)=>({id:'treatment-shared',organizationId,siteId:'site-shared',findingId:'finding-shared',productId:'product-shared',lotId:'lot-shared',status:'Ejecutado',dose:2,doseUnit:'mL/L',mixVolume:10,totalQuantity:20,inventoryUnit:'mL',executedAt:'2026-08-17T11:30:00.000Z',reentryUntil:'2026-08-17T23:30:00.000Z',harvestRestrictedUntil:'2026-08-20T11:30:00.000Z',productSnapshot:{name:snapshotName,unit:'mL',doseUnit:'mL/L',reentryHours:12,withdrawalDays:3,cost:10}})
 const intervention=(organizationId,outcome)=>({id:'intervention-shared',organizationId,siteId:'site-shared',findingId:'finding-shared',treatmentId:'treatment-shared',type:'Seguimiento',performedAt:'2026-08-17T12:30:00.000Z',outcome,responsible:'Operario'})
 return{
  currentContext:{companyId:'org-a'},companies:[{id:'org-a'},{id:'org-b'}],
  sites:[site('org-a','A'),site('org-b','B')],houses:[house('org-a'),house('org-b')],beds:[bed('org-a'),bed('org-b')],plantPositions:[plant('org-a'),plant('org-b')],
  incidents:[{id:'incident-shared',organizationId:'org-a',name:'Botritis histórica',active:true},{id:'incident-shared',organizationId:'org-b',name:'Foreign incident',active:true}],
  findings:[finding('org-a','Evidencia A'),finding('org-b','Foreign finding')],
  products:[{id:'product-shared',organizationId:'org-a',name:'PRODUCTO RENOMBRADO',unit:'mL'},{id:'product-shared',organizationId:'org-b',name:'Foreign product',unit:'mL'}],
  inventoryLots:[{id:'lot-shared',organizationId:'org-a',siteId:'site-shared',productId:'product-shared',lotNumber:'LOT-A'},{id:'lot-shared',organizationId:'org-b',siteId:'site-shared',productId:'product-shared',lotNumber:'LOT-B'}],
  treatments:[treatment('org-a','Producto histórico'),treatment('org-b','Foreign snapshot')],
  mipeInterventions:[intervention('org-a','Controlado'),intervention('org-b','Foreign outcome')]
 }
}

test('F011: Knowledge Graph MIPE proyecta Finding→Incident→Intervention/Treatment→Product/Lot→Restriction→Resolution dentro del tenant',()=>{
 const trace=projectMipePassportTrace(state(),{organizationId:'org-a',targetType:'POSITION',targetId:'plant-shared'})
 const types=new Set(trace.relationships.map(item=>item.targetType))
 for(const expected of['mipe.finding','mipe.incident','mipe.intervention','mipe.treatment','inventory.product','inventory.lot','mipe.restriction','mipe.resolution'])assert.ok(types.has(expected),`Falta ${expected}`)
 assert.ok(trace.relationships.every(item=>item.targetOrganizationId==='org-a'))
 assert.deepEqual(trace.summary.findingIds,['finding-shared'])
 assert.deepEqual(trace.summary.treatmentIds,['treatment-shared'])
 assert.deepEqual(trace.summary.interventionIds,['intervention-shared'])
 assert.equal(trace.summary.restrictionIds.length,2)
 assert.equal(trace.summary.resolutionIds.length,1)
 assert.equal(trace.relationships.some(item=>item.label.includes('Foreign')),false)
})

test('F011: Product histórico usa productSnapshot y no se reescribe cuando cambia el catálogo vivo',()=>{
 const current=state(),before=projectMipePassportTrace(current,{organizationId:'org-a',targetType:'POSITION',targetId:'plant-shared'})
 current.products.find(item=>item.organizationId==='org-a').name='OTRO NOMBRE VIVO'
 const after=projectMipePassportTrace(current,{organizationId:'org-a',targetType:'POSITION',targetId:'plant-shared'})
 const product=trace=>trace.relationships.find(item=>item.type==='treated_with_product')
 assert.equal(product(before).label,'Producto histórico')
 assert.equal(product(after).label,'Producto histórico')
 assert.equal(product(after).historicalSnapshots[0].name,'Producto histórico')
})

test('F011: resolución terminal permanece en el grafo y Planta eliminada no queda como riesgo abierto',()=>{
 const trace=projectMipePassportTrace(state(),{organizationId:'org-a',targetType:'POSITION',targetId:'plant-shared'})
 const resolution=trace.relationships.find(item=>item.targetType==='mipe.resolution')
 assert.equal(resolution.status,'Resuelto')
 assert.equal(resolution.notes,'Sin signos activos')
 assert.equal(isOpenPassportFinding({status:'Planta eliminada'}),false)
 assert.equal(isOpenPassportFinding({status:'Seguimiento'}),true)
})

test('F011: duplicado same-tenant en evidencia causal falla cerrado, pero duplicado ajeno no bloquea el Passport',()=>{
 const causal=state();causal.treatments.push({...causal.treatments.find(item=>item.organizationId==='org-a'),notes:'duplicado'})
 assert.throws(()=>projectMipePassportTrace(causal,{organizationId:'org-a',targetType:'POSITION',targetId:'plant-shared'}),/Treatment.*duplicada/i)
 const unrelated=state();unrelated.findings.push({id:'finding-other',organizationId:'org-a',siteId:'site-shared',targetType:'POSITION',targetId:'plant-other',plantPositionId:'plant-other',incidentId:'incident-shared',severity:1,status:'Detectado',reportedAt:'2026-08-17T10:00:00.000Z'});unrelated.treatments.push({id:'duplicate-other',organizationId:'org-a',siteId:'site-shared',findingId:'finding-other',productId:'product-shared',status:'Programado'},{id:'duplicate-other',organizationId:'org-a',siteId:'site-shared',findingId:'finding-other',productId:'product-shared',status:'Programado'})
 assert.doesNotThrow(()=>projectMipePassportTrace(unrelated,{organizationId:'org-a',targetType:'POSITION',targetId:'plant-shared'}))
})

test('F011: timeline causal usa identidades estables y conserva workflow/intervención/restricción',()=>{
 const trace=projectMipePassportTrace(state(),{organizationId:'org-a',targetType:'POSITION',targetId:'plant-shared'})
 const ids=trace.timeline.map(item=>item.id)
 assert.equal(new Set(ids).size,ids.length)
 assert.ok(ids.some(id=>id.startsWith('mipekg:workflow:')))
 assert.ok(ids.includes('mipekg:intervention:intervention-shared'))
 assert.ok(ids.includes('mipekg:restriction:treatment-shared:reentry'))
 assert.ok(ids.includes('mipekg:restriction:treatment-shared:withdrawal'))
})
