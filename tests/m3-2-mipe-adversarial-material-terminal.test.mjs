import test from'node:test'
import assert from'node:assert/strict'
import{MIPE_OPERATIONS,executeMipeCommand}from'../src/services/mipeCommand.js'

const materialId='material-plant:GRANDMOTHER:gm-shared:1'
function initialState(){return{
 currentContext:{companyId:'org-a',siteId:'site-a'},companies:[{id:'org-a'},{id:'org-b'}],
 users:[{id:'user-a',name:'Operador A',activeSession:true,active:true,remote:true}],roles:[{id:'site-mipe',permissions:['manage_mipe']}],memberships:[{id:'membership-a',userId:'user-a',companyId:'org-a',roleId:'site-mipe',siteIds:['site-a'],status:'active'}],
 sites:[{id:'site-a',organizationId:'org-a',companyId:'org-a'},{id:'site-b',organizationId:'org-b',companyId:'org-b'}],houses:[],beds:[],plantPositions:[],
 grandmotherPlants:[{id:'gm-shared',organizationId:'org-a',siteId:'site-a',lotCode:'GM-A',quantity:1,geneticId:'gen-a',status:'Activa',createdAt:'2026-08-17T08:00:00.000Z'},{id:'gm-shared',organizationId:'org-b',siteId:'site-b',lotCode:'GM-B',quantity:1,geneticId:'gen-b',status:'Activa',createdAt:'2026-08-17T08:00:00.000Z'}],motherPlants:[],
 materialPlantUnits:[{id:materialId,organizationId:'org-b',plantType:'GRANDMOTHER',unitIndex:0,lotId:'gm-shared',siteId:'site-b',geneticId:'gen-b',code:'GM-B-A001',status:'Activa',healthStatus:'Sana',operationalAvailability:'Disponible para corte',createdAt:'2026-08-17T08:00:00.000Z',updatedAt:'2026-08-17T08:00:00.000Z'}],materialPlantIdentityRegistry:{},
 genetics:[{id:'gen-a',organizationId:'org-a',name:'A'},{id:'gen-b',organizationId:'org-b',name:'B'}],incidents:[{id:'incident-a',organizationId:'org-a',name:'Botritis',active:true}],findings:[],products:[],inventoryLots:[],inventoryMovements:[],costEntries:[],treatments:[],mipeInterventions:[],mipeCommandReceipts:[],plantEvents:[]
}}
function harness(seed=initialState()){let state=structuredClone(seed);const events=[];return{events,get state(){return state},dropReceipts(){state={...state,mipeCommandReceipts:[]}},deps:{publishEvent:async spec=>{events.push(structuredClone(spec));return spec},commit:recipe=>{state=recipe(state)}}}}
const createRequest=(overrides={})=>({operation:MIPE_OPERATIONS.CREATE_MATERIAL_FINDINGS,input:{plantIds:[materialId],incidentId:'incident-a',severity:'Crítica',notes:'Hallazgo material',restrictAvailability:true,...overrides.input},commandId:overrides.commandId||'cmd-material-create',occurredAt:overrides.occurredAt||'2026-08-17T15:00:00.000Z'})

test('F012: CREATE_MATERIAL_FINDINGS nace en workflow Detectado y conserva tenant explícito',async()=>{
 const h=harness()
 await executeMipeCommand(h.state,createRequest(),h.deps)
 const finding=h.state.findings.find(item=>item.organizationId==='org-a'&&item.materialPlantId===materialId)
 assert.ok(finding)
 assert.equal(finding.id,`org-a:cmd-material-create:finding:${materialId}`)
 assert.equal(finding.status,'Detectado')
 assert.equal(finding.targetType,'MATERIAL_PLANT')
 assert.equal(finding.targetId,materialId)
 assert.equal(finding.mipeHistory.length,1)
 assert.equal(finding.mipeHistory[0].to,'Detectado')
 assert.equal(finding.mipeHistory[0].id,`cmd-material-create:material:${materialId}:finding-created`)
 assert.equal(h.state.materialPlantUnits.find(item=>item.organizationId==='org-b'&&item.id===materialId).operationalAvailability,'Disponible para corte')
 assert.equal(h.state.materialPlantUnits.find(item=>item.organizationId==='org-a'&&item.id===materialId).operationalAvailability,'Bloqueada por MIPE')
 assert.ok(h.state.plantEvents.some(item=>item.id===`org-a:cmd-material-create:material-block:${materialId}`))
})

