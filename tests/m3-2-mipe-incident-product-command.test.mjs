import test from'node:test'
import assert from'node:assert/strict'
import{DomainEvents}from'../src/core/events/eventCatalog.js'
import{executeMipeCommand,MIPE_OPERATIONS}from'../src/services/mipeCommand.js'

function baseState(){return{
 companies:[{id:'org-a'},{id:'org-b'}],currentContext:{companyId:'org-a',siteId:'site-a'},
 users:[{id:'user-a',name:'Agrónomo',role:'Encargado MIPE',activeSession:true,active:true,remote:false}],memberships:[],roles:[],
 sites:[{id:'site-a',organizationId:'org-a',companyId:'org-a'},{id:'site-b',organizationId:'org-b',companyId:'org-b'}],
 houses:[{id:'house-a',organizationId:'org-a',siteId:'site-a'}],beds:[{id:'bed-a',organizationId:'org-a',siteId:'site-a',houseId:'house-a'}],
 plantPositions:[{id:'plant-a',organizationId:'org-a',siteId:'site-a',bedId:'bed-a',active:true}],grandmotherPlants:[],motherPlants:[],materialPlantUnits:[],plantEvents:[],genetics:[],
 incidents:[{id:'incident-a',organizationId:'org-a',name:'Botrytis',category:'Enfermedad',risk:'Alto',active:true,validFrom:'2026-01-01T00:00:00.000Z',validUntil:'2026-12-31T23:59:59.000Z'},{id:'incident-b',organizationId:'org-a',name:'Trips',category:'Plaga',risk:'Medio',active:true},{id:'incident-a',organizationId:'org-b',name:'Foreign',category:'Plaga',risk:'Bajo',active:true}],
 findings:[{id:'finding-a',organizationId:'org-a',siteId:'site-a',plantPositionId:'plant-a',targetType:'POSITION',targetId:'plant-a',incidentId:'incident-a',status:'Detectado',severity:3,reportedAt:'2026-08-17T08:00:00.000Z'}],
 products:[{id:'product-shared',organizationId:'org-a',siteId:'site-a',name:'BioControl A',category:'MIPE',activeIngredient:'Azadiractina',manufacturer:'Lab A',registrationNumber:'ICA-A',unit:'mL',doseMin:1,doseMax:3,doseUnit:'mL/L',cost:4,reentryHours:12,withdrawalDays:2,technicalRevision:4,validFrom:'2026-01-01T00:00:00.000Z',validUntil:'2026-12-31T23:59:59.000Z',active:true},{id:'product-shared',organizationId:'org-b',siteId:'site-b',name:'BioControl B',category:'MIPE',unit:'mL',doseMin:1,doseMax:5,doseUnit:'mL/L',cost:99,reentryHours:48,withdrawalDays:10,technicalRevision:9,active:true}],
 inventoryLots:[{id:'lot-a',organizationId:'org-a',siteId:'site-a',productId:'product-shared',lotNumber:'LOT-A',quantity:1000}],inventoryMovements:[],costEntries:[],treatments:[],mipeInterventions:[],mipeCommandReceipts:[]
}}
function harness(initial=baseState()){let state=structuredClone(initial);const events=[];return{events,get state(){return state},setState(next){state=next},deps:{publishEvent:async spec=>{events.push(structuredClone(spec));return spec},commit:recipe=>{state=recipe(state)}}}}

async function schedule(h,{commandId='schedule-a',date='2026-08-17',doseUnit='mL/L'}={}){
 return executeMipeCommand(h.state,{operation:MIPE_OPERATIONS.SCHEDULE_TREATMENT,input:{findingId:'finding-a',productId:'product-shared',dose:2,doseUnit,mixVolume:100,date,responsible:'Agrónomo'},commandId,occurredAt:'2026-08-17T09:00:00.000Z'},h.deps)
}

test('M32-F007: archiving an Incident preserves identity and historical Finding references',async()=>{
 const h=harness(),before=h.state.incidents.length
 await executeMipeCommand(h.state,{operation:MIPE_OPERATIONS.ARCHIVE_INCIDENT,entityId:'incident-a',input:{reason:'Reemplazada por taxonomía vigente'},commandId:'archive-a',occurredAt:'2026-08-17T10:00:00.000Z'},h.deps)
 const incident=h.state.incidents.find(item=>item.organizationId==='org-a'&&item.id==='incident-a')
 assert.equal(h.state.incidents.length,before)
 assert.equal(incident.active,false)
 assert.equal(incident.lifecycleHistory.length,1)
 assert.equal(h.state.findings[0].incidentId,'incident-a')
 assert.equal(h.events.at(-1).name,DomainEvents.MIPE_INCIDENT_ARCHIVED)
 await executeMipeCommand(h.state,{operation:MIPE_OPERATIONS.ARCHIVE_INCIDENT,entityId:'incident-a',input:{reason:'Reemplazada por taxonomía vigente'},commandId:'archive-a',occurredAt:'2026-08-17T10:00:00.000Z'},h.deps)
 assert.equal(h.state.incidents.find(item=>item.organizationId==='org-a'&&item.id==='incident-a').lifecycleHistory.length,1)
})

test('M32-F007: DELETE_INCIDENT remains a non-destructive compatibility alias',async()=>{
 const h=harness(),before=h.state.incidents.length
 await executeMipeCommand(h.state,{operation:MIPE_OPERATIONS.DELETE_INCIDENT,entityId:'incident-b',input:{reason:'Alias legacy'},commandId:'legacy-delete',occurredAt:'2026-08-17T10:00:00.000Z'},h.deps)
 assert.equal(h.state.incidents.length,before)
 assert.equal(h.state.incidents.find(item=>item.id==='incident-b').active,false)
 assert.equal(h.events.at(-1).name,DomainEvents.MIPE_INCIDENT_ARCHIVED)
})

