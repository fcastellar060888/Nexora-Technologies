import test from'node:test'
import assert from'node:assert/strict'
import{readFile}from'node:fs/promises'
import{IRRIGATION_CALCULATION_MODES}from'../src/domain/irrigationTopology.js'
import{IRRIGATION_EMITTER_KINDS,IRRIGATION_TARGET_TYPES,createIrrigationAssignment,createIrrigationEmitter,createIrrigationSector}from'../src/domain/irrigationMirfe.js'
import{IRRIGATION_MIRFE_OPERATIONS,executeIrrigationMirfeCommand}from'../src/services/irrigationMirfeCommand.js'

const organizationId='org-a',foreignOrganizationId='org-b',siteId='site-1',houseId='house-1',geneticId='g-1'

function emitter(organization,flow){return createIrrigationEmitter({id:'emitter-1',organizationId:organization,siteId,name:'Anillo',kind:IRRIGATION_EMITTER_KINDS.RING,flowLitersPerHour:flow,controllerDeviceId:'controller-1'})}
function sector(organization){return createIrrigationSector({id:'sector-1',organizationId:organization,siteId,houseId,name:'Sector 1'})}
function assignment(organization){return createIrrigationAssignment({id:'assignment-1',organizationId:organization,siteId,sectorId:'sector-1',emitterId:'emitter-1',targetType:IRRIGATION_TARGET_TYPES.POSITION,targetId:'position-1',emitterCount:1,plantsServed:1,validFrom:'2026-08-15T00:00:00.000Z'})}

function fixture(){return{
 companies:[{id:organizationId},{id:foreignOrganizationId}],currentContext:{companyId:organizationId,siteId},
 sites:[{id:siteId,organizationId:foreignOrganizationId},{id:siteId,organizationId}],
 houses:[{id:houseId,organizationId:foreignOrganizationId,siteId},{id:houseId,organizationId,siteId}],
 beds:[{id:'bed-1',organizationId:foreignOrganizationId,siteId,houseId,geneticId,activePlants:999},{id:'bed-1',organizationId,siteId,houseId,geneticId,activePlants:1}],
 plantPositions:[{id:'position-1',organizationId:foreignOrganizationId,siteId,bedId:'bed-1',geneticId,active:true},{id:'position-1',organizationId,siteId,bedId:'bed-1',geneticId,active:true}],
 genetics:[{id:geneticId,organizationId:foreignOrganizationId},{id:geneticId,organizationId}],
 irrigationEmitters:[emitter(foreignOrganizationId,99),emitter(organizationId,2)],irrigationSectors:[sector(foreignOrganizationId),sector(organizationId)],irrigationAssignments:[assignment(foreignOrganizationId),assignment(organizationId)],
 users:[{id:'user-1',name:'Ana',activeSession:true,active:true,remote:true}],roles:[{id:'agronomist',permissions:['manage_irrigation']}],memberships:[{id:'membership-1',userId:'user-1',companyId:organizationId,roleId:'agronomist',siteIds:[siteId],status:'active'}],
 waterAnalyses:[],nutrientProducts:[],nutrientObjectives:[],irrigationPlans:[],formulations:[],tankPreparations:[],irrigationApplications:[],products:[],inventoryLots:[],inventoryMovements:[],workOrders:[],costEntries:[],mirfePrograms:[],mirfeMonitoring:[],mirfeReinforcements:[],irrigationCorrections:[],irrigationHistory:[]
}}

async function run(state){
 let current=state;const events=[]
 await executeIrrigationMirfeCommand(state,{operation:IRRIGATION_MIRFE_OPERATIONS.CREATE_IRRIGATION_PLAN,entityId:'plan-1',commandId:'command-plan-1',occurredAt:'2026-08-16T12:00:00.000Z',input:{siteId,houseId,sectorId:'sector-1',geneticId,stage:'Vegetativo',apps:2,minutes:30,tank:1000}},{publishEvent:async event=>events.push(event),commit:recipe=>{current=recipe(current)}})
 return{state:current,events}
}

test('M31-F004: command persiste snapshot canónico y evento sin usar homónimos extranjeros',async()=>{
 const{state,events}=await run(fixture()),plan=state.irrigationPlans[0],event=events.at(-1)
 assert.equal(plan.calculationMode,IRRIGATION_CALCULATION_MODES.CANONICAL_TOPOLOGY)
 assert.equal(plan.plants,1)
 assert.equal(plan.flow,2)
 assert.equal(plan.pulse,1)
 assert.equal(plan.daily,2)
 assert.equal(plan.assignmentCount,1)
 assert.equal(plan.emitterCount,1)
 assert.deepEqual(plan.topologySnapshot.assignmentIds,['assignment-1'])
 assert.equal(plan.topologySnapshot.rows[0].controlMode,'AUTOMATIC')
 assert.equal(event.payload.calculationMode,IRRIGATION_CALCULATION_MODES.CANONICAL_TOPOLOGY)
 assert.equal(event.payload.assignmentCount,1)
})

test('M31-F004: command falla antes de publicar si el emisor solo existe en otro tenant',async()=>{
 const state=fixture();state.irrigationEmitters=state.irrigationEmitters.filter(item=>item.organizationId===foreignOrganizationId)
 let publishes=0,commits=0
 await assert.rejects(()=>executeIrrigationMirfeCommand(state,{operation:IRRIGATION_MIRFE_OPERATIONS.CREATE_IRRIGATION_PLAN,entityId:'plan-1',commandId:'command-plan-1',occurredAt:'2026-08-16T12:00:00.000Z',input:{siteId,houseId,geneticId,apps:2,minutes:30,tank:1000}},{publishEvent:async()=>{publishes+=1},commit:()=>{commits+=1}}),/emisor no existe/)
 assert.equal(publishes,0)
 assert.equal(commits,0)
})

test('M31-F004: pantalla operativa expone sector y fuente del cálculo canónico',async()=>{
 const source=await readFile(new URL('../src/pages/IrrigationPlanPage.jsx',import.meta.url),'utf8')
 assert.match(source,/state\.irrigationSectors/)
 assert.match(source,/sectorId/)
 assert.match(source,/CANONICAL_TOPOLOGY/)
 assert.doesNotMatch(source,/hydraulics\(/)
})
