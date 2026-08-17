import test from'node:test'
import assert from'node:assert/strict'
import{PROPAGATION_PURPOSES,propagationSourceUnits}from'../src/domain/propagationPurpose.js'
import{preparePlantPhaseTransition}from'../src/services/plantPhaseTransitionCommand.js'
import{preparePropagationBatch}from'../src/services/propagationBatchCommand.js'

function phaseState(){return{
 currentContext:{companyId:'org-a'},currentUser:{id:'u1',name:'Admin',role:'Administrador'},
 companies:[{id:'org-a',name:'A'},{id:'org-b',name:'B'}],sites:[{id:'site-a',companyId:'org-a'},{id:'site-b',companyId:'org-b'}],houses:[],beds:[],
 plantPositions:[
  {id:'plant-1',organizationId:'org-a',siteId:'site-a',currentPhase:'Floración'},
  {id:'plant-1',organizationId:'org-b',siteId:'site-b',currentPhase:'Floración'},
  {id:'plant-2',organizationId:'org-a',siteId:'site-a',currentPhase:'Floración'}
 ],
 findings:[{id:'finding-1',organizationId:'org-a',siteId:'site-a',targetType:'POSITION',targetId:'plant-1',plantPositionId:'plant-1',status:'Seguimiento',createdAt:'2026-08-17T08:00:00.000Z'}],
 treatments:[{id:'treatment-1',organizationId:'org-a',siteId:'site-a',findingId:'finding-1',status:'Ejecutado',executedAt:'2026-08-17T09:00:00.000Z',reentryUntil:'2026-08-17T21:00:00.000Z',harvestRestrictedUntil:'2026-08-20T09:00:00.000Z'}],
 phaseTransitions:[]
}}

test('F009: llamada directa al executor de fase no puede saltar reentrada',()=>{
 const state=phaseState()
 assert.throws(()=>preparePlantPhaseTransition(state,{plantId:'plant-1',fromPhase:'Floración',toPhase:'Vegetativo',date:'2026-08-17',siteId:'site-a'},{commandId:'phase-reentry',occurredAt:'2026-08-17T10:00:00.000Z'}),/reentrada/i)
})

test('F009: llamada directa a cosecha no puede saltar carencia',()=>{
 const state=phaseState()
 assert.throws(()=>preparePlantPhaseTransition(state,{plantId:'plant-1',fromPhase:'Floración',toPhase:'Cosecha',date:'2026-08-18',siteId:'site-a'},{commandId:'phase-harvest',occurredAt:'2026-08-18T10:00:00.000Z'}),/carencia/i)
 const prepared=preparePlantPhaseTransition(state,{plantId:'plant-1',fromPhase:'Floración',toPhase:'Cosecha',date:'2026-08-20',siteId:'site-a'},{commandId:'phase-harvest-ok',occurredAt:'2026-08-20T09:00:00.000Z'})
 assert.equal(prepared.transition.toPhase,'Cosecha')
})

test('F009: commandId de fase admite replay idéntico y rechaza colisión de payload',()=>{
 const state=phaseState();state.findings=[];state.treatments=[];state.phaseTransitions=[{id:'phase-cmd',commandId:'phase-cmd',organizationId:'org-a',entityType:'plant',entityId:'plant-1',plantId:'plant-1',fromPhase:'Floración',toPhase:'Cosecha',date:'2026-08-20',siteId:'site-a',houseId:'',bedId:'',responsible:'Ana',notes:'ok'}]
 const retry=preparePlantPhaseTransition(state,{plantId:'plant-1',fromPhase:'Floración',toPhase:'Cosecha',date:'2026-08-20',siteId:'site-a',responsible:'Ana',notes:'ok'},{commandId:'phase-cmd',occurredAt:'2026-08-20T10:00:00.000Z'})
 assert.equal(retry.retry,true)
 assert.throws(()=>preparePlantPhaseTransition(state,{plantId:'plant-2',fromPhase:'Floración',toPhase:'Cosecha',date:'2026-08-20',siteId:'site-a',responsible:'Ana',notes:'ok'},{commandId:'phase-cmd',occurredAt:'2026-08-20T10:00:00.000Z'}),/commandId.*plantId/i)
 assert.throws(()=>preparePlantPhaseTransition(state,{plantId:'plant-1',fromPhase:'Floración',toPhase:'Vegetativo',date:'2026-08-20',siteId:'site-a',responsible:'Ana',notes:'ok'},{commandId:'phase-cmd',occurredAt:'2026-08-20T10:00:00.000Z'}),/commandId.*toPhase/i)
})