test('M32-F007: archived or not-yet-valid Incidents cannot create new Findings',async()=>{
 const archived=baseState();archived.incidents=archived.incidents.map(item=>item.organizationId==='org-a'&&item.id==='incident-a'?{...item,active:false,archivedAt:'2026-08-17T07:00:00.000Z'}:item);let h=harness(archived)
 await assert.rejects(()=>executeMipeCommand(h.state,{operation:MIPE_OPERATIONS.CREATE_FINDING,input:{plantPositionId:'plant-a',incidentId:'incident-a',severity:2},commandId:'finding-archived',occurredAt:'2026-08-17T10:00:00.000Z'},h.deps),/archivada/)
 assert.deepEqual(h.events,[])
 const future=baseState();future.incidents=future.incidents.map(item=>item.organizationId==='org-a'&&item.id==='incident-a'?{...item,validFrom:'2026-09-01T00:00:00.000Z'}:item);h=harness(future)
 await assert.rejects(()=>executeMipeCommand(h.state,{operation:MIPE_OPERATIONS.CREATE_FINDING,input:{plantPositionId:'plant-a',incidentId:'incident-a',severity:2},commandId:'finding-future',occurredAt:'2026-08-17T10:00:00.000Z'},h.deps),/todavía no está vigente/)
 assert.deepEqual(h.events,[])
})

test('M32-F007: scheduling freezes only the active-tenant technical Product profile',async()=>{
 const h=harness();await schedule(h)
 const treatment=h.state.treatments.find(item=>item.id==='schedule-a')
 assert.equal(treatment.organizationId,'org-a')
 assert.equal(treatment.productSnapshot.id,'product-shared')
 assert.equal(treatment.productSnapshot.organizationId,'org-a')
 assert.equal(treatment.productSnapshot.name,'BioControl A')
 assert.equal(treatment.productSnapshot.cost,4)
 assert.equal(treatment.productSnapshot.reentryHours,12)
 assert.equal(treatment.productSnapshot.withdrawalDays,2)
 assert.equal(treatment.productSnapshot.technicalRevision,4)
 assert.equal(treatment.productSnapshot.registrationNumber,'ICA-A')
 assert.equal(h.events.at(-1).payload.productTechnicalRevision,4)
})

test('M32-F007: live Product mutation after approval cannot rewrite execution cost or restrictions',async()=>{
 const h=harness();await schedule(h)
 h.setState({...h.state,products:h.state.products.map(item=>item.organizationId==='org-a'&&item.id==='product-shared'?{...item,cost:500,reentryHours:72,withdrawalDays:30,name:'EDITADO',active:false}:item)})
 await executeMipeCommand(h.state,{operation:MIPE_OPERATIONS.EXECUTE_TREATMENT,entityId:'schedule-a',input:{lotId:'lot-a',responsible:'Aplicador'},commandId:'execute-a',occurredAt:'2026-08-18T10:00:00.000Z'},h.deps)
 const treatment=h.state.treatments.find(item=>item.id==='schedule-a'),cost=h.state.costEntries.find(item=>item.treatmentId==='schedule-a')
 assert.equal(treatment.cost,800)
 assert.equal(cost.amount,800)
 assert.equal(treatment.reentryUntil,'2026-08-18T22:00:00.000Z')
 assert.equal(treatment.harvestRestrictedUntil,'2026-08-20T10:00:00.000Z')
 assert.equal(treatment.productSnapshot.name,'BioControl A')
 assert.equal(h.state.inventoryLots.find(item=>item.id==='lot-a').quantity,800)
})

test('M32-F007: snapshot expiration blocks execution without inventory or completion mutation',async()=>{
 const state=baseState();state.products=state.products.map(item=>item.organizationId==='org-a'?{...item,validUntil:'2026-08-17T23:59:59.000Z'}:item);const h=harness(state);await schedule(h)
 const eventsBefore=h.events.length,quantityBefore=h.state.inventoryLots.find(item=>item.id==='lot-a').quantity
 await assert.rejects(()=>executeMipeCommand(h.state,{operation:MIPE_OPERATIONS.EXECUTE_TREATMENT,entityId:'schedule-a',input:{lotId:'lot-a'},commandId:'expired-execution',occurredAt:'2026-08-18T10:00:00.000Z'},h.deps),/ya no está vigente/)
 assert.equal(h.state.inventoryLots.find(item=>item.id==='lot-a').quantity,quantityBefore)
 assert.equal(h.state.treatments.find(item=>item.id==='schedule-a').status,'Programado')
 assert.equal(h.events.slice(eventsBefore).some(item=>item.name===DomainEvents.MIPE_TREATMENT_EXECUTED),false)
})

test('M32-F007: dose-unit mismatch fails before requested event',async()=>{
 const h=harness()
 await assert.rejects(()=>schedule(h,{commandId:'wrong-unit',doseUnit:'mL/100 L'}),/no coincide/)
 assert.deepEqual(h.events,[])
 assert.equal(h.state.treatments.length,0)
})

test('M32-F007: Treatment Intervention cannot be fabricated from free-text product evidence',async()=>{
 const h=harness()
 await assert.rejects(()=>executeMipeCommand(h.state,{operation:MIPE_OPERATIONS.RECORD_INTERVENTION,input:{findingId:'finding-a',type:'Tratamiento',product:'Texto libre',dose:'2 mL/L'},commandId:'fake-treatment',occurredAt:'2026-08-17T10:00:00.000Z'},h.deps),/Treatment canónico/)
 assert.deepEqual(h.events,[])
 assert.equal(h.state.mipeInterventions.length,0)
})