test('F012: batch material permanece efecto-único aunque el receipt local desaparezca',async()=>{
 const h=harness(),request=createRequest()
 await executeMipeCommand(h.state,request,h.deps)
 const findingId=h.state.findings.find(item=>item.organizationId==='org-a'&&item.materialPlantId===materialId).id,updatedAt=h.state.materialPlantUnits.find(item=>item.organizationId==='org-a'&&item.id===materialId).updatedAt
 h.dropReceipts()
 await executeMipeCommand(h.state,request,h.deps)
 assert.equal(h.state.findings.filter(item=>item.organizationId==='org-a'&&item.id===findingId).length,1)
 assert.equal(h.state.plantEvents.filter(item=>item.organizationId==='org-a'&&item.id===`org-a:cmd-material-create:material-block:${materialId}`).length,1)
 assert.equal(h.state.materialPlantUnits.find(item=>item.organizationId==='org-a'&&item.id===materialId).updatedAt,updatedAt)
 assert.equal(h.state.mipeCommandReceipts.filter(item=>item.organizationId==='org-a'&&item.commandId==='cmd-material-create').length,1)
})

test('F012: sin receipt, reutilizar commandId con evidencia distinta falla cerrado en la segunda barrera',async()=>{
 const h=harness(),request=createRequest()
 await executeMipeCommand(h.state,request,h.deps)
 const before=structuredClone(h.state.findings.find(item=>item.organizationId==='org-a'&&item.materialPlantId===materialId))
 h.dropReceipts()
 await assert.rejects(()=>executeMipeCommand(h.state,createRequest({input:{severity:'Alta',notes:'Intento contradictorio'}}),h.deps),/colisiona con evidencia MIPE diferente/i)
 assert.deepEqual(h.state.findings.find(item=>item.organizationId==='org-a'&&item.id===before.id),before)
 assert.equal(h.state.findings.filter(item=>item.organizationId==='org-a'&&item.materialPlantId===materialId).length,1)
 assert.equal(h.state.mipeCommandReceipts.length,0)
})

test('F012: commandId homónimo en otro tenant no impide workflow ni identidad de org-a',async()=>{
 const state=initialState(),foreignId=`org-b:cmd-shared:finding:${materialId}`
 state.findings.push({id:foreignId,organizationId:'org-b',siteId:'site-b',targetType:'MATERIAL_PLANT',targetId:materialId,materialPlantId:materialId,incidentId:'incident-foreign',type:'Foreign',severity:'Media',status:'Detectado',reportedAt:'2026-08-17T14:00:00.000Z',mipeHistory:[{id:'foreign-created',type:'CREATED',from:null,to:'Detectado',occurredAt:'2026-08-17T14:00:00.000Z'}],mipeHistoryVersion:1})
 const h=harness(state)
 await executeMipeCommand(h.state,createRequest({commandId:'cmd-shared'}),h.deps)
 const local=h.state.findings.find(item=>item.organizationId==='org-a'&&item.materialPlantId===materialId),foreign=h.state.findings.find(item=>item.organizationId==='org-b'&&item.id===foreignId)
 assert.equal(local.id,`org-a:cmd-shared:finding:${materialId}`)
 assert.equal(local.mipeHistory.length,1)
 assert.equal(local.mipeHistory[0].id,`cmd-shared:material:${materialId}:finding-created`)
 assert.equal(foreign.type,'Foreign')
 assert.equal(foreign.mipeHistory[0].id,'foreign-created')
})

test('F012: Planta eliminada es terminal para material vegetal, queda Retirada/No disponible y no toca el homónimo extranjero',async()=>{
 const h=harness()
 await executeMipeCommand(h.state,createRequest(),h.deps)
 const finding=h.state.findings.find(item=>item.organizationId==='org-a'&&item.materialPlantId===materialId)
 await executeMipeCommand(h.state,{operation:MIPE_OPERATIONS.RESOLVE_FINDING,entityId:finding.id,input:{status:'Planta eliminada',resolutionNotes:'Retiro sanitario'},commandId:'cmd-material-remove',occurredAt:'2026-08-17T16:00:00.000Z'},h.deps)
 const resolved=h.state.findings.find(item=>item.organizationId==='org-a'&&item.id===finding.id),local=h.state.materialPlantUnits.find(item=>item.organizationId==='org-a'&&item.id===materialId),foreign=h.state.materialPlantUnits.find(item=>item.organizationId==='org-b'&&item.id===materialId)
 assert.equal(resolved.status,'Planta eliminada')
 assert.equal(resolved.mipeHistory.at(-1).to,'Planta eliminada')
 assert.equal(local.status,'Retirada')
 assert.equal(local.operationalAvailability,'No disponible')
 assert.equal(foreign.status,'Activa')
 assert.equal(foreign.operationalAvailability,'Disponible para corte')
 const resolutionEvent=h.state.plantEvents.find(item=>item.organizationId==='org-a'&&item.plantId===materialId&&item.title.includes('planta eliminada'))
 assert.ok(resolutionEvent)
 assert.equal(h.state.plantEvents.some(item=>item.organizationId==='org-b'&&item.title.includes('planta eliminada')),false)
})
