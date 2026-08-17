import test from'node:test'
import assert from'node:assert/strict'
import{readFile}from'node:fs/promises'
import{DomainEvents}from'../src/core/events/eventCatalog.js'
import{currentWaterAnalysisForSite,WATER_ANALYTE_KEYS,WATER_ANALYSIS_STATUSES}from'../src/domain/waterAnalysis.js'
import{executeIrrigationMirfeCommand,IRRIGATION_MIRFE_OPERATIONS}from'../src/services/irrigationMirfeCommand.js'
import{applyRemoteRecords,collectionChanges,enqueueChanges,SYNCABLE_COLLECTIONS}from'../src/services/syncEngine.js'

const fixture=()=>({
 companies:[{id:'org-a'},{id:'org-b'}],currentContext:{companyId:'org-a',siteId:'site-1'},
 users:[{id:'user-1',name:'Ana',activeSession:true,active:true,remote:true}],roles:[{id:'agronomist',permissions:['manage_irrigation','approve_formulas']}],memberships:[{id:'membership-1',userId:'user-1',companyId:'org-a',roleId:'agronomist',siteIds:['site-1'],status:'active'}],
 sites:[{id:'site-1',organizationId:'org-b',name:'B'},{id:'site-1',organizationId:'org-a',name:'A'}],houses:[],beds:[],plantPositions:[],propagationBanks:[],propagationUnits:[],genetics:[{id:'g-1',organizationId:'org-b'},{id:'g-1',organizationId:'org-a'}],
 products:[{id:'inventory-1',organizationId:'org-b',unit:'kg'},{id:'inventory-1',organizationId:'org-a',unit:'kg'}],inventoryLots:[],inventoryMovements:[],
 irrigationEmitters:[],irrigationSectors:[],irrigationAssignments:[],irrigationPulses:[],irrigationMeasurements:[],drainageMeasurements:[],
 waterAnalyses:[],nutrientProducts:[],nutrientObjectives:[],irrigationPlans:[],formulations:[],tankPreparations:[],irrigationApplications:[],workOrders:[],costEntries:[],mirfePrograms:[],mirfeMonitoring:[],mirfeReinforcements:[],irrigationCorrections:[],irrigationHistory:[]
})

const panelResults=(keys=WATER_ANALYTE_KEYS,value=0)=>keys.map(analyte=>({analyte,value:analyte==='ph'?7:value,methodId:'method-1'}))
const waterInput=(overrides={})=>({siteId:'site-1',laboratoryId:'lab-1',laboratoryName:'Lab Uno',sampleId:'sample-1',samplePoint:'well-1',sampleType:'SOURCE_WATER',sampledAt:'2026-08-16T08:00:00.000Z',analyticalMethodId:'method-1',expectedAnalytes:WATER_ANALYTE_KEYS,results:panelResults(),status:WATER_ANALYSIS_STATUSES.CURRENT,...overrides})

async function run(initial,command){
 let state=initial;const events=[]
 const result=await executeIrrigationMirfeCommand(state,command,{publishEvent:async event=>events.push(event),commit:recipe=>{state=recipe(state)}})
 return{state,events,result}
}

test('M31-F008: command agrega versión tenant-aware sin reescribir la vigente anterior',async()=>{
 const activeOld={id:'water-old',organizationId:'org-a',siteId:'site-1',status:'Vigente',date:'2026-08-15',laboratory:'Legacy',ec:1,ph:7,alkalinity:0,hco3:0,na:0,cl:0,nNo3:0,nNh4:0,p:0,k:0,ca:0,mg:0,s:0,fe:0,mn:0,zn:0,b:0,cu:0,mo:0,si:0}
 const foreignOld={...activeOld,organizationId:'org-b',ec:999}
 const state={...fixture(),waterAnalyses:[foreignOld,activeOld]}
 const command={operation:IRRIGATION_MIRFE_OPERATIONS.RECORD_WATER_ANALYSIS,entityId:'water-new',commandId:'water-version-command',occurredAt:'2026-08-16T10:00:00.000Z',input:waterInput({analysisKey:'water-old',supersedesWaterAnalysisId:'water-old'})}
 const output=await run(state,command),created=output.state.waterAnalyses.find(item=>item.id==='water-new')
 assert.equal(output.state.waterAnalyses.find(item=>item.id==='water-old'&&item.organizationId==='org-a').status,'Vigente')
 assert.equal(output.state.waterAnalyses.find(item=>item.organizationId==='org-b').ec,999)
 assert.equal(created.organizationId,'org-a')
 assert.equal(created.analysisKey,'water-old')
 assert.equal(created.version,2)
 assert.equal(created.supersedesWaterAnalysisId,'water-old')
 assert.equal(created.commandReceipts[0].commandId,'water-version-command')
 assert.equal(output.events.at(-1).name,DomainEvents.MIRFE_WATER_ANALYSIS_RECORDED)
 assert.equal(output.events.at(-1).payload.laboratoryId,'lab-1')
 assert.equal(output.events.at(-1).payload.sampleId,'sample-1')
 assert.equal(output.events.at(-1).payload.complete,true)
})

