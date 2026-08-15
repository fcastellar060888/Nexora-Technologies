import test from'node:test'
import assert from'node:assert/strict'
import{readFile}from'node:fs/promises'
import{MATERIAL_PLANT_TYPES}from'../src/domain/materialPlantIdentity.js'
import{PROPAGATION_PURPOSES,propagationSourceUnits}from'../src/domain/propagationPurpose.js'
import{executePropagationBatchCommand,preparePropagationBatch}from'../src/services/propagationBatchCommand.js'

const stateFixture=()=>({
 companies:[{id:'org-a'},{id:'org-b'}],
 sites:[{id:'site-a',companyId:'org-a',name:'Villa A'},{id:'site-b',companyId:'org-b',name:'Villa B'}],
 currentContext:{companyId:'org-a',siteId:'site-a'},
 users:[{id:'u1',activeSession:true,active:true,remote:true}],
 roles:[{id:'agronomist',permissions:['manage_cultivation']}],
 memberships:[{id:'mem-a',userId:'u1',companyId:'org-a',roleId:'agronomist',siteIds:['site-a'],status:'active'}],
 genetics:[{id:'gen-1',organizationId:'org-a',name:'Gen A',active:true},{id:'gen-1',organizationId:'org-b',name:'Gen B',active:true}],
 motherPlants:[
  {id:'lot-a',organizationId:'org-a',siteId:'site-a',geneticId:'gen-1',lotCode:'MA',quantity:1,status:'Activa',healthStatus:'Sana'},
  {id:'lot-b',organizationId:'org-b',siteId:'site-b',geneticId:'gen-1',lotCode:'MB',quantity:1,status:'Activa',healthStatus:'Sana'}
 ],
 grandmotherPlants:[],
 materialPlantUnits:[
  {id:'same-plant',organizationId:'org-a',plantType:MATERIAL_PLANT_TYPES.MOTHER,unitIndex:0,lotId:'lot-a',siteId:'site-a',geneticId:'gen-1',code:'MA-M001',status:'Activa',healthStatus:'Sana',operationalAvailability:'Disponible para corte'},
  {id:'same-plant',organizationId:'org-b',plantType:MATERIAL_PLANT_TYPES.MOTHER,unitIndex:0,lotId:'lot-b',siteId:'site-b',geneticId:'gen-1',code:'MB-M001',status:'Activa',healthStatus:'Sana',operationalAvailability:'Disponible para corte'}
 ],
 propagationBanks:[
  {id:'bank-a',organizationId:'org-a',siteId:'site-a',name:'Banco A',active:true,trays:[{id:'tray-a',quantity:1,cellsPerTray:2}]},
  {id:'bank-b',organizationId:'org-b',siteId:'site-b',name:'Banco B',active:true,trays:[{id:'tray-b',quantity:1,cellsPerTray:2}]}
 ],
 propagationBatches:[],propagationUnits:[],lotEvents:[]
})

const commandInput=(overrides={})=>({commandId:'cut-cmd-1',occurredAt:'2026-08-15T03:00:00.000Z',siteId:'site-a',bankId:'bank-a',sourcePlantId:'same-plant',geneticId:'gen-1',purpose:PROPAGATION_PURPOSES.PRODUCTION,cutDate:'2026-08-15',sequence:1,quantity:2,operator:'Ana',...overrides})

test('M21-F006: source resolution uses organization plus plant identity',()=>{
 const state=stateFixture()
 const sources=propagationSourceUnits(state,{organizationId:'org-a',siteId:'site-a'})
 assert.equal(sources.length,1)
 assert.equal(sources[0].id,'same-plant')
 assert.equal(sources[0].organizationId,'org-a')
 assert.equal(sources[0].lotId,'lot-a')
})

