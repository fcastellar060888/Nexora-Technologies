import test from'node:test'
import assert from'node:assert/strict'
import{readFile}from'node:fs/promises'
import{createGeneticProfile,archiveGeneticProfile,geneticProfilesForOrganization,upsertGeneticProfile}from'../src/domain/geneticProfile.js'
import{executeGeneticProfileCommand,GENETIC_OPERATIONS}from'../src/services/geneticProfileCommand.js'

const enterpriseState=()=>({
 companies:[{id:'org-a'},{id:'org-b'}],sites:[{id:'site-a',companyId:'org-a'}],
 currentContext:{companyId:'org-a',siteId:'site-a'},
 users:[{id:'u1',activeSession:true,active:true,remote:true}],
 roles:[{id:'agronomist',permissions:['manage_cultivation']}],
 memberships:[{id:'m1',userId:'u1',companyId:'org-a',roleId:'agronomist',siteIds:['site-a'],status:'active'}],
 genetics:[],plantPositions:[]
})

test('M21-F001: genetic profiles are scoped by organization even when ids repeat',()=>{
 const state=enterpriseState()
 state.genetics=[
  {id:'same',organizationId:'org-a',name:'Alpha',color:'#111111',active:true},
  {id:'same',organizationId:'org-b',name:'Beta',color:'#222222',active:true}
 ]
 assert.deepEqual(geneticProfilesForOrganization(state).map(item=>item.name),['Alpha'])
 const created=createGeneticProfile(state,{name:'Gamma'},{id:'g3',now:'2026-08-15T00:00:00.000Z'})
 assert.equal(created.organizationId,'org-a')
 assert.equal(created.id,'g3')
})

test('M21-F001: duplicate names are rejected only inside the active tenant',()=>{
 const state=enterpriseState()
 state.genetics=[{id:'a',organizationId:'org-a',name:'Kush',active:true},{id:'b',organizationId:'org-b',name:'Kush',active:true}]
 assert.throws(()=>createGeneticProfile(state,{name:'Kush'}),/Ya existe/)
 const other={...state,currentContext:{companyId:'org-b',siteId:''},memberships:[{id:'m2',userId:'u1',companyId:'org-b',roleId:'agronomist',siteIds:[],status:'active'}]}
 assert.throws(()=>createGeneticProfile(other,{name:'Kush'}),/Ya existe/)
})

test('M21-F002: archive preserves identity instead of deleting the profile',()=>{
 const state=enterpriseState(),profile=createGeneticProfile(state,{name:'Archive Me'},{id:'g1',now:'2026-08-15T00:00:00.000Z'})
 const withProfile=upsertGeneticProfile(state,profile)
 const archived=archiveGeneticProfile(withProfile,'g1',{now:'2026-08-16T00:00:00.000Z'})
 const final=upsertGeneticProfile(withProfile,archived)
 assert.equal(final.genetics.length,1)
 assert.equal(final.genetics[0].id,'g1')
 assert.equal(final.genetics[0].active,false)
 assert.equal(final.genetics[0].archivedAt,'2026-08-16T00:00:00.000Z')
})

test('M21-F001/F002: command requires cultivation permission and publishes requested then completed',async()=>{
 let state=enterpriseState(),events=[]
 const commit=recipe=>{state=recipe(state)}
 const result=await executeGeneticProfileCommand(state,{operation:GENETIC_OPERATIONS.CREATE,input:{name:'Command Genetic'},geneticId:'g1',commandId:'cmd-1',occurredAt:'2026-08-15T00:00:00.000Z'},{commit,publishEvent:async event=>{events.push(event)}})
 assert.equal(result.profile.organizationId,'org-a')
 assert.equal(state.genetics.length,1)
 assert.deepEqual(events.map(event=>event.name),['core.operation.requested','genetic.profile.created'])
 assert.deepEqual(events.map(event=>event.eventId),['cmd-1:requested','cmd-1:completed'])
 const denied=enterpriseState();denied.roles=[{id:'viewer',permissions:[]}];denied.memberships=[{id:'m1',userId:'u1',companyId:'org-a',roleId:'viewer',siteIds:['site-a'],status:'active'}]
 await assert.rejects(()=>executeGeneticProfileCommand(denied,{operation:GENETIC_OPERATIONS.CREATE,input:{name:'Denied'}},{commit:()=>{},publishEvent:async()=>{}}),/permiso/)
})

test('M21-F001 re-audit: genetics UI has no direct store mutation or destructive filter',async()=>{
 const page=await readFile(new URL('../src/pages/GeneticsPage.jsx',import.meta.url),'utf8')
 const app=await readFile(new URL('../src/App.jsx',import.meta.url),'utf8')
 assert.match(page,/executeGeneticProfileCommand/)
 assert.doesNotMatch(page,/\bupdate\s*\(/)
 assert.doesNotMatch(page,/genetics\.filter\(/)
 assert.match(app,/path="\/genetics" element={<Guard permission="manage_cultivation">/)
})