test('M31-F008: un parcial se completa por una nueva versión y solo entonces queda vigente',async()=>{
 let output=await run(fixture(),{operation:IRRIGATION_MIRFE_OPERATIONS.RECORD_WATER_ANALYSIS,entityId:'water-1',commandId:'partial-command',occurredAt:'2026-08-16T10:00:00.000Z',input:waterInput({expectedAnalytes:['ec','ph','ca'],results:panelResults(['ec']),status:WATER_ANALYSIS_STATUSES.PARTIAL})})
 const first=output.state.waterAnalyses[0]
 assert.deepEqual(first.completeness.missingAnalytes,['ph','ca'])
 assert.equal(output.events.at(-1).payload.partial,true)
 assert.equal(currentWaterAnalysisForSite(output.state.waterAnalyses,{organizationId:'org-a',siteId:'site-1'}),null)
 output=await run(output.state,{operation:IRRIGATION_MIRFE_OPERATIONS.RECORD_WATER_ANALYSIS,entityId:'water-2',commandId:'complete-command',occurredAt:'2026-08-17T10:00:00.000Z',input:waterInput({analysisKey:'water-1',supersedesWaterAnalysisId:'water-1',expectedAnalytes:['ec','ph','ca'],results:panelResults(['ph','ca']),status:WATER_ANALYSIS_STATUSES.CURRENT})})
 const second=output.state.waterAnalyses.find(item=>item.id==='water-2')
 assert.equal(second.version,2)
 assert.equal(second.completeness.complete,true)
 assert.equal(output.state.waterAnalyses.find(item=>item.id==='water-1').status,WATER_ANALYSIS_STATUSES.PARTIAL)
 assert.equal(currentWaterAnalysisForSite(output.state.waterAnalyses,{organizationId:'org-a',siteId:'site-1'}).id,'water-2')
})

test('M31-F008: referencia extranjera o identidad incompleta fallan antes de eventos y commits',async()=>{
 const foreign={id:'foreign-water',organizationId:'org-b',siteId:'site-1',status:'Parcial'}
 for(const input of[
  waterInput({analysisKey:'foreign-water',supersedesWaterAnalysisId:'foreign-water'}),
  waterInput({laboratoryId:''}),
  waterInput({sampleId:''}),
  waterInput({expectedAnalytes:['ec','ph'],results:panelResults(['ec']),status:WATER_ANALYSIS_STATUSES.CURRENT})
 ]){
  let publishes=0,commits=0
  await assert.rejects(()=>executeIrrigationMirfeCommand({...fixture(),waterAnalyses:[foreign]},{operation:IRRIGATION_MIRFE_OPERATIONS.RECORD_WATER_ANALYSIS,entityId:crypto.randomUUID(),commandId:crypto.randomUUID(),input},{publishEvent:async()=>{publishes+=1},commit:()=>{commits+=1}}))
  assert.equal(publishes,0);assert.equal(commits,0)
 }
 const active={id:'duplicate-id',organizationId:'org-a',siteId:'site-1',status:'Pendiente'},sample={id:'sample-owner',organizationId:'org-a',siteId:'site-1',sampleId:'sample-1',samplePoint:'well-1',sampleType:'SOURCE_WATER',sampledAt:'2026-08-16T08:00:00.000Z',status:'Parcial'}
 for(const candidate of[
  {state:{...fixture(),waterAnalyses:[active]},entityId:'duplicate-id',input:waterInput()},
  {state:{...fixture(),waterAnalyses:[sample]},entityId:'contradictory-sample',input:waterInput({samplePoint:'reservoir-2'})},
  {state:{...fixture(),sites:[{id:'site-1',organizationId:'org-b',name:'B'}]},entityId:'foreign-site',input:waterInput()}
 ]){
  let publishes=0,commits=0
  await assert.rejects(()=>executeIrrigationMirfeCommand(candidate.state,{operation:IRRIGATION_MIRFE_OPERATIONS.RECORD_WATER_ANALYSIS,entityId:candidate.entityId,commandId:crypto.randomUUID(),input:candidate.input},{publishEvent:async()=>{publishes+=1},commit:()=>{commits+=1}}))
  assert.equal(publishes,0);assert.equal(commits,0)
 }
})

