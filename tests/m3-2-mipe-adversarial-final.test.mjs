import test from'node:test'
import assert from'node:assert/strict'
import{MIPE_OPERATIONS,executeMipeCommand}from'../src/services/mipeCommand.js'
import{mipeRecordOrganizationId}from'../src/domain/mipeTenancy.js'

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
