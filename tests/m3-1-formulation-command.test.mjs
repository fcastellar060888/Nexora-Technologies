import test from'node:test'
import assert from'node:assert/strict'
import{readFile}from'node:fs/promises'
import{DomainEvents}from'../src/core/events/eventCatalog.js'
import{IRRIGATION_MIRFE_OPERATIONS,executeIrrigationMirfeCommand}from'../src/services/irrigationMirfeCommand.js'

const fixture=()=>({
 companies:[{id:'org-a'},{id:'org-b'}],currentContext:{companyId:'org-a',siteId:'site-1'},
 users:[{id:'user-1',name:'Ana',activeSession:true,active:true,remote:true}],
 roles:[{id:'agronomist',permissions:['manage_irrigation','approve_formulas','record_irrigation']}],
 memberships:[{id:'membership-1',userId:'user-1',companyId:'org-a',roleId:'agronomist',siteIds:['site-1'],status:'active'}],
 sites:[{id:'site-1',organizationId:'org-b',name:'B'},{id:'site-1',organizationId:'org-a',name:'A'}],
 genetics:[{id:'g-1',organizationId:'org-b'},{id:'g-1',organizationId:'org-a'}],
 products:[{id:'inventory-1',organizationId:'org-b',unit:'kg'},{id:'inventory-1',organizationId:'org-a',unit:'kg'}],
 nutrientProducts:[
  {id:'nutrient-shared',organizationId:'org-b',name:'N extranjero',inventoryProductId:'inventory-1',tank:'A',nNo3:1,active:true},
  {id:'nutrient-shared',organizationId:'org-a',name:'N activo',inventoryProductId:'inventory-1',tank:'A',nNo3:10,active:true}
 ],
 nutrientObjectives:[
  {id:'objective-shared',organizationId:'org-b',geneticId:'g-1',stage:'Vegetativo',status:'Aprobada',n:1,p:0,k:0,ca:0,mg:0,s:0},
  {id:'objective-shared',organizationId:'org-a',geneticId:'g-1',stage:'Vegetativo',status:'Aprobada',n:100,p:0,k:0,ca:0,mg:0,s:0}
 ],
 waterAnalyses:[
  {id:'water-shared',organizationId:'org-b',siteId:'site-1',status:'Vigente',nNo3:90,nNh4:0,p:0,k:0,ca:0,mg:0,s:0},
  {id:'water-shared',organizationId:'org-a',siteId:'site-1',status:'Vigente',nNo3:0,nNh4:0,p:0,k:0,ca:0,mg:0,s:0}
 ],
 houses:[],beds:[],plantPositions:[],propagationBanks:[],propagationUnits:[],inventoryLots:[],inventoryMovements:[],
 irrigationEmitters:[],irrigationSectors:[],irrigationAssignments:[],irrigationPulses:[],irrigationMeasurements:[],drainageMeasurements:[],
 irrigationPlans:[],formulations:[],tankPreparations:[],irrigationApplications:[],workOrders:[],costEntries:[],
 mirfePrograms:[],mirfeMonitoring:[],mirfeReinforcements:[],irrigationCorrections:[],irrigationHistory:[]
})

const validInput=()=>({siteId:'site-1',geneticId:'g-1',stage:'Vegetativo',volumeL:1000,items:[{productId:'nutrient-shared',tank:'A',grams:1000}],validation:{valid:false,warnings:['cliente no autoritativo']}})

function runtime(initial){
 let state=initial,events=[],commits=0
 return{
  get state(){return state},get events(){return events},get commits(){return commits},
  execute:command=>executeIrrigationMirfeCommand(state,command,{publishEvent:async event=>events.push(event),commit:recipe=>{commits+=1;state=recipe(state)}})
 }
}

test('M31-F005: aprobación recalcula evidencia en servidor usando solo el tenant activo',async()=>{
 const app=runtime(fixture())
 await app.execute({operation:IRRIGATION_MIRFE_OPERATIONS.APPROVE_FORMULATION,entityId:'formula-v1',commandId:'approve-v1',occurredAt:'2026-08-16T14:00:00.000Z',input:validInput()})
 const formula=app.state.formulations.find(item=>item.organizationId==='org-a')
 assert.equal(formula.status,'Aprobada')
 assert.equal(formula.version,1)
 assert.equal(formula.formulaKey,'formula-v1')
 assert.equal(formula.validation.valid,true)
 assert.equal(formula.validation.totals.n,100)
 assert.equal(formula.targetSnapshot.n,100)
 assert.equal(formula.productSnapshots[0].composition.n,10)
 assert.equal(formula.waterAnalysisId,'water-shared')
 assert.equal(formula.nutrientObjectiveId,'objective-shared')
 assert.equal(app.events.at(-1).name,DomainEvents.MIRFE_FORMULA_APPROVED)
 assert.equal(app.events.at(-1).payload.formulaVersion,1)
 assert.equal(app.events.at(-1).payload.validationValid,true)
})