test('F009: commandId homónimo de otro tenant no se trata como replay del tenant activo',()=>{
 const state=phaseState();state.findings=[];state.treatments=[];state.phaseTransitions=[{id:'same-cmd',commandId:'same-cmd',organizationId:'org-b',entityType:'plant',entityId:'plant-1',plantId:'plant-1',fromPhase:'Floración',toPhase:'Cosecha',date:'2026-08-20',siteId:'site-b'}]
 const prepared=preparePlantPhaseTransition(state,{plantId:'plant-1',fromPhase:'Floración',toPhase:'Vegetativo',date:'2026-08-20',siteId:'site-a'},{commandId:'same-cmd',occurredAt:'2026-08-20T10:00:00.000Z'})
 assert.equal(prepared.retry,false)
 assert.equal(prepared.organizationId,'org-a')
})

function propagationState({availability='Disponible para corte',findingStatus='Detectado',withFinding=true}={}){return{
 currentContext:{companyId:'org-a'},
 companies:[{id:'org-a',name:'A'}],sites:[{id:'site-a',name:'Site A',companyId:'org-a'}],
 geneticProfiles:[{id:'g-1',organizationId:'org-a',name:'G1',code:'G1',active:true}],
 propagationBanks:[{id:'bank-1',organizationId:'org-a',siteId:'site-a',name:'Banco 1',active:true,trays:[{id:'tray-1',quantity:1,cellsPerTray:30}]}],propagationUnits:[],propagationBatches:[],lotEvents:[],
 motherPlants:[{id:'mother-lot',organizationId:'org-a',siteId:'site-a',geneticId:'g-1',lotCode:'MAD-01',quantity:1,status:'Activa',healthStatus:'Sana',createdAt:'2026-08-01T00:00:00.000Z'}],grandmotherPlants:[],
 materialPlantUnits:[{id:'mother-unit-1',organizationId:'org-a',lotId:'mother-lot',plantType:'MOTHER',unitIndex:0,siteId:'site-a',geneticId:'g-1',status:'Activa',healthStatus:'Sana',operationalAvailability:availability,createdAt:'2026-08-01T00:00:00.000Z'}],
 findings:withFinding?[{id:'material-finding',organizationId:'org-a',siteId:'site-a',targetType:'MATERIAL_PLANT',targetId:'mother-unit-1',materialPlantId:'mother-unit-1',status:findingStatus,restrictsPropagation:true,createdAt:'2026-08-17T08:00:00.000Z',reportedAt:'2026-08-17T08:00:00.000Z'}]:[],treatments:[]
}}

test('F009: override manual Disponible no puede liberar una madre con bloqueo MIPE activo',()=>{
 const state=propagationState({availability:'Disponible para corte',findingStatus:'Detectado'})
 assert.equal(propagationSourceUnits(state,{organizationId:'org-a',siteId:'site-a',at:'2026-08-17T10:00:00.000Z'}).length,0)
 assert.throws(()=>preparePropagationBatch(state,{batchId:'batch-1',siteId:'site-a',bankId:'bank-1',sourcePlantId:'mother-unit-1',geneticId:'g-1',quantity:1,purpose:PROPAGATION_PURPOSES.PRODUCTION,cutDate:'2026-08-17',sequence:1},{commandId:'cut-1',occurredAt:'2026-08-17T10:00:00.000Z'}),/no es elegible|bloque/i)
})

test('F009: bloqueo legacy sin causalidad canónica permanece fail-closed',()=>{
 const state=propagationState({availability:'Bloqueada por MIPE',withFinding:false})
 assert.equal(propagationSourceUnits(state,{organizationId:'org-a',siteId:'site-a',at:'2026-08-17T10:00:00.000Z'}).length,0)
})

test('F009: bloqueo legacy stale se libera solo si existe evidencia canónica terminal',()=>{
 const state=propagationState({availability:'Bloqueada por MIPE',findingStatus:'Resuelto'})
 const sources=propagationSourceUnits(state,{organizationId:'org-a',siteId:'site-a',at:'2026-08-17T10:00:00.000Z'})
 assert.equal(sources.length,1)
 assert.equal(sources[0].id,'mother-unit-1')
 assert.equal(sources[0].operationalAvailability,'Disponible para corte')
 const prepared=preparePropagationBatch(state,{batchId:'batch-ok',siteId:'site-a',bankId:'bank-1',sourcePlantId:'mother-unit-1',geneticId:'g-1',quantity:1,purpose:PROPAGATION_PURPOSES.PRODUCTION,cutDate:'2026-08-17',sequence:1},{commandId:'cut-ok',occurredAt:'2026-08-17T10:00:00.000Z'})
 assert.equal(prepared.batch.sourcePlantId,'mother-unit-1')
})