test('M21-F004/F005: command creates tenant-owned batch and individual clones after durable intent',async()=>{
 let state=stateFixture(),events=[]
 const commit=recipe=>{state=recipe(state)}
 const result=await executePropagationBatchCommand(state,commandInput(),{commit,publishEvent:async event=>events.push(event)})
 assert.equal(result.batch.organizationId,'org-a')
 assert.equal(result.batch.sourcePlantId,'same-plant')
 assert.equal(state.propagationBatches.length,1)
 assert.equal(state.propagationUnits.length,2)
 assert.deepEqual(state.propagationUnits.map(unit=>unit.id),['cut-cmd-1:clone:1','cut-cmd-1:clone:2'])
 assert.ok(state.propagationUnits.every(unit=>unit.organizationId==='org-a'&&unit.siteId==='site-a'&&unit.directParentPlantId==='same-plant'))
 assert.deepEqual(events.map(event=>event.name),['core.operation.requested','propagation.batch.created'])
 assert.deepEqual(events.map(event=>event.eventId),['cut-cmd-1:requested','cut-cmd-1:completed'])
})

test('M21-F004: retry with the same command is state-idempotent',async()=>{
 let state=stateFixture(),events=[]
 const commit=recipe=>{state=recipe(state)}
 await executePropagationBatchCommand(state,commandInput(),{commit,publishEvent:async event=>events.push(event)})
 const before=structuredClone(state)
 const retry=await executePropagationBatchCommand(state,commandInput(),{commit,publishEvent:async event=>events.push(event)})
 assert.equal(retry.retry,true)
 assert.deepEqual(state,before)
 assert.equal(events.length,2)
 assert.equal(state.propagationBatches.length,1)
 assert.equal(state.propagationUnits.length,2)
})

test('M21-F005/F006: foreign bank and source context fail closed before mutation',()=>{
 const state=stateFixture()
 assert.throws(()=>preparePropagationBatch(state,commandInput({bankId:'bank-b'}),{commandId:'foreign-bank'}),/banco no pertenece/)
 assert.throws(()=>preparePropagationBatch(state,commandInput({siteId:'site-b',bankId:'bank-b'}),{commandId:'foreign-source'}),/sede no pertenece|origen no es elegible/)
})

test('M21-F004/F005: capacity and permission are enforced before commit',async()=>{
 const state=stateFixture()
 assert.throws(()=>preparePropagationBatch(state,commandInput({quantity:3}),{commandId:'over-capacity'}),/solo tiene 2 posiciones libres/)
 const denied=stateFixture();denied.roles=[{id:'viewer',permissions:[]}];let commits=0
 await assert.rejects(()=>executePropagationBatchCommand(denied,commandInput(),{commit:()=>{commits++},publishEvent:async()=>{}}),/permiso/)
 assert.equal(commits,0)
})

test('M21-F004/F005: malformed intent, genetic mismatch, inactive genetic and code collisions fail closed',()=>{
 const state=stateFixture()
 assert.throws(()=>preparePropagationBatch(state,commandInput({siteId:''}),{commandId:'missing-site'}),/Sede, banco y planta/)
 assert.throws(()=>preparePropagationBatch(state,commandInput({quantity:0}),{commandId:'zero'}),/cantidad debe ser mayor/)
 assert.throws(()=>preparePropagationBatch(state,commandInput({cutDate:'15-08-2026'}),{commandId:'bad-date'}),/fecha de corte/)
 assert.throws(()=>preparePropagationBatch(state,commandInput({geneticId:'other'}),{commandId:'bad-genetic'}),/no coincide/)
 const inactive=stateFixture();inactive.genetics=inactive.genetics.map(item=>item.organizationId==='org-a'?{...item,active:false}:item)
 assert.throws(()=>preparePropagationBatch(inactive,commandInput(),{commandId:'inactive'}),/no está activa/)
 const duplicate=stateFixture();duplicate.propagationBatches=[{id:'other',organizationId:'org-a',code:'LP-VIL-GEN-A-20260815-001'}]
 const generated=preparePropagationBatch(state,commandInput(),{commandId:'reference'})
 duplicate.propagationBatches[0].code=generated.batch.code
 assert.throws(()=>preparePropagationBatch(duplicate,commandInput({commandId:'another'}),{commandId:'another'}),/código de lote ya existe/)
})

