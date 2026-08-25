import test from'node:test'
import assert from'node:assert/strict'
import{MIPE_OPERATIONS,executeMipeCommand}from'../src/services/mipeCommand.js'
import{mipeRecordOrganizationId,scopeMipeState}from'../src/domain/mipeTenancy.js'
import{interventionsForFinding,openBlockingMipeFindings,resolveMaterialPlantFinding}from'../src/domain/materialPlantMipe.js'
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

function materialHomonymState(){
 const materialId='material-plant:GRANDMOTHER:gm-shared:1'
 return{materialId,state:{
  currentContext:{companyId:'org-a',siteId:'site-a'},companies:[{id:'org-a'},{id:'org-b'}],
  users:[{id:'user-a',name:'Operador A',activeSession:true,active:true,remote:true}],roles:[{id:'site-mipe',permissions:['manage_mipe']}],memberships:[{id:'membership-a',userId:'user-a',companyId:'org-a',roleId:'site-mipe',siteIds:['site-a'],status:'active'}],
  sites:[{id:'site-a',organizationId:'org-a',companyId:'org-a'},{id:'site-a2',organizationId:'org-a',companyId:'org-a'},{id:'site-b',organizationId:'org-b',companyId:'org-b'}],houses:[],beds:[],plantPositions:[],
  grandmotherPlants:[{id:'gm-shared',organizationId:'org-a',siteId:'site-a',lotCode:'GM-A',quantity:1,geneticId:'gen-a',status:'Activa',createdAt:'2026-08-17T08:00:00.000Z'},{id:'gm-shared',organizationId:'org-b',siteId:'site-b',lotCode:'GM-B',quantity:1,geneticId:'gen-b',status:'Activa',createdAt:'2026-08-17T08:00:00.000Z'}],motherPlants:[],
  materialPlantUnits:[{id:materialId,organizationId:'org-b',plantType:'GRANDMOTHER',unitIndex:0,lotId:'gm-shared',siteId:'site-b',geneticId:'gen-b',code:'GM-B-A001',status:'Activa',healthStatus:'Sana',operationalAvailability:'Disponible para corte',createdAt:'2026-08-17T08:00:00.000Z',updatedAt:'2026-08-17T08:00:00.000Z'}],materialPlantIdentityRegistry:{},
  genetics:[{id:'gen-a',organizationId:'org-a',name:'A'},{id:'gen-b',organizationId:'org-b',name:'B'}],incidents:[{id:'incident-a',organizationId:'org-a',name:'Botritis',active:true}],findings:[],products:[],inventoryLots:[],inventoryMovements:[],costEntries:[],treatments:[],mipeInterventions:[],mipeCommandReceipts:[],plantEvents:[]
 }}
}

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

test('F012: materialPlantId se resuelve contra la planta individual y no permite spoofing de sede same-tenant',()=>{
 const{state,materialId}=materialHomonymState(),record={id:'finding-material-spoof',organizationId:'org-a',siteId:'site-a2',targetType:'MATERIAL_PLANT',targetId:materialId,materialPlantId:materialId,incidentId:'incident-a'}
 assert.equal(mipeRecordOrganizationId(state,'findings',record),'')
})

test('F012: CREATE_MATERIAL_FINDINGS no puede parchear la planta homónima de otro tenant',async()=>{
 const fixture=materialHomonymState();let state=fixture.state;const events=[]
 const deps={publishEvent:async spec=>{events.push(spec);return spec},commit:recipe=>{state=recipe(state)}}
 await executeMipeCommand(state,{operation:MIPE_OPERATIONS.CREATE_MATERIAL_FINDINGS,input:{plantIds:[fixture.materialId],incidentId:'incident-a',severity:'Crítica',notes:'Bloqueo tenant-aware',restrictAvailability:true},commandId:'cmd-material-homonym',occurredAt:'2026-08-17T15:00:00.000Z'},deps)
 const foreign=state.materialPlantUnits.find(item=>item.organizationId==='org-b'&&item.id===fixture.materialId),local=state.materialPlantUnits.find(item=>item.organizationId==='org-a'&&item.id===fixture.materialId)
 assert.equal(foreign.operationalAvailability,'Disponible para corte')
 assert.ok(local,'Debe materializarse la identidad de org-a sin reutilizar la de org-b')
 assert.equal(local.operationalAvailability,'Bloqueada por MIPE')
 assert.equal(state.findings.filter(item=>item.organizationId==='org-a'&&item.materialPlantId===fixture.materialId).length,1)
})

test('F012: helpers exportados de material vegetal fallan ante homónimos si no se especifica tenant',()=>{
 const plantId='material-shared',findingId='finding-shared',state={
  findings:[
   {id:findingId,organizationId:'org-a',materialPlantId:plantId,restrictsPropagation:true,status:'Detectado'},
   {id:findingId,organizationId:'org-b',materialPlantId:plantId,restrictsPropagation:true,status:'Detectado'}
  ],
  mipeInterventions:[
   {id:'intervention-a',organizationId:'org-a',findingId,performedAt:'2026-08-17T12:00:00.000Z'},
   {id:'intervention-b',organizationId:'org-b',findingId,performedAt:'2026-08-17T13:00:00.000Z'}
  ]
 }
 assert.throws(()=>openBlockingMipeFindings(state,plantId),/ambiguo entre organizaciones/i)
 assert.throws(()=>interventionsForFinding(state,findingId),/ambiguo entre organizaciones/i)
 assert.deepEqual(openBlockingMipeFindings(state,plantId,{organizationId:'org-a'}).map(item=>item.organizationId),['org-a'])
 assert.deepEqual(interventionsForFinding(state,findingId,{organizationId:'org-b'}).map(item=>item.organizationId),['org-b'])
})

test('F012: resolución material directa exige tenant ante Finding homónimo y no reescribe el extranjero',()=>{
 const plantId='material-shared',findingId='finding-shared',baseFinding={id:findingId,materialPlantId:plantId,incidentId:'incident',type:'Botritis',severity:'Alta',status:'Detectado',reportedAt:'2026-08-17T10:00:00.000Z',siteId:'site',lotId:'lot',plantType:'GRANDMOTHER',unitIndex:0,plantCode:'P-1',restrictsPropagation:false},state={
  findings:[{...baseFinding,organizationId:'org-a'},{...baseFinding,organizationId:'org-b',notes:'foreign'}],
  mipeInterventions:[],materialPlantUnits:[
   {id:plantId,organizationId:'org-a',lotId:'lot',plantType:'GRANDMOTHER',unitIndex:0,siteId:'site',status:'Activa',operationalAvailability:'Disponible para corte'},
   {id:plantId,organizationId:'org-b',lotId:'lot',plantType:'GRANDMOTHER',unitIndex:0,siteId:'site',status:'Activa',operationalAvailability:'Disponible para corte'}
  ],plantEvents:[]
 }
 assert.throws(()=>resolveMaterialPlantFinding(state,{findingId,status:'Falso positivo',resolutionNotes:'Prueba'}),/identidad duplicada|ambigua entre organizaciones/i)
 const outcome=resolveMaterialPlantFinding(state,{findingId,organizationId:'org-a',status:'Falso positivo',resolutionNotes:'Descartado',resolvedAt:'2026-08-17T14:00:00.000Z'})
 assert.equal(outcome.state.findings.find(item=>item.organizationId==='org-a').status,'Falso positivo')
 assert.equal(outcome.state.findings.find(item=>item.organizationId==='org-b').status,'Detectado')
 assert.equal(outcome.state.findings.find(item=>item.organizationId==='org-b').notes,'foreign')
})
