import test from'node:test'
import assert from'node:assert/strict'
import{MIPE_OPERATIONS,executeMipeCommand}from'../src/services/mipeCommand.js'
import{mipeRecordOrganizationId,scopeMipeState}from'../src/domain/mipeTenancy.js'
import{applyRemoteRecords}from'../src/services/syncEngine.js'

function spoofedState(){return{
 currentContext:{companyId:'org-a',siteId:'site-a'},companies:[{id:'org-a'}],
 users:[{id:'user-a',name:'Operador A',activeSession:true,active:true,remote:true}],
 roles:[{id:'site-mipe',permissions:['manage_mipe']}],memberships:[{id:'membership-a',userId:'user-a',companyId:'org-a',roleId:'site-mipe',siteIds:['site-a'],status:'active'}],
 sites:[{id:'site-a',organizationId:'org-a',companyId:'org-a',name:'A'},{id:'site-b',organizationId:'org-a',companyId:'org-a',name:'B'}],
 houses:[{id:'house-b',organizationId:'org-a',siteId:'site-b',name:'Nave B'}],
 beds:[{id:'bed-b',organizationId:'org-a',siteId:'site-b',houseId:'house-b',name:'Cama B'}],
 plantPositions:[{id:'plant-b',organizationId:'org-a',siteId:'site-a',bedId:'bed-b',active:true}],
 grandmotherPlants:[],motherPlants:[],materialPlantUnits:[],genetics:[],products:[],inventoryLots:[],inventoryMovements:[],costEntries:[],treatments:[],mipeInterventions:[],mipeCommandReceipts:[],
 incidents:[{id:'incident-a',organizationId:'org-a',name:'Botritis',active:true}],findings:[]
}}

function causalState(){return{
 currentContext:{companyId:'org-a',siteId:'site-a'},companies:[{id:'org-a'},{id:'org-b'}],
 sites:[{id:'site-a',organizationId:'org-a',companyId:'org-a'},{id:'site-b',organizationId:'org-a',companyId:'org-a'},{id:'site-x',organizationId:'org-b',companyId:'org-b'}],
 houses:[{id:'house-b',organizationId:'org-a',siteId:'site-b'}],beds:[{id:'bed-b',organizationId:'org-a',siteId:'site-b',houseId:'house-b'}],plantPositions:[{id:'plant-b',organizationId:'org-a',siteId:'site-b',bedId:'bed-b'}],
 grandmotherPlants:[],motherPlants:[],genetics:[],inventoryMovements:[],costEntries:[],
 incidents:[{id:'incident-a',organizationId:'org-a',name:'Botritis A'},{id:'incident-x',organizationId:'org-b',name:'Foreign'}],
 findings:[{id:'finding-b',organizationId:'org-a',siteId:'site-b',targetType:'POSITION',targetId:'plant-b',plantPositionId:'plant-b',incidentId:'incident-a',status:'Seguimiento'}],
 products:[{id:'product-b',organizationId:'org-a',siteId:'site-b',unit:'mL'}],inventoryLots:[{id:'lot-b',organizationId:'org-a',siteId:'site-b',productId:'product-b',quantity:10}],
 treatments:[{id:'treatment-b',organizationId:'org-a',siteId:'site-b',findingId:'finding-b',productId:'product-b',lotId:'lot-b',status:'Ejecutado'}],mipeInterventions:[]
}}

test('F012: Position no puede declarar Sede A si su Bed→House pertenece a Sede B',()=>{
 const state=spoofedState()
 assert.equal(mipeRecordOrganizationId(state,'plantPositions',state.plantPositions[0]),'')
})