test('M31-F008: formulación usa la última versión vigente compatible del tenant activo',async()=>{
 const state=fixture()
 const foreignWater={id:'water-shared',organizationId:'org-b',siteId:'site-1',status:'Vigente',nNo3:999,nNh4:0,p:0,k:0,ca:0,mg:0,s:0}
 let output=await run({...state,waterAnalyses:[foreignWater]},{operation:IRRIGATION_MIRFE_OPERATIONS.RECORD_WATER_ANALYSIS,entityId:'water-shared',commandId:'water-active',occurredAt:'2026-08-16T10:00:00.000Z',input:waterInput()})
 const current=output.state.waterAnalyses.find(item=>item.organizationId==='org-a')
 output.state={...output.state,nutrientProducts:[{id:'nutrient-1',organizationId:'org-a',name:'N activo',inventoryProductId:'inventory-1',tank:'A',nNo3:10,active:true}],nutrientObjectives:[{id:'objective-1',organizationId:'org-a',geneticId:'g-1',stage:'Vegetativo',status:'Aprobada',n:10,p:0,k:0,ca:0,mg:0,s:0}]}
 output=await run(output.state,{operation:IRRIGATION_MIRFE_OPERATIONS.APPROVE_FORMULATION,entityId:'formula-1',commandId:'formula-command',occurredAt:'2026-08-16T11:00:00.000Z',input:{siteId:'site-1',geneticId:'g-1',stage:'Vegetativo',volumeL:1000,items:[{productId:'nutrient-1',tank:'A',grams:100}]}})
 const formula=output.state.formulations[0]
 assert.equal(formula.waterAnalysisId,current.id)
 assert.equal(formula.validation.waterSnapshot.n,0)
 assert.equal(formula.status,'Aprobada')
})

test('M31-F008: UI exige identidades y expone parcial, versiones y comparación',async()=>{
 const source=await readFile(new URL('../src/pages/WaterAnalysisPage.jsx',import.meta.url),'utf8')
 assert.match(source,/laboratoryId/)
 assert.match(source,/sampleId/)
 assert.match(source,/samplePoint/)
 assert.match(source,/WATER_ANALYSIS_STATUSES/)
 assert.match(source,/supersedesWaterAnalysisId/)
 assert.match(source,/Historial append-only/)
 assert.match(source,/compareWaterAnalyses/)
 assert.doesNotMatch(source,/status:'Histórico'/)
})

test('M31-F008: persistencia/sync conserva evidencia anidada y el homónimo extranjero',async()=>{
 const output=await run(fixture(),{operation:IRRIGATION_MIRFE_OPERATIONS.RECORD_WATER_ANALYSIS,entityId:'water-shared',commandId:'water-sync',occurredAt:'2026-08-16T10:00:00.000Z',input:waterInput()})
 const record=output.state.waterAnalyses.find(item=>item.organizationId==='org-a')
 assert.ok(SYNCABLE_COLLECTIONS.includes('waterAnalyses'))
 const changes=collectionChanges({waterAnalyses:[]},{waterAnalyses:[record]},['waterAnalyses'])
 assert.equal(changes.length,1)
 assert.deepEqual(changes[0].payload.results,record.results)
 const queued=enqueueChanges({syncQueue:[]},changes,{companyId:'org-a',userId:'user-1',deviceId:'device-1'})
 assert.equal(queued.syncQueue[0].payload._organizationId,'org-a')
 assert.deepEqual(queued.syncQueue[0].payload.completeness,record.completeness)
 const foreign={...record,organizationId:'org-b',_organizationId:'org-b',laboratoryId:'foreign-lab'}
 const hydrated=applyRemoteRecords({currentContext:{companyId:'org-a'},waterAnalyses:[foreign]},[{companyId:'org-a',collection:'waterAnalyses',recordId:record.id,payload:record,version:3,updatedAt:'2026-08-16T10:01:00.000Z'}],{companyId:'org-a'})
 assert.equal(hydrated.waterAnalyses.length,2)
 assert.equal(hydrated.waterAnalyses.find(item=>item.organizationId==='org-b').laboratoryId,'foreign-lab')
 assert.deepEqual(hydrated.waterAnalyses.find(item=>item.organizationId==='org-a').results,record.results)
})
