import test from'node:test'
import assert from'node:assert/strict'
import{existsSync,readFileSync}from'node:fs'
import{membersForActiveOrganization,setMembershipStatus,removeMembershipFromActiveOrganization}from'../src/domain/identityAdministration.js'

const state=()=>({
 currentContext:{companyId:'org-a'},
 companies:[{id:'org-a'},{id:'org-b'}],
 users:[
  {id:'user-shared',name:'Compartido',email:'shared@example.com',active:true},
  {id:'user-b',name:'Solo B',email:'b@example.com',active:true}
 ],
 roles:[{id:'role-admin',name:'Administrador',permissions:['manage_users'],active:true}],
 memberships:[
  {id:'membership-a',userId:'user-shared',companyId:'org-a',roleId:'role-admin',siteIds:['site-a'],status:'active'},
  {id:'membership-b-shared',userId:'user-shared',companyId:'org-b',roleId:'role-admin',siteIds:['site-b'],status:'active'},
  {id:'membership-b',userId:'user-b',companyId:'org-b',roleId:'role-admin',siteIds:['site-b'],status:'active'}
 ],
 sites:[{id:'site-a',organizationId:'org-a',name:'A'},{id:'site-b',organizationId:'org-b',name:'B'}]
})

test('M4.7 F001: client admin service exists and never embeds service-role authority',()=>{
 const url=new URL('../src/services/authAdminService.js',import.meta.url)
 assert.equal(existsSync(url),true)
 const source=readFileSync(url,'utf8')
 assert.doesNotMatch(source,/service[_-]?role/i)
 assert.match(source,/functions\/v1\/admin-users/)
})

test('M4.7 F002: active-company member projection excludes users that only belong to another organization',()=>{
 const members=membersForActiveOrganization(state())
 assert.deepEqual(members.map(item=>item.user.id),['user-shared'])
 assert.equal(members[0].membership.companyId,'org-a')
})

test('M4.7 F002: tenant deactivation changes only its membership, never global identity or foreign membership',()=>{
 const before=state()
 const next=setMembershipStatus(before,{userId:'user-shared',organizationId:'org-a',status:'inactive'})
 assert.equal(next.users.find(user=>user.id==='user-shared').active,true)
 assert.equal(next.memberships.find(item=>item.id==='membership-a').status,'inactive')
 assert.equal(next.memberships.find(item=>item.id==='membership-b-shared').status,'active')
})

test('M4.7 F002: removing tenant access preserves the global user and memberships in other organizations',()=>{
 const next=removeMembershipFromActiveOrganization(state(),{userId:'user-shared',organizationId:'org-a'})
 assert.ok(next.users.some(user=>user.id==='user-shared'))
 assert.equal(next.memberships.some(item=>item.id==='membership-a'),false)
 assert.equal(next.memberships.some(item=>item.id==='membership-b-shared'),true)
})

test('M4.7 F002: duplicate active-company membership identity fails closed',()=>{
 const duplicate=state()
 duplicate.memberships.push({id:'membership-a-2',userId:'user-shared',companyId:'org-a',roleId:'role-admin',siteIds:[],status:'active'})
 assert.throws(()=>setMembershipStatus(duplicate,{userId:'user-shared',organizationId:'org-a',status:'inactive'}),/duplicad|ambigu/i)
})

test('M4.7 F002: UsersPage consumes organization membership authority and does not globally delete identities',()=>{
 const source=readFileSync(new URL('../src/pages/UsersPage.jsx',import.meta.url),'utf8')
 assert.match(source,/membersForActiveOrganization/)
 assert.match(source,/setMembershipStatus|removeMembershipFromActiveOrganization/)
 assert.doesNotMatch(source,/deleteRemoteUser/)
 assert.doesNotMatch(source,/state\.users\.map\(/)
})
