import test from'node:test'
import assert from'node:assert/strict'
import{DomainEvents}from'../src/core/events/eventCatalog.js'
import{IRRIGATION_MIRFE_OPERATIONS,executeIrrigationMirfeCommand}from'../src/services/irrigationMirfeCommand.js'

const EVENT_NAME_PATTERN=/^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*){2,}$/

const fixture=()=>({
 companies:[{id:'org-a'},{id:'org-b'}],currentContext:{companyId:'org-a',siteId:'site-1'},
 sites:[{id:'site-1',organizationId:'org-b',name:'B'},{id:'site-1',organizationId:'org-a',name:'A'}],
 users:[{id:'user-1',name:'Ana',activeSession:true,active:true,remote:true}],
 roles:[{id:'agronomist',permissions:['manage_irrigation','approve_formulas','record_irrigation']}],
 memberships:[{id:'membership-1',userId:'user-1',companyId:'org-a',roleId:'agronomist',siteIds:['site-1'],status:'active'}],
 houses:[{id:'house-1',organizationId:'org-b',siteId:'site-1'},{id:'house-1',organizationId:'org-a',siteId:'site-1'}],
 beds:[{id:'bed-1',organizationId:'org-b',siteId:'site-1',houseId:'house-1',geneticId:'g-1',activePlants:999},{id:'bed-1',organizationId:'org-a',siteId:'site-1',houseId:'house-1',geneticId:'g-1',activePlants:10,drippers:1,flow:2}],
 plantPositions:[],genetics:[{id:'g-1',organizationId:'org-b'},{id:'g-1',organizationId:'org-a'}],
 products:[{id:'inventory-1',organizationId:'org-b',unit:'kg',cost:9000},{id:'inventory-1',organizationId:'org-a',unit:'kg',cost:3000}],
 inventoryLots:[],inventoryMovements:[],waterAnalyses:[],nutrientProducts:[],nutrientObjectives:[],irrigationPlans:[],formulations:[],tankPreparations:[],irrigationApplications:[],workOrders:[],costEntries:[],mirfePrograms:[],mirfeMonitoring:[],mirfeReinforcements:[],irrigationCorrections:[],irrigationHistory:[]
})

async function run(state,command,{publish}={}){
 let current=state;const events=[]
 const result=await executeIrrigationMirfeCommand(current,command,{publishEvent:publish||((event)=>events.push(event)),commit:recipe=>{current=recipe(current)}})
 return{state:current,events,result}
}

test('M31-F003: plan usa datos del tenant y publica intent más evento canónico',async()=>{
 const command={operation:IRRIGATION_MIRFE_OPERATIONS.CREATE_IRRIGATION_PLAN,entityId:'plan-1',commandId:'cmd-plan',occurredAt:'2026-08-16T10:00:00.000Z',input:{siteId:'site-1',houseId:'house-1',geneticId:'g-1',stage:'Vegetativo fuerte',apps:6,minutes:5,tank:1000}}
 const{state,events}=await run(fixture(),command)
 assert.equal(state.irrigationPlans.length,1)
 assert.equal(state.irrigationPlans[0].organizationId,'org-a')
 assert.equal(state.irrigationPlans[0].plants,10)
 assert.equal(state.irrigationPlans[0].calculationMode,'LEGACY_BEDS')
 assert.deepEqual(events.map(event=>event.name),[DomainEvents.CORE_OPERATION_REQUESTED,DomainEvents.MIRFE_IRRIGATION_PLAN_CREATED])
 assert.deepEqual(events.map(event=>event.eventId),['cmd-plan:requested','cmd-plan:completed'])
 assert.equal(events[1].causationId,'cmd-plan:requested')
})

test('M31-F003: el catálogo MIRFE cumple el contrato dominio.entidad.acción real',()=>{
 for(const[name,value]of Object.entries(DomainEvents).filter(([name])=>name.startsWith('MIRFE_')))assert.match(value,EVENT_NAME_PATTERN,name)
})

test('M31-F003/F008: análisis vigente se agrega sin mutar registros de ningún tenant',async()=>{
 const state={...fixture(),waterAnalyses:[
  {id:'old',organizationId:'org-b',siteId:'site-1',status:'Vigente'},
  {id:'old',organizationId:'org-a',siteId:'site-1',status:'Vigente'}
 ]}
 const command={operation:IRRIGATION_MIRFE_OPERATIONS.RECORD_WATER_ANALYSIS,entityId:'water-1',commandId:'cmd-water',occurredAt:'2026-08-16T10:05:00.000Z',input:{siteId:'site-1',date:'2026-08-16',laboratoryId:'lab-a',laboratoryName:'Lab A',sampleId:'sample-1',samplePoint:'well-1',sampledAt:'2026-08-16T08:00:00.000Z',analyticalMethodId:'method-1',expectedAnalytes:['ec','ph'],results:[{analyte:'ec',value:0.4,methodId:'method-1'},{analyte:'ph',value:7,methodId:'method-1'}],status:'Vigente'}}
 const next=(await run(state,command)).state
 assert.equal(next.waterAnalyses.find(item=>item.organizationId==='org-b').status,'Vigente')
 assert.equal(next.waterAnalyses.find(item=>item.id==='old'&&item.organizationId==='org-a').status,'Vigente')
 assert.equal(next.waterAnalyses.find(item=>item.id==='water-1').organizationId,'org-a')
})

