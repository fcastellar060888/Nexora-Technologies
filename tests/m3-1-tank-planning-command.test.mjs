import test from'node:test'
import assert from'node:assert/strict'
import{readFile}from'node:fs/promises'
import{DomainEvents}from'../src/core/events/eventCatalog.js'
import{IRRIGATION_MIRFE_OPERATIONS,executeIrrigationMirfeCommand}from'../src/services/irrigationMirfeCommand.js'

const fixture=()=>({
 companies:[{id:'org-a'},{id:'org-b'}],currentContext:{companyId:'org-a',siteId:'site-1'},
 users:[{id:'user-1',name:'Ana',activeSession:true,active:true,remote:true}],roles:[{id:'agronomist',permissions:['manage_irrigation']}],memberships:[{id:'membership-1',userId:'user-1',companyId:'org-a',roleId:'agronomist',siteIds:['site-1'],status:'active'}],
 sites:[{id:'site-1',organizationId:'org-b',name:'B'},{id:'site-1',organizationId:'org-a',name:'A'}],houses:[{id:'house-1',organizationId:'org-b',siteId:'site-1'},{id:'house-1',organizationId:'org-a',siteId:'site-1'}],genetics:[{id:'g-1',organizationId:'org-b'},{id:'g-1',organizationId:'org-a'}],
 beds:[{id:'bed-1',organizationId:'org-b',siteId:'site-1',houseId:'house-1',geneticId:'g-1',activePlants:999,drippers:99,flow:99},{id:'bed-1',organizationId:'org-a',siteId:'site-1',houseId:'house-1',geneticId:'g-1',activePlants:1,drippers:1,flow:400}],plantPositions:[],propagationBanks:[],propagationUnits:[],
 products:[{id:'inventory-1',organizationId:'org-b',unit:'kg'},{id:'inventory-1',organizationId:'org-a',unit:'kg'}],nutrientProducts:[{id:'nutrient-1',organizationId:'org-b',inventoryProductId:'inventory-1'},{id:'nutrient-1',organizationId:'org-a',inventoryProductId:'inventory-1'}],
 irrigationEmitters:[],irrigationSectors:[],irrigationAssignments:[],irrigationPulses:[],irrigationMeasurements:[],drainageMeasurements:[],waterAnalyses:[],nutrientObjectives:[],irrigationPlans:[],formulations:[],tankPreparations:[],irrigationApplications:[],inventoryLots:[],inventoryMovements:[],workOrders:[],costEntries:[],mirfePrograms:[],mirfeMonitoring:[],mirfeReinforcements:[],irrigationCorrections:[],irrigationHistory:[]
})

const planCommand=(overrides={})=>({operation:IRRIGATION_MIRFE_OPERATIONS.CREATE_IRRIGATION_PLAN,entityId:'plan-1',commandId:'plan-command',occurredAt:'2026-08-16T16:00:00.000Z',input:{siteId:'site-1',houseId:'house-1',geneticId:'g-1',stage:'Vegetativo',apps:3,minutes:60,tank:1000,...overrides}})

async function run(initial,command){
 let state=initial;const events=[]
 const result=await executeIrrigationMirfeCommand(state,command,{publishEvent:async event=>events.push(event),commit:recipe=>{state=recipe(state)}})
 return{state,events,result}
}

test('M31-F007: command persiste frecuencia y cargas deterministas tenant-aware',async()=>{
 const state=fixture(),foreignLoad={id:'plan-1:application:1:load:1',organizationId:'org-b',irrigationPlanId:'plan-1',siteId:'site-1',applicationSequence:1,loadSequence:1,volumeLiters:999,status:'PLANNED'}
 state.irrigationPlans=[{id:'plan-1',organizationId:'org-b',siteId:'site-1',stage:'Vegetativo',geneticId:'g-1',loadSchedule:[foreignLoad]}]
 const result=await run(state,planCommand()),plan=result.state.irrigationPlans.find(item=>item.organizationId==='org-a'),event=result.events.at(-1)
 assert.equal(plan.pulse,400)
 assert.equal(plan.daily,1200)
 assert.equal(plan.tankCapacityLiters,1000)
 assert.equal(plan.preparationCount,3)
 assert.equal(plan.preparationsPerApplication,1)
 assert.deepEqual(plan.loadSchedule.map(item=>item.volumeLiters),[400,400,400])
 assert.ok(plan.loadSchedule.every(item=>item.organizationId==='org-a'&&item.irrigationPlanId==='plan-1'&&item.siteId==='site-1'))
 assert.equal(result.state.irrigationPlans.find(item=>item.organizationId==='org-b').loadSchedule[0].volumeLiters,999)
 assert.equal(event.name,DomainEvents.MIRFE_IRRIGATION_PLAN_CREATED)
 assert.equal(event.payload.preparationCount,3)
 assert.equal(event.payload.tankCapacityLiters,1000)
})

test('M31-F007: capacidad excesiva y aplicaciones fraccionarias fallan antes de eventos',async()=>{
 for(const input of[{tank:1001},{apps:1.5}]){
  let publishes=0,commits=0
  await assert.rejects(()=>executeIrrigationMirfeCommand(fixture(),planCommand(input),{publishEvent:async()=>{publishes+=1},commit:()=>{commits+=1}}),input.tank?/no puede superar 1000 L/:/entero positivo/)
  assert.equal(publishes,0);assert.equal(commits,0)
 }
})

