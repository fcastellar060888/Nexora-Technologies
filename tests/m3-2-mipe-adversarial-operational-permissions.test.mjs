import test from'node:test'
import assert from'node:assert/strict'
import{DomainEvents}from'../src/core/events/eventCatalog.js'
import{executePlantPhaseTransitionCommand,preparePlantPhaseTransition}from'../src/services/plantPhaseTransitionCommand.js'
import{executePropagationBatchCommand}from'../src/services/propagationBatchCommand.js'

const materialId='material-plant:MOTHER:mother-b:1'
function state({allowedSites=['site-a']}={}){return{
 currentContext:{companyId:'org-a',siteId:'site-a'},companies:[{id:'org-a'}],
 users:[{id:'user-a',name:'Operador',activeSession:true,active:true,remote:true}],
 roles:[{id:'cultivation',permissions:['manage_cultivation']}],memberships:[{id:'m-a',userId:'user-a',companyId:'org-a',roleId:'cultivation',siteIds:allowedSites,status:'active'}],
 sites:[{id:'site-a',organizationId:'org-a',companyId:'org-a',name:'A'},{id:'site-b',organizationId:'org-a',companyId:'org-a',name:'B'}],
 houses:[{id:'house-b',organizationId:'org-a',siteId:'site-b',name:'Nave B'}],beds:[{id:'bed-b',organizationId:'org-a',siteId:'site-b',houseId:'house-b',name:'Cama B'}],
 plantPositions:[{id:'plant-b',organizationId:'org-a',siteId:'site-b',houseId:'house-b',bedId:'bed-b',currentPhase:'Floración',active:true}],phaseTransitions:[],
 findings:[],treatments:[],
 genetics:[{id:'g-b',organizationId:'org-a',name:'G',code:'G',active:true}],
 propagationBanks:[{id:'bank-b',organizationId:'org-a',siteId:'site-b',name:'Banco B',active:true,trays:[{id:'tray-b',quantity:1,cellsPerTray:30}]}],propagationUnits:[],propagationBatches:[],lotEvents:[],
 motherPlants:[{id:'mother-b',organizationId:'org-a',siteId:'site-b',geneticId:'g-b',lotCode:'MAD-B',quantity:1,status:'Activa',healthStatus:'Sana',createdAt:'2026-08-01T00:00:00.000Z'}],grandmotherPlants:[],
 materialPlantUnits:[{id:materialId,organizationId:'org-a',lotId:'mother-b',plantType:'MOTHER',unitIndex:0,siteId:'site-b',geneticId:'g-b',status:'Activa',healthStatus:'Sana',operationalAvailability:'Disponible para corte',createdAt:'2026-08-01T00:00:00.000Z'}]
}}
function phaseRequest(){return{plantId:'plant-b',fromPhase:'Floración',toPhase:'Vegetativo',date:'2026-08-18',commandId:'phase-b',occurredAt:'2026-08-18T10:00:00.000Z'}}
function propagationRequest(){return{batchId:'batch-b',commandId:'cut-b',occurredAt:'2026-08-18T10:00:00.000Z',siteId:'site-b',bankId:'bank-b',sourcePlantId:materialId,geneticId:'g-b',quantity:1,purpose:'PRODUCTION',productionLotId:'prod-b',cutDate:'2026-08-18',sequence:1}}

test('F012: prepare de fase rechaza site/house/bed declarados que contradigan la ascendencia canónica',()=>{
 const current=state({allowedSites:['site-b']})
 assert.throws(()=>preparePlantPhaseTransition(current,{...phaseRequest(),siteId:'site-a'},{commandId:'phase-spoof',occurredAt:'2026-08-18T10:00:00.000Z'}),/ubicación|sede.*contradictoria|siteId/i)
 assert.throws(()=>preparePlantPhaseTransition(current,{...phaseRequest(),houseId:'house-fake'},{commandId:'phase-house-spoof',occurredAt:'2026-08-18T10:00:00.000Z'}),/ubicación|nave.*contradictoria|houseId/i)
 assert.throws(()=>preparePlantPhaseTransition(current,{...phaseRequest(),bedId:'bed-fake'},{commandId:'phase-bed-spoof',occurredAt:'2026-08-18T10:00:00.000Z'}),/ubicación|cama.*contradictoria|bedId/i)
})

test('F012: execute de fase autoriza contra la sede real del target y no contra currentContext',async()=>{
 let current=state(),events=[]
 const deps={publishEvent:async event=>{events.push(event);return event},commit:recipe=>{current=recipe(current)}}
 await assert.rejects(()=>executePlantPhaseTransitionCommand(current,phaseRequest(),deps),/permiso.*sede|permiso.*fase|manage_cultivation/i)
 assert.deepEqual(events,[])
 assert.deepEqual(current.phaseTransitions,[])
 assert.equal(current.plantPositions[0].currentPhase,'Floración')
})

test('F012: fase revalida permiso target-scoped entre requested y commit',async()=>{
 let current=state({allowedSites:['site-b']}),events=[]
 const deps={publishEvent:async event=>{events.push(event);if(event.name===DomainEvents.CORE_OPERATION_REQUESTED)current={...current,memberships:current.memberships.map(item=>({...item,siteIds:['site-a']}))};return event},commit:recipe=>{current=recipe(current)}}
 await assert.rejects(()=>executePlantPhaseTransitionCommand(current,phaseRequest(),deps),/permiso.*sede|permiso.*fase|manage_cultivation/i)
 assert.equal(events.length,1)
 assert.equal(events[0].name,DomainEvents.CORE_OPERATION_REQUESTED)
 assert.deepEqual(current.phaseTransitions,[])
 assert.equal(current.plantPositions[0].currentPhase,'Floración')
})

test('F012: propagación autoriza contra siteId del banco/origen y no contra currentContext',async()=>{
 let current=state(),events=[]
 const deps={publishEvent:async event=>{events.push(event);return event},commit:recipe=>{current=recipe(current)}}
 await assert.rejects(()=>executePropagationBatchCommand(current,propagationRequest(),deps),/permiso.*sede|permiso.*propagación|manage_cultivation/i)
 assert.deepEqual(events,[])
 assert.deepEqual(current.propagationBatches,[])
 assert.deepEqual(current.propagationUnits,[])
})

test('F012: propagación revalida bloqueo MIPE entre requested y commit',async()=>{
 let current=state({allowedSites:['site-b']}),events=[]
 const deps={publishEvent:async event=>{events.push(event);if(event.name===DomainEvents.CORE_OPERATION_REQUESTED)current={...current,findings:[...current.findings,{id:'late-block',organizationId:'org-a',siteId:'site-b',targetType:'MATERIAL_PLANT',targetId:materialId,materialPlantId:materialId,incidentId:'late-incident',status:'Detectado',restrictsPropagation:true,reportedAt:'2026-08-18T09:00:00.000Z'}],incidents:[{id:'late-incident',organizationId:'org-a',name:'Late'}]};return event},commit:recipe=>{current=recipe(current)}}
 await assert.rejects(()=>executePropagationBatchCommand(current,propagationRequest(),deps),/bloque|elegible|MIPE/i)
 assert.equal(events.length,1)
 assert.deepEqual(current.propagationBatches,[])
 assert.deepEqual(current.propagationUnits,[])
})