test('M31-F003: permisos fallan antes de evento y commit',async()=>{
 const state=fixture();state.roles=[{id:'agronomist',permissions:[]}]
 let publishes=0,commits=0
 await assert.rejects(()=>executeIrrigationMirfeCommand(state,{operation:IRRIGATION_MIRFE_OPERATIONS.CREATE_IRRIGATION_PLAN,entityId:'plan',commandId:'denied',input:{siteId:'site-1',apps:1,minutes:1,tank:1000}},{publishEvent:async()=>{publishes+=1},commit:()=>{commits+=1}}),/permiso/)
 assert.equal(publishes,0);assert.equal(commits,0)
})

test('M31-F003: replay no duplica producto y colisión de commandId falla cerrado',async()=>{
 let state=fixture(),events=[]
 const deps={publishEvent:async event=>events.push(event),commit:recipe=>{state=recipe(state)}}
 const command={operation:IRRIGATION_MIRFE_OPERATIONS.CREATE_NUTRIENT_PRODUCT,entityId:'nutrient-1',commandId:'cmd-product',occurredAt:'2026-08-16T10:10:00.000Z',input:{name:'Nitrato',inventoryProductId:'inventory-1',active:true}}
 await executeIrrigationMirfeCommand(state,command,deps)
 const replay=await executeIrrigationMirfeCommand(state,command,deps)
 assert.equal(replay.replay,true)
 assert.equal(state.nutrientProducts.length,1)
 const before=events.length
 await assert.rejects(()=>executeIrrigationMirfeCommand(state,{...command,input:{...command.input,name:'Otro'}},deps),/contenido diferente/)
 assert.equal(events.length,before)
})

test('M31-F003: aprobación exige capability y emite evento distinto del borrador',async()=>{
 const input={siteId:'site-1',geneticId:'g-1',stage:'Vegetativo',volumeL:1000,items:[{productId:'nutrient-1',grams:100,tank:'A'}],validation:{warnings:[]}}
 let state={...fixture(),nutrientProducts:[{id:'nutrient-1',organizationId:'org-a',inventoryProductId:'inventory-1',nNo3:10,tank:'A'}],nutrientObjectives:[{id:'objective-1',organizationId:'org-a',geneticId:'g-1',stage:'Vegetativo',status:'Aprobada',n:10,p:0,k:0,ca:0,mg:0,s:0}],waterAnalyses:[{id:'water-1',organizationId:'org-a',siteId:'site-1',status:'Vigente',nNo3:0,nNh4:0,p:0,k:0,ca:0,mg:0,s:0}]},events=[]
 const deps={publishEvent:async event=>events.push(event),commit:recipe=>{state=recipe(state)}}
 await executeIrrigationMirfeCommand(state,{operation:IRRIGATION_MIRFE_OPERATIONS.APPROVE_FORMULATION,entityId:'formula-1',commandId:'approve-1',occurredAt:'2026-08-16T10:15:00.000Z',input},deps)
 assert.equal(state.formulations[0].status,'Aprobada')
 assert.equal(events.at(-1).name,DomainEvents.MIRFE_FORMULA_APPROVED)
 const denied=fixture();denied.roles=[{id:'agronomist',permissions:['manage_irrigation']}];denied.nutrientProducts=state.nutrientProducts
 await assert.rejects(()=>run(denied,{operation:IRRIGATION_MIRFE_OPERATIONS.APPROVE_FORMULATION,entityId:'f',commandId:'denied-approval',input}),/aprobar fórmulas/)
})

