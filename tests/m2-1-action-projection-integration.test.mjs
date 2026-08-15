import test from'node:test'
import assert from'node:assert/strict'
import{PlantActions}from'../src/core/actions/index.js'
import{getEventBusForScope,publishDomainEvent,releaseEventBusScope}from'../src/core/events/index.js'
import{connectLedgerToEventBus,createMemoryLedgerRepository}from'../src/core/ledger/index.js'
import{createTimelineEngine,domainEventToTimelineEntry}from'../src/core/timeline/index.js'
import{createMaterialPlantPassportFromState}from'../src/core/passport/materialPlantPassport.js'
import{createKnowledgeGraphRepository,projectPassportToGraph}from'../src/core/knowledgeGraph/index.js'
import{MATERIAL_PLANT_TYPES}from'../src/domain/materialPlantIdentity.js'
import{PROPAGATION_PURPOSES}from'../src/domain/propagationPurpose.js'
import{executePlantAction}from'../src/services/plantActionEngine.js'

const fixture=()=>({
 companies:[{id:'org-a'}],
 sites:[{id:'site-a',companyId:'org-a',name:'Villeta'}],
 currentContext:{companyId:'org-a',siteId:'site-a'},
 users:[{id:'u1',activeSession:true,active:true,remote:true}],
 roles:[{id:'grower',permissions:['manage_cultivation']}],
 memberships:[{id:'m1',userId:'u1',companyId:'org-a',roleId:'grower',siteIds:['site-a'],status:'active'}],
 genetics:[{id:'gen-1',organizationId:'org-a',name:'Gen A',active:true}],
 motherPlants:[{id:'mother-lot',organizationId:'org-a',siteId:'site-a',geneticId:'gen-1',lotCode:'MAD-001',quantity:1,status:'Activa',healthStatus:'Sana',createdAt:'2026-08-01T00:00:00.000Z'}],
 grandmotherPlants:[],
 materialPlantUnits:[{id:'mother-1',organizationId:'org-a',plantType:MATERIAL_PLANT_TYPES.MOTHER,unitIndex:0,lotId:'mother-lot',siteId:'site-a',geneticId:'gen-1',code:'MAD-001-M001',status:'Activa',healthStatus:'Sana',operationalAvailability:'Disponible para corte',createdAt:'2026-08-01T00:00:00.000Z'}],
 propagationBanks:[{id:'bank-a',organizationId:'org-a',siteId:'site-a',name:'Banco A',active:true,trays:[{id:'tray-a',quantity:1,cellsPerTray:2}]}],
 propagationBatches:[],propagationUnits:[],lotEvents:[],attachments:[],findings:[],timelineEntries:[],plantEvents:[]
})

test('M21-F010: registered plant action flows through Domain Event, Ledger, Timeline, Passport and Graph',async()=>{
 let state=fixture()
 const scope={organizationId:'org-a',actorId:'u1'},bus=getEventBusForScope(scope),ledger=createMemoryLedgerRepository(),timeline=createTimelineEngine(),graph=createKnowledgeGraphRepository()
 const disconnectLedger=connectLedgerToEventBus(ledger,bus)
 const commit=recipe=>{state=recipe(state)}
 const target={type:'material-plant',id:'mother-1',organizationId:'org-a',siteId:'site-a',snapshot:{plantType:MATERIAL_PLANT_TYPES.MOTHER,geneticId:'gen-1'}}
 const input={commandId:'action-cut-1',occurredAt:'2026-08-15T05:00:00.000Z',siteId:'site-a',bankId:'bank-a',sourcePlantId:'mother-1',geneticId:'gen-1',purpose:PROPAGATION_PURPOSES.PRODUCTION,cutDate:'2026-08-15',sequence:1,quantity:1,operator:'Fer'}
 try{
  const executed=await executePlantAction(state,PlantActions.CREATE_PROPAGATION_BATCH,{target,input},{commit,publishEvent:event=>publishDomainEvent(state,event)})
  assert.equal(executed.actionId,PlantActions.CREATE_PROPAGATION_BATCH)
  assert.equal(state.propagationBatches.length,1)
  assert.equal(state.propagationUnits.length,1)
  assert.equal(state.propagationUnits[0].directParentPlantId,'mother-1')
  const ledgerEntries=ledger.find({organizationId:'org-a',aggregateId:'action-cut-1',order:'asc'})
  assert.deepEqual(ledgerEntries.map(entry=>entry.event.name),['core.operation.requested','propagation.batch.created'])
  assert.deepEqual(ledgerEntries.map(entry=>entry.event.eventId),['action-cut-1:requested','action-cut-1:completed'])
  for(const entry of ledgerEntries)timeline.record(domainEventToTimelineEntry(entry.event,{sequence:entry.sequence,recordedAt:entry.recordedAt,source:'operational-ledger'}))
  const timelineEntries=timeline.query({organizationId:'org-a',aggregateId:'action-cut-1',order:'asc'})
  assert.deepEqual(timelineEntries.map(entry=>entry.eventName),['core.operation.requested','propagation.batch.created'])
  assert.ok(timelineEntries.every(entry=>entry.source==='operational-ledger'))
  state.timelineEntries=timeline.query({organizationId:'org-a'})
  const passport=createMaterialPlantPassportFromState(state,{unitId:'mother-1'})
  assert.deepEqual(passport.actions.map(action=>action.id),[PlantActions.CREATE_PROPAGATION_BATCH])
  const projection=projectPassportToGraph(graph,passport)
  assert.deepEqual(projection.node.metadata.passportActions.map(action=>action.id),[PlantActions.CREATE_PROPAGATION_BATCH])
  assert.equal(projection.node.metadata.intelligentObject.objectId,'mother-1')
 }finally{
  disconnectLedger()
  releaseEventBusScope(scope)
 }
})