test('F012: site spoofing de Position falla antes de requested y no evade membresía limitada a otra sede',async()=>{
 let state=spoofedState();const events=[]
 const deps={publishEvent:async spec=>{events.push(spec);return spec},commit:recipe=>{state=recipe(state)}}
 await assert.rejects(()=>executeMipeCommand(state,{operation:MIPE_OPERATIONS.CREATE_FINDING,input:{plantPositionId:'plant-b',incidentId:'incident-a',severity:3},commandId:'cmd-site-spoof',occurredAt:'2026-08-17T14:00:00.000Z'},deps),/ownership inequívoco|otra empresa|planta\/Position/i)
 assert.deepEqual(events,[])
 assert.deepEqual(state.findings,[])
 assert.deepEqual(state.mipeCommandReceipts,[])
})

test('F012: Finding remoto same-tenant no puede declarar una sede distinta a su Position causal',()=>{
 const state=causalState(),record={id:'finding-spoof',organizationId:'org-a',siteId:'site-a',targetType:'POSITION',targetId:'plant-b',plantPositionId:'plant-b',incidentId:'incident-a'}
 assert.equal(mipeRecordOrganizationId(state,'findings',record),'')
})

test('F012: Finding explícito no puede apuntar a Incident de otro tenant',()=>{
 const state=causalState(),record={id:'finding-foreign-incident',organizationId:'org-a',siteId:'site-b',targetType:'POSITION',targetId:'plant-b',plantPositionId:'plant-b',incidentId:'incident-x'}
 assert.equal(mipeRecordOrganizationId(state,'findings',record),'')
})

test('F012: Treatment e Intervention same-tenant deben conservar la misma sede de su cadena causal',()=>{
 const state=causalState()
 const treatment={id:'treatment-spoof',organizationId:'org-a',siteId:'site-a',findingId:'finding-b',productId:'product-b',lotId:'lot-b',status:'Ejecutado'}
 assert.equal(mipeRecordOrganizationId(state,'treatments',treatment),'')
 const intervention={id:'intervention-spoof',organizationId:'org-a',siteId:'site-a',findingId:'finding-b',treatmentId:'treatment-b',type:'Seguimiento'}
 assert.equal(mipeRecordOrganizationId(state,'mipeInterventions',intervention),'')
})

test('F012: Treatment explícito sin Finding causal queda en cuarentena aunque Product y sede sean válidos',()=>{
 const state=causalState(),record={id:'treatment-orphan',organizationId:'org-a',siteId:'site-b',findingId:'finding-missing',productId:'product-b',lotId:'lot-b',status:'Ejecutado'}
 assert.equal(mipeRecordOrganizationId(state,'treatments',record),'')
})

test('F012: Intervention explícita requiere Finding y Treatment cuando su tipo es Tratamiento',()=>{
 const state=causalState()
 assert.equal(mipeRecordOrganizationId(state,'mipeInterventions',{id:'intervention-orphan',organizationId:'org-a',siteId:'site-b',findingId:'finding-missing',type:'Seguimiento'}),'')
 assert.equal(mipeRecordOrganizationId(state,'mipeInterventions',{id:'intervention-treatment-orphan',organizationId:'org-a',siteId:'site-b',findingId:'finding-b',type:'Tratamiento'}),'')
})

test('F012: applyRemoteRecords puede conservar evidencia hostil raw, pero scope MIPE nunca la expone',()=>{
 const state=causalState(),payload={id:'finding-remote-spoof',organizationId:'org-a',siteId:'site-a',targetType:'POSITION',targetId:'plant-b',plantPositionId:'plant-b',incidentId:'incident-a',status:'Detectado'}
 const hydrated=applyRemoteRecords(state,[{companyId:'org-a',collection:'findings',recordId:payload.id,payload,version:1,updatedAt:'2026-08-17T14:30:00.000Z'}],{companyId:'org-a'})
 assert.ok(hydrated.findings.some(item=>item.id===payload.id),'La capa sync conserva el payload para diagnóstico/reconciliación')
 const scoped=scopeMipeState(hydrated,'org-a')
 assert.equal(scoped.findings.some(item=>item.id===payload.id),false)
 assert.equal(mipeRecordOrganizationId(hydrated,'findings',hydrated.findings.find(item=>item.id===payload.id)),'')
})