test('M21-F004: direct grandmother production requires explicit traceable authorization',()=>{
 const state=stateFixture()
 state.grandmotherPlants=[{id:'grand-lot',organizationId:'org-a',siteId:'site-a',geneticId:'gen-1',lotCode:'GA',quantity:1,status:'Activa',healthStatus:'Sana'}]
 state.materialPlantUnits.push({id:'grand-plant',organizationId:'org-a',plantType:MATERIAL_PLANT_TYPES.GRANDMOTHER,unitIndex:0,lotId:'grand-lot',siteId:'site-a',geneticId:'gen-1',code:'GA-A001',status:'Activa',healthStatus:'Sana',operationalAvailability:'Disponible para corte'})
 assert.throws(()=>preparePropagationBatch(state,commandInput({sourcePlantId:'grand-plant'}),{commandId:'grand-no-auth'}),/autorización explícita/)
 const prepared=preparePropagationBatch(state,commandInput({sourcePlantId:'grand-plant',authorizedGrandmotherProduction:true,quantity:1}),{commandId:'grand-auth'})
 assert.equal(prepared.batch.authorizedGrandmotherProduction,true)
 assert.equal(prepared.batch.sourcePlantType,MATERIAL_PLANT_TYPES.GRANDMOTHER)
})

test('M21-F004: batch identity collisions are tenant-aware and command-aware',()=>{
 const foreign=stateFixture();foreign.propagationBatches=[{id:'cut-cmd-1',organizationId:'org-b',commandId:'other',code:'foreign'}]
 assert.throws(()=>preparePropagationBatch(foreign,commandInput(),{commandId:'cut-cmd-1'}),/otra organización/)
 const local=stateFixture();local.propagationBatches=[{id:'cut-cmd-1',organizationId:'org-a',commandId:'other',code:'local'}]
 assert.throws(()=>preparePropagationBatch(local,commandInput(),{commandId:'cut-cmd-1'}),/otra operación/)
})

test('M21-F004: concurrent batch or clone collision aborts the commit after durable intent',async()=>{
 const base=stateFixture()
 let events=[]
 await assert.rejects(()=>executePropagationBatchCommand(base,commandInput({quantity:1}),{
  publishEvent:async event=>events.push(event),
  commit:recipe=>recipe({...base,propagationBatches:[{id:'cut-cmd-1',organizationId:'org-a',commandId:'racing-command'}]})
 }),/Colisión de batch durante el commit/)
 assert.equal(events[0].name,'core.operation.requested')
 events=[]
 await assert.rejects(()=>executePropagationBatchCommand(base,commandInput({quantity:1}),{
  publishEvent:async event=>events.push(event),
  commit:recipe=>recipe({...base,propagationUnits:[{id:'cut-cmd-1:clone:1',organizationId:'org-a',batchId:'other'}]})
 }),/Colisión de identidad de esqueje/)
 assert.equal(events[0].name,'core.operation.requested')
})

test('M21-F004: missing commit is rejected before state mutation',async()=>{
 await assert.rejects(()=>executePropagationBatchCommand(stateFixture(),commandInput(),{publishEvent:async()=>{}}),/commit es obligatorio/)
})

test('M21-F004 re-audit: propagation form delegates creation and cannot mutate Store directly',async()=>{
 const source=await readFile(new URL('../src/components/PurposeAwarePropagationForm.jsx',import.meta.url),'utf8')
 assert.match(source,/executePropagationBatchCommand/)
 assert.doesNotMatch(source,/\bupdate\s*\(/)
 assert.doesNotMatch(source,/crypto\.randomUUID\(\).*propagationBatches/s)
 assert.doesNotMatch(source,/propagationUnits:\s*\[/)
})
