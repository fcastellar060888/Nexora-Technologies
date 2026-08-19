import test from'node:test'
import assert from'node:assert/strict'
import{readFileSync}from'node:fs'
import{canUserAccessSite,locationScopeForUser}from'../src/domain/accessControl.js'

const state=()=>({
 currentContext:{companyId:'org-a'},
 companies:[{id:'org-a'},{id:'org-b'}],
 users:[{id:'user-a',activeSession:true}],
 roles:[{id:'role-a',name:'Operador',permissions:['view_sites'],active:true}],
 memberships:[{id:'membership-a',userId:'user-a',companyId:'org-a',roleId:'role-a',siteIds:['site-b'],status:'active'}],
 sites:[{id:'site-a',organizationId:'org-a'},{id:'site-b',organizationId:'org-b'}],houses:[],beds:[]
})

test('M4.7 F003: membership siteIds cannot grant access to a site owned by another organization',()=>{
 assert.equal(canUserAccessSite(state(),'user-a','site-b'),false)
})

test('M4.7 F003: legitimate site inside membership organization remains accessible',()=>{
 const s=state();s.memberships[0].siteIds=['site-a']
 assert.equal(canUserAccessSite(s,'user-a','site-a'),true)
 assert.deepEqual(locationScopeForUser(s,'user-a').siteIds,['site-a'])
})

test('M4.7 F003: homonymous site IDs across tenants fail closed instead of resolving by raw ID',()=>{
 const s=state();s.sites.push({id:'site-a',organizationId:'org-b'});s.memberships[0].siteIds=['site-a']
 assert.equal(canUserAccessSite(s,'user-a','site-a'),false)
 assert.deepEqual(locationScopeForUser(s,'user-a').siteIds,[])
})

test('M4.7 F003: UsersPage offers only active-company sites when creating membership access',()=>{
 const source=readFileSync(new URL('../src/pages/UsersPage.jsx',import.meta.url),'utf8')
 assert.match(source,/sitesForActiveOrganization|identityAdministrationView/)
 assert.doesNotMatch(source,/state\.sites\.map\(/)
})