test('M31-F005: validation falsa del cliente no permite aprobar una dosis desviada',async()=>{
 const state=fixture();let publishes=0,commits=0
 await assert.rejects(()=>executeIrrigationMirfeCommand(state,{operation:IRRIGATION_MIRFE_OPERATIONS.APPROVE_FORMULATION,entityId:'formula-invalid',commandId:'approve-invalid',input:{...validInput(),items:[{productId:'nutrient-shared',tank:'A',grams:100}],validation:{valid:true,warnings:[]}}},{publishEvent:async()=>{publishes+=1},commit:()=>{commits+=1}}),/no puede aprobarse/)
 assert.equal(publishes,0)
 assert.equal(commits,0)
})

test('M31-F005: una nueva versión preserva el registro anterior y la preparación fija el lineage',async()=>{
 const initial={...fixture(),formulations:[{id:'formula-v1',organizationId:'org-b',siteId:'site-1',geneticId:'g-1',stage:'Vegetativo',formulaKey:'foreign',version:9,status:'Aprobada',items:[]}]}
 const app=runtime(initial)
 await app.execute({operation:IRRIGATION_MIRFE_OPERATIONS.CREATE_FORMULATION,entityId:'formula-v1',commandId:'draft-v1',occurredAt:'2026-08-16T14:10:00.000Z',input:validInput()})
 const first=app.state.formulations.find(item=>item.id==='formula-v1'&&item.organizationId==='org-a'),snapshot=JSON.stringify(first)
 await app.execute({operation:IRRIGATION_MIRFE_OPERATIONS.APPROVE_FORMULATION,entityId:'formula-v2',commandId:'approve-v2',occurredAt:'2026-08-16T14:15:00.000Z',input:validInput()})
 const second=app.state.formulations.find(item=>item.id==='formula-v2'&&item.organizationId==='org-a')
 assert.equal(JSON.stringify(app.state.formulations.find(item=>item.id==='formula-v1'&&item.organizationId==='org-a')),snapshot)
 assert.equal(second.formulaKey,'formula-v1')
 assert.equal(second.version,2)
 assert.equal(second.supersedesFormulaId,'formula-v1')
 await app.execute({operation:IRRIGATION_MIRFE_OPERATIONS.CREATE_PREPARATION,entityId:'prep-v2',commandId:'prepare-v2',occurredAt:'2026-08-16T14:20:00.000Z',input:{formulationId:'formula-v2',siteId:'site-1'}})
 const preparation=app.state.tankPreparations.find(item=>item.id==='prep-v2')
 assert.equal(preparation.formulaKey,'formula-v1')
 assert.equal(preparation.formulaVersion,2)
 assert.equal(preparation.volumeL,1000)
})

test('M31-F005: una referencia disponible solo en otro tenant falla antes de publicar',async()=>{
 const state={...fixture(),nutrientProducts:fixture().nutrientProducts.filter(item=>item.organizationId==='org-b')};let publishes=0,commits=0
 await assert.rejects(()=>executeIrrigationMirfeCommand(state,{operation:IRRIGATION_MIRFE_OPERATIONS.APPROVE_FORMULATION,entityId:'foreign-formula',commandId:'foreign-product',input:validInput()},{publishEvent:async()=>{publishes+=1},commit:()=>{commits+=1}}),/empresa activa/)
 assert.equal(publishes,0)
 assert.equal(commits,0)
})

test('M31-F005: un borrador advertido se conserva, pero queda explícitamente no aprobable',async()=>{
 const app=runtime(fixture())
 await app.execute({operation:IRRIGATION_MIRFE_OPERATIONS.CREATE_FORMULATION,entityId:'draft-invalid',commandId:'draft-invalid',occurredAt:'2026-08-16T14:30:00.000Z',input:{...validInput(),items:[{productId:'nutrient-shared',tank:'A',grams:100}]}})
 const formula=app.state.formulations.find(item=>item.id==='draft-invalid')
 assert.equal(formula.status,'Borrador')
 assert.equal(formula.validation.valid,false)
 assert.match(formula.validation.warnings.join(' '),/desviación/)
})

test('M31-F005: UI usa solver canónico y deshabilita aprobación advertida',async()=>{
 const source=await readFile(new URL('../src/pages/FormulationPage.jsx',import.meta.url),'utf8')
 assert.match(source,/solveFertigationFormula/)
 assert.doesNotMatch(source,/calculateSimpleFormula/)
 assert.match(source,/validation\?\.valid!==true/)
 assert.match(source,/disabled=\{!validation\?\.valid\}/)
 assert.match(source,/formulaKey/)
 assert.match(source,/version/)
})
