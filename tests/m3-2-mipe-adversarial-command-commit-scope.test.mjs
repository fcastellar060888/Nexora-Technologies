import test from'node:test'
import assert from'node:assert/strict'
import{DomainEvents}from'../src/core/events/eventCatalog.js'
import{appendMaterialPlantFindings}from'../src/domain/materialPlantMipe.js'
import{executeTreatment,isFollowUpDue,scheduleTreatment}from'../src/domain/mipe.js'
import{MIPE_OPERATIONS,executeMipeCommand}from'../src/services/mipeCommand.js'

function state(){return{
 currentContext:{companyId:'org-a',siteId:'site-a'},companies:[{id:'org-a'}],
 users:[{id:'user-a',name:'Operador MIPE',activeSession:true,active:true,remote:true}],
 roles:[{id:'mipe-site',permissions:['manage_mipe']}],memberships:[{id:'membership-a',userId:'user-a',companyId:'org-a',roleId:'mipe-site',siteIds:['site-a'],status:'active'}],
 sites:[{id:'site-a',organizationId:'org-a',companyId:'org-a',name:'A'},{id:'site-b',organizationId:'org-a',companyId:'org-a',name:'B'}],
 houses:[{id:'house-a',organizationId:'org-a',siteId:'site-a'},{id:'house-b',organizationId:'org-a',siteId:'site-b'}],
 beds:[{id:'bed-a',organizationId:'org-a',siteId:'site-a',houseId:'house-a'},{id:'bed-b',organizationId:'org-a',siteId:'site-b',houseId:'house-b'}],
 plantPositions:[{id:'plant-a',organizationId:'org-a',siteId:'site-a',houseId:'house-a',bedId:'bed-a',active:true}],
 incidents:[{id:'incident-a',organizationId:'org-a',name:'Botritis',active:true}],findings:[],treatments:[],mipeInterventions:[],mipeCommandReceipts:[],
 grandmotherPlants:[],motherPlants:[],materialPlantUnits:[],genetics:[],products:[],inventoryLots:[],inventoryMovements:[],costEntries:[],plantEvents:[]
}}
function request(){return{operation:MIPE_OPERATIONS.CREATE_FINDING,input:{plantPositionId:'plant-a',incidentId:'incident-a',severity:3,notes:'Prueba commit-scope'},commandId:'cmd-mipe-commit-scope',occurredAt:'2026-08-17T19:58:00.000Z'}}
function openFinding(){return{id:'finding-a',organizationId:'org-a',siteId:'site-a',plantPositionId:'plant-a',targetType:'POSITION',targetId:'plant-a',incidentId:'incident-a',severity:3,status:'Seguimiento',reportedAt:'2026-08-17T18:00:00.000Z',createdAt:'2026-08-17T18:00:00.000Z'}}
function treatmentFinding(){return{...openFinding(),status:'Detectado'}}
function product(){return{id:'product-a',organizationId:'org-a',siteId:'site-a',name:'Bio',category:'MIPE',active:true,unit:'mL',doseUnit:'mL/L',doseMin:1,doseMax:5,reentryHours:12,withdrawalDays:2,cost:10,technicalRevision:1}}

test('F012: MIPE revalida permiso site-scoped entre requested y commit',async()=>{
 let current=state(),events=[]
 const deps={
  publishEvent:async event=>{events.push(event);if(event.name===DomainEvents.CORE_OPERATION_REQUESTED)current={...current,memberships:current.memberships.map(item=>({...item,siteIds:['site-b']}))};return event},
  commit:recipe=>{current=recipe(current)}
 }
 await assert.rejects(()=>executeMipeCommand(current,request(),deps),/permiso manage_mipe|sede real|site/i)
 assert.equal(events.length,1)
 assert.equal(events[0].name,DomainEvents.CORE_OPERATION_REQUESTED)
 assert.deepEqual(current.findings,[])
 assert.deepEqual(current.mipeCommandReceipts,[])
})

test('F012: MIPE revalida la sede causal del target entre requested y commit',async()=>{
 let current=state(),events=[]
 const deps={
  publishEvent:async event=>{events.push(event);if(event.name===DomainEvents.CORE_OPERATION_REQUESTED)current={...current,plantPositions:current.plantPositions.map(item=>item.id==='plant-a'?{...item,siteId:'site-b',houseId:'house-b',bedId:'bed-b'}:item)};return event},
  commit:recipe=>{current=recipe(current)}
 }
 await assert.rejects(()=>executeMipeCommand(current,request(),deps),/sede.*cambió|target.*cambió|ubicación|permiso manage_mipe/i)
 assert.equal(events.length,1)
 assert.equal(events[0].name,DomainEvents.CORE_OPERATION_REQUESTED)
 assert.deepEqual(current.findings,[])
 assert.deepEqual(current.mipeCommandReceipts,[])
})

test('F012: CREATE_FINDING revalida Incident usable entre requested y commit',async()=>{
 let current=state(),events=[]
 const deps={
  publishEvent:async event=>{events.push(event);if(event.name===DomainEvents.CORE_OPERATION_REQUESTED)current={...current,incidents:current.incidents.map(item=>item.id==='incident-a'?{...item,active:false,archivedAt:'2026-08-17T19:58:30.000Z'}:item)};return event},
  commit:recipe=>{current=recipe(current)}
 }
 await assert.rejects(()=>executeMipeCommand(current,{...request(),commandId:'cmd-incident-toctou'},deps),/incidencia.*archivada|no admite nuevos hallazgos/i)
 assert.equal(events.length,1)
 assert.deepEqual(current.findings,[])
 assert.deepEqual(current.mipeCommandReceipts,[])
})