test('M31-F003: preparación y ejecución son idempotentes y no consumen lote extranjero homónimo',async()=>{
 let state={...fixture(),
  nutrientProducts:[{id:'nutrient-1',organizationId:'org-b',inventoryProductId:'inventory-1'},{id:'nutrient-1',organizationId:'org-a',inventoryProductId:'inventory-1'}],
  formulations:[{id:'formula-1',organizationId:'org-b',siteId:'site-1',status:'Aprobada',volumeL:200,items:[]},{id:'formula-1',organizationId:'org-a',siteId:'site-1',status:'Aprobada',volumeL:1000,stage:'Vegetativo',items:[{productId:'nutrient-1',tank:'A',grams:500}]}],
  inventoryLots:[{id:'lot-1',organizationId:'org-b',productId:'inventory-1',siteId:'site-1',quantity:8},{id:'lot-1',organizationId:'org-a',productId:'inventory-1',siteId:'site-1',quantity:0.8}]
 },events=[]
 const deps={publishEvent:async event=>events.push(event),commit:recipe=>{state=recipe(state)}}
 await executeIrrigationMirfeCommand(state,{operation:IRRIGATION_MIRFE_OPERATIONS.CREATE_PREPARATION,entityId:'prep-1',commandId:'create-prep',occurredAt:'2026-08-16T10:20:00.000Z',input:{formulationId:'formula-1',responsible:'Ana'}},deps)
 const execution={operation:IRRIGATION_MIRFE_OPERATIONS.EXECUTE_PREPARATION,commandId:'execute-prep',occurredAt:'2026-08-16T10:25:00.000Z',input:{preparationId:'prep-1',allocations:{'formula-1-0':'lot-1'},responsible:'Ana'}}
 await executeIrrigationMirfeCommand(state,execution,deps)
 await executeIrrigationMirfeCommand(state,execution,deps)
 assert.equal(state.inventoryLots.find(item=>item.organizationId==='org-b').quantity,8)
 assert.equal(state.inventoryLots.find(item=>item.organizationId==='org-a').quantity,0.30000000000000004)
 assert.equal(state.inventoryMovements.length,1)
 assert.equal(state.costEntries.length,1)
 assert.equal(state.workOrders.length,1)
 assert.equal(state.tankPreparations.find(item=>item.organizationId==='org-a').status,'Preparada')
})

test('M31-F003: aplicación y completion event son replay-safe',async()=>{
 let state={...fixture(),formulations:[{id:'formula-1',organizationId:'org-a',siteId:'site-1',items:[]}],tankPreparations:[{id:'prep-1',organizationId:'org-a',siteId:'site-1',formulationId:'formula-1',volumeL:1000,status:'Preparada'}]},events=[]
 const deps={publishEvent:async event=>events.push(event),commit:recipe=>{state=recipe(state)}}
 const command={operation:IRRIGATION_MIRFE_OPERATIONS.REGISTER_APPLICATION,entityId:'application-1',commandId:'apply-1',occurredAt:'2026-08-16T10:30:00.000Z',input:{preparationId:'prep-1',volumeL:900,ec:2,ph:5.8}}
 await executeIrrigationMirfeCommand(state,command,deps)
 await executeIrrigationMirfeCommand(state,command,deps)
 assert.equal(state.irrigationApplications.length,1)
 assert.equal(state.irrigationApplications[0].organizationId,'org-a')
 assert.equal(events.at(-1).name,DomainEvents.MIRFE_APPLICATION_COMPLETED)
})

test('M31-F003: fallo del evento final conserva recibo y retry completa sin repetir efecto',async()=>{
 let state=fixture(),attempt=0
 const command={operation:IRRIGATION_MIRFE_OPERATIONS.CREATE_NUTRIENT_PRODUCT,entityId:'nutrient-1',commandId:'recover-1',occurredAt:'2026-08-16T10:35:00.000Z',input:{name:'Nitrato',inventoryProductId:'inventory-1'}}
 await assert.rejects(()=>executeIrrigationMirfeCommand(state,command,{publishEvent:async()=>{attempt+=1;if(attempt===2)throw new Error('completion unavailable')},commit:recipe=>{state=recipe(state)}}),/completion unavailable/)
 assert.equal(state.nutrientProducts.length,1)
 const events=[]
 const result=await executeIrrigationMirfeCommand(state,{...command,occurredAt:undefined},{publishEvent:async event=>events.push(event),commit:recipe=>{state=recipe(state)}})
 assert.equal(result.replay,true)
 assert.equal(state.nutrientProducts.length,1)
 assert.equal(events[0].occurredAt,'2026-08-16T10:35:00.000Z')
})

test('M31-F003: operación desconocida y payload cross-tenant fallan antes de publicar',async()=>{
 const state=fixture();let publishes=0
 const deps={publishEvent:async()=>{publishes+=1},commit:()=>{}}
 await assert.rejects(()=>executeIrrigationMirfeCommand(state,{operation:'UNKNOWN',commandId:'x',input:{}},deps),/no soportada/)
 await assert.rejects(()=>executeIrrigationMirfeCommand(state,{operation:IRRIGATION_MIRFE_OPERATIONS.RECORD_WATER_ANALYSIS,entityId:'w',commandId:'foreign',input:{organizationId:'org-b',siteId:'site-1'}},deps),/otra empresa/)
 assert.equal(publishes,0)
})

test('M31-F003: cambio de tenant entre intent y commit falla cerrado',async()=>{
 const state=fixture();let current=state,publishes=0
 await assert.rejects(()=>executeIrrigationMirfeCommand(state,{operation:IRRIGATION_MIRFE_OPERATIONS.CREATE_NUTRIENT_PRODUCT,entityId:'nutrient-1',commandId:'tenant-switch',input:{name:'Nitrato',inventoryProductId:'inventory-1'}},{publishEvent:async()=>{publishes+=1;current={...current,currentContext:{...current.currentContext,companyId:'org-b'}}},commit:recipe=>{current=recipe(current)}}),/empresa activa cambió/)
 assert.equal(publishes,1)
 assert.equal(current.nutrientProducts.length,0)
})
