import test from'node:test'
import assert from'node:assert/strict'
import{identityAdministrationView,removeMembershipFromActiveOrganization,setMembershipStatus,validatedMembershipSiteIds}from'../src/domain/identityAdministration.js'

function fixture(){return{
 currentContext:{companyId:'org-a',siteId:'site-shared'},
 companies:[{id:'org-a'},{id:'org-b'}],
 users:[{id:'user-1',name:'Usuario compartido'},{id:'user-2',name:'Solo B'}],
 roles:[{id:'role-admin',active:true},{id:'role-disabled',active:false}],
 sites:[
  {id:'site-a',companyId:'org-a',name:'A'},
  {id:'site-b',companyId:'org-b',name:'B'},
  {id:'site-shared',companyId:'org-a',name:'Shared A'},
  {id:'site-shared',companyId:'org-b',name:'Shared B'}
 ],
 memberships:[
  {id:'m-a',userId:'user-1',companyId:'org-a',roleId:'role-admin',siteIds:['site-a'],status:'active'},
  {id:'m-b',userId:'user-1',companyId:'org-b',roleId:'role-admin',siteIds:['site-b'],status:'active'},
  {id:'m-b2',userId:'user-2',companyId:'org-b',roleId:'role-admin',siteIds:['site-b'],status:'active'}
 ]
}}

test('M4.7 administration view exposes only the active organization',()=>{
 const view=identityAdministrationView(fixture())
 assert.equal(view.organizationId,'org-a')
 assert.deepEqual(view.members.map(item=>item.membership.id),['m-a'])
 assert.deepEqual(view.sites.map(site=>site.id),['site-a'])
 assert.deepEqual(view.roles.map(role=>role.id),['role-admin'])
})

test('M4.7 status mutation cannot alter the same identity membership in another organization',()=>{
 const before=fixture()
 const next=setMembershipStatus(before,{organizationId:'org-a',userId:'user-1',status:'inactive',updatedAt:'2026-08-30T00:00:00.000Z'})
 assert.equal(next.memberships.find(item=>item.id==='m-a').status,'inactive')
 assert.equal(next.memberships.find(item=>item.id==='m-b').status,'active')
 assert.throws(()=>setMembershipStatus(before,{organizationId:'org-b',userId:'user-1',status:'inactive'}),/otra empresa/)
})

test('M4.7 removing access from A preserves global identity and membership in B',()=>{
 const before=fixture()
 const next=removeMembershipFromActiveOrganization(before,{organizationId:'org-a',userId:'user-1'})
 assert.equal(next.users.some(user=>user.id==='user-1'),true)
 assert.equal(next.memberships.some(item=>item.id==='m-a'),false)
 assert.equal(next.memberships.some(item=>item.id==='m-b'),true)
})

test('M4.7 site scope rejects foreign and ambiguous site identifiers',()=>{
 const state=fixture()
 assert.deepEqual(validatedMembershipSiteIds(state,['site-a']),['site-a'])
 assert.throws(()=>validatedMembershipSiteIds(state,['site-b']),/extranjera o ambigua/)
 assert.throws(()=>validatedMembershipSiteIds(state,['site-shared']),/extranjera o ambigua/)
})

test('M4.7 membership identity ambiguity fails closed inside active organization',()=>{
 const state=fixture()
 state.memberships.push({...state.memberships[0],id:'m-a-duplicate'})
 assert.throws(()=>setMembershipStatus(state,{organizationId:'org-a',userId:'user-1',status:'inactive'}),/duplicada o ambigua/)
 assert.throws(()=>removeMembershipFromActiveOrganization(state,{organizationId:'org-a',userId:'user-1'}),/duplicada o ambigua/)
})