test('F012: RECORD_INTERVENTION revalida que Finding siga abierto entre requested y commit',async()=>{
 let current={...state(),findings:[openFinding()]},events=[]
 const deps={
  publishEvent:async event=>{events.push(event);if(event.name===DomainEvents.CORE_OPERATION_REQUESTED)current={...current,findings:current.findings.map(item=>item.id==='finding-a'?{...item,status:'Resuelto'}:item)};return event},
  commit:recipe=>{current=recipe(current)}
 }
 const command={operation:MIPE_OPERATIONS.RECORD_INTERVENTION,input:{findingId:'finding-a',type:'Seguimiento',outcome:'Sin signos activos',performedAt:'2026-08-17T20:00:00.000Z'},commandId:'cmd-intervention-toctou',occurredAt:'2026-08-17T20:00:00.000Z'}
 await assert.rejects(()=>executeMipeCommand(current,command,deps),/cerrado|no admite nuevas intervenciones|no admite nueva evidencia/i)
 assert.equal(events.length,1)
 assert.deepEqual(current.mipeInterventions,[])
 assert.deepEqual(current.mipeCommandReceipts,[])
})

test('F012: SCHEDULE_TREATMENT no congela un Product que fue archivado después de requested',async()=>{
 let current={...state(),findings:[treatmentFinding()],products:[product()]},events=[]
 const deps={
  publishEvent:async event=>{events.push(event);if(event.name===DomainEvents.CORE_OPERATION_REQUESTED)current={...current,products:current.products.map(item=>item.id==='product-a'?{...item,active:false,archivedAt:'2026-08-17T20:00:30.000Z'}:item)};return event},
  commit:recipe=>{current=recipe(current)}
 }
 const command={operation:MIPE_OPERATIONS.SCHEDULE_TREATMENT,input:{findingId:'finding-a',productId:'product-a',dose:2,doseUnit:'mL/L',mixVolume:10,date:'2026-08-18'},commandId:'cmd-product-toctou',occurredAt:'2026-08-17T20:00:00.000Z'}
 await assert.rejects(()=>executeMipeCommand(current,command,deps),/producto MIPE.*archivado|inactivo|perfil técnico.*cambió/i)
 assert.equal(events.length,1)
 assert.deepEqual(current.treatments,[])
 assert.deepEqual(current.mipeCommandReceipts,[])
})

test('F012: helper material revalida Incident actual antes de anexar Findings',()=>{
 const archived={...state(),incidents:[{id:'incident-a',organizationId:'org-a',name:'Botritis',active:false,archivedAt:'2026-08-17T20:00:30.000Z'}]}
 const plant={id:'material-a',organizationId:'org-a',siteId:'site-a',plantType:'MOTHER',lotId:'mother-a',unitIndex:0,code:'M-A001'}
 assert.throws(()=>appendMaterialPlantFindings(archived,[plant],{incidentId:'incident-a',type:'Botritis',severity:'Crítica',reportedAt:'2026-08-17T20:00:00.000Z'}),/incidencia.*archivada|no admite nuevos hallazgos/i)
 assert.deepEqual(archived.findings,[])
})

test('F012: helper directo no programa Treatment ni seguimiento sobre Planta eliminada',()=>{
 const closed={...openFinding(),status:'Planta eliminada',followUpDate:'2026-08-16'}
 const p=product()
 assert.throws(()=>scheduleTreatment({findings:[closed],products:[p],treatments:[]},{id:'treatment-a',findingId:'finding-a',productId:'product-a',dose:2,doseUnit:'mL/L',mixVolume:10,createdAt:'2026-08-17T20:00:00.000Z'}),/hallazgo cerrado/i)
 assert.equal(isFollowUpDue(closed),false)
})

test('F012: executeTreatment directo no consume inventario ni reabre un Finding terminal',()=>{
 for(const status of ['Resuelto','Falso positivo','Planta eliminada']){
  const finding={...openFinding(),status},p=product()
  const treatment={id:'treatment-a',organizationId:'org-a',siteId:'site-a',findingId:'finding-a',productId:'product-a',dose:2,doseUnit:'mL/L',mixVolume:10,totalQuantity:20,inventoryUnit:'mL',status:'Programado',createdAt:'2026-08-17T18:30:00.000Z'}
  const lot={id:'lot-a',organizationId:'org-a',siteId:'site-a',productId:'product-a',quantity:100,unit:'mL'}
  const before={findings:[finding],products:[p],treatments:[treatment],inventoryLots:[lot],inventoryMovements:[],costEntries:[]}
  assert.throws(()=>executeTreatment(before,{treatmentId:'treatment-a',lotId:'lot-a',responsible:'Operador',executedAt:'2026-08-17T20:30:00.000Z',siteId:'site-a',movementId:`movement-${status}`,costEntryId:`cost-${status}`}),/hallazgo.*cerrado|terminal/i)
  assert.equal(before.inventoryLots[0].quantity,100)
  assert.deepEqual(before.inventoryMovements,[])
  assert.equal(before.findings[0].status,status)
 }
})