test('M31-F007: una carga crea preparación vinculada y escala solo la fórmula del tenant activo',async()=>{
 const initial=fixture();initial.irrigationPlans=[{id:'plan-1',organizationId:'org-b',siteId:'site-1',stage:'Vegetativo',geneticId:'g-1',loadSchedule:[{id:'plan-1:application:1:load:1',organizationId:'org-b',irrigationPlanId:'plan-1',siteId:'site-1',applicationSequence:1,loadSequence:1,volumeLiters:999,status:'PLANNED'}]}]
 let state=(await run(initial,planCommand())).state
 state={...state,formulations:[
  {id:'formula-1',organizationId:'org-b',siteId:'site-1',status:'Aprobada',stage:'Vegetativo',geneticId:'g-1',volumeL:1000,items:[{id:'item-1',productId:'nutrient-1',tank:'A',grams:900}]},
  {id:'formula-1',organizationId:'org-a',siteId:'site-1',status:'Aprobada',stage:'Vegetativo',geneticId:'g-1',formulaKey:'formula-key',version:2,volumeL:1000,items:[{id:'item-1',productId:'nutrient-1',tank:'A',grams:500}]}
 ]}
 const plan=state.irrigationPlans.find(item=>item.organizationId==='org-a'),load=plan.loadSchedule[0]
 const command={operation:IRRIGATION_MIRFE_OPERATIONS.CREATE_PREPARATION,entityId:'client-id-must-not-win',commandId:'prepare-load-command',occurredAt:'2026-08-16T16:05:00.000Z',input:{formulationId:'formula-1',siteId:'site-1',irrigationPlanId:plan.id,loadId:load.id,responsible:'Ana'}}
 const created=await run(state,command);state=created.state
 const preparation=state.tankPreparations.find(item=>item.organizationId==='org-a'),activePlan=state.irrigationPlans.find(item=>item.organizationId==='org-a'),foreignPlan=state.irrigationPlans.find(item=>item.organizationId==='org-b')
 assert.equal(preparation.id,`${load.id}:preparation`)
 assert.equal(preparation.volumeL,400)
 assert.equal(preparation.items[0].requiredQuantity,200)
 assert.equal(preparation.formulaVersion,2)
 assert.equal(preparation.irrigationPlanId,'plan-1')
 assert.equal(preparation.applicationSequence,1)
 assert.equal(activePlan.loadSchedule[0].status,'PREPARATION_CREATED')
 assert.equal(activePlan.loadSchedule[0].preparationId,preparation.id)
 assert.equal(foreignPlan.loadSchedule[0].status,'PLANNED')
 assert.equal(foreignPlan.loadSchedule[0].volumeLiters,999)
 assert.equal(created.events.at(-1).payload.loadId,load.id)
 const secondLoad=activePlan.loadSchedule[1],second=await run(state,{...command,commandId:'prepare-second-load',input:{...command.input,loadId:secondLoad.id}});state=second.state
 assert.equal(state.tankPreparations.filter(item=>item.organizationId==='org-a'&&item.formulationId==='formula-1').length,2)
 assert.equal(state.irrigationPlans.find(item=>item.organizationId==='org-a').loadSchedule[1].status,'PREPARATION_CREATED')
 assert.notEqual(state.tankPreparations[0].items[0].id,state.tankPreparations[1].items[0].id)
 let publishes=0
 await assert.rejects(()=>executeIrrigationMirfeCommand(state,{...command,commandId:'different-command'},{publishEvent:async()=>{publishes+=1},commit:()=>{}}),/ya tiene una preparación/)
 assert.equal(publishes,0)
})

test('M31-F007: fórmula de otra etapa o genética no puede reservar la carga',async()=>{
 let state=(await run(fixture(),planCommand())).state
 state.formulations=[{id:'formula-1',organizationId:'org-a',siteId:'site-1',status:'Aprobada',stage:'Floración',geneticId:'g-1',volumeL:1000,items:[{productId:'nutrient-1',tank:'A',grams:500}]}]
 const plan=state.irrigationPlans[0],load=plan.loadSchedule[0];let publishes=0
 await assert.rejects(()=>executeIrrigationMirfeCommand(state,{operation:IRRIGATION_MIRFE_OPERATIONS.CREATE_PREPARATION,commandId:'bad-stage',input:{formulationId:'formula-1',siteId:'site-1',irrigationPlanId:plan.id,loadId:load.id}},{publishEvent:async()=>{publishes+=1},commit:()=>{}}),/etapa del plan/)
 assert.equal(publishes,0)
})

test('M31-F007: UI limita 1.000 L y materializa cargas mediante fórmula compatible',async()=>{
 const planSource=await readFile(new URL('../src/pages/IrrigationPlanPage.jsx',import.meta.url),'utf8'),preparationSource=await readFile(new URL('../src/pages/PreparationsPage.jsx',import.meta.url),'utf8')
 assert.match(planSource,/max=\{MAX_IRRIGATION_TANK_CAPACITY_LITERS\}/)
 assert.match(planSource,/Preparaciones\/día/)
 assert.match(planSource,/latest\.loadSchedule/)
 assert.match(preparationSource,/Cargas planificadas/)
 assert.match(preparationSource,/irrigationPlanId:scheduled\.plan\.id/)
 assert.match(preparationSource,/loadId:scheduled\.load\.id/)
 assert.match(preparationSource,/compatibleFormulas/)
})
