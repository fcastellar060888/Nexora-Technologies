import test from'node:test'
import assert from'node:assert/strict'
import{executePlantEventCommand,preparePlantEventCommand}from'../src/services/plantEventCommand.js'
import{DomainEvents}from'../src/core/events/eventCatalog.js'

function baseState({role='Operario',companyId='org-a',plantOwner='org-a'}={}){
 return{
  currentContext:{companyId},
  companies:[{id:'org-a'},{id:'org-b'}],
  users:[{id:'user-1',name:'Operario Uno',role,active:true,activeSession:true}],
  sites:[{id:'site-a',companyId:'org-a'},{id:'site-b',companyId:'org-b'}],
  houses:[{id:'house-a',siteId:'site-a'},{id:'house-b',siteId:'site-b'}],
  beds:[{id:'bed-a',houseId:'house-a'},{id:'bed-b',houseId:'house-b'}],
  plantPositions:[{id:'plant-1',bedId:plantOwner==='org-a'?'bed-a':'bed-b',organizationId:plantOwner}],
  plantEvents:[]
 }
}

const input={plantId:'plant-1',commandId:'cmd-1',type:'Observación',title:'Revisión de vigor',detail:'Sin novedades',date:'2026-08-14T05:00:00.000Z'}

test('M11-F005/F006: authorized command publishes intent, commits once and confirms audit event',async()=>{
 let state=baseState(),commits=0
 const published=[]
 const result=await executePlantEventCommand(state,input,{
  publishEvent:async spec=>{published.push(spec);return{ok:true}},
  commit:(recipe)=>{state=recipe(state);commits+=1}
 })
 assert.equal(result.ok,true)
 assert.equal(commits,1)
 assert.equal(state.plantEvents.length,1)
 assert.equal(state.plantEvents[0].organizationId,'org-a')
 assert.equal(state.plantEvents[0].siteId,'site-a')
 assert.equal(state.plantEvents[0].actorId,'user-1')
 assert.deepEqual(published.map(item=>item.name),[DomainEvents.PLANT_EVENT_REQUESTED,DomainEvents.PLANT_EVENT_RECORDED])
 assert.deepEqual(published.map(item=>item.eventId),['cmd-1:requested','cmd-1:recorded'])
 assert.equal(published[1].causationId,'cmd-1:requested')
})

test('M11-F006: user without record_observations cannot prepare a write command',()=>{
 assert.throws(()=>preparePlantEventCommand(baseState({role:'Gerente'}),input),/permiso/)
})

test('M11-F005: cross-tenant plant mutation is rejected before publishing or committing',async()=>{
 let publishes=0,commits=0
 await assert.rejects(()=>executePlantEventCommand(baseState({plantOwner:'org-b'}),input,{publishEvent:async()=>{publishes+=1},commit:()=>{commits+=1}}),/otra empresa/)
 assert.equal(publishes,0)
 assert.equal(commits,0)
})

test('M11-F005: retry of same command does not duplicate state and republishes only completion idempotently',async()=>{
 let state=baseState(),commits=0
 const publish=async()=>({ok:true})
 const commit=recipe=>{state=recipe(state);commits+=1}
 await executePlantEventCommand(state,input,{publishEvent:publish,commit})
 const published=[]
 const retry=await executePlantEventCommand(state,input,{publishEvent:async spec=>{published.push(spec);return{ok:true}},commit})
 assert.equal(retry.duplicate,true)
 assert.equal(state.plantEvents.length,1)
 assert.equal(commits,1)
 assert.deepEqual(published.map(item=>item.eventId),['cmd-1:recorded'])
})

test('M11-F005: commandId collision with different content fails closed',()=>{
 const state={...baseState(),plantEvents:[{id:'cmd-1',commandId:'cmd-1',plantId:'plant-1',organizationId:'org-a',siteId:'site-a',actorId:'user-1',type:'Observación',title:'Otro título',detail:'',date:'2026-08-14T05:00:00.000Z'}]}
 assert.throws(()=>preparePlantEventCommand(state,input),/contenido diferente/)
})
