import test from'node:test'
import assert from'node:assert/strict'
import{permissionsForMembership,hasPermission}from'../src/domain/accessControl.js'
import{identityAdministrationView}from'../src/domain/identityAdministration.js'

const membership={id:'m-a',userId:'u-a',companyId:'org-a',roleId:'role-shared',siteIds:[],status:'active'}

test('M4.7 F004: organization membership cannot inherit permissions from role owned by another organization',()=>{
 const roles=[{id:'role-shared',organizationId:'org-b',permissions:['manage_users'],active:true}]
 assert.deepEqual(permissionsForMembership({membership,roles}),[])
 const state={currentContext:{companyId:'org-a'},memberships:[membership],roles,sites:[],companies:[{id:'org-a'},{id:'org-b'}]}
 assert.equal(hasPermission({state,userId:'u-a',companyId:'org-a',permission:'manage_users'}),false)
})

test('M4.7 F004: tenant role owned by same organization grants its permissions',()=>{
 const roles=[{id:'role-shared',organizationId:'org-a',permissions:['manage_users'],active:true}]
 assert.deepEqual(permissionsForMembership({membership,roles}),['manage_users'])
})

test('M4.7 F004: inactive role grants no permission',()=>{
 const roles=[{id:'role-shared',organizationId:'org-a',permissions:['manage_users'],active:false}]
 assert.deepEqual(permissionsForMembership({membership,roles}),[])
})

test('M4.7 F004: only explicit system roles may be shared without organization ownership',()=>{
 const legacy=[{id:'role-shared',permissions:['manage_users'],active:true}]
 const system=[{id:'role-shared',permissions:['manage_users'],active:true,isSystem:true}]
 assert.deepEqual(permissionsForMembership({membership,roles:legacy}),[])
 assert.deepEqual(permissionsForMembership({membership,roles:system}),['manage_users'])
})

test('M4.7 F004: identity admin role selector excludes foreign roles',()=>{
 const state={currentContext:{companyId:'org-a'},companies:[{id:'org-a'},{id:'org-b'}],users:[],memberships:[],sites:[],roles:[
  {id:'a',organizationId:'org-a',name:'A',active:true},
  {id:'b',organizationId:'org-b',name:'B',active:true},
  {id:'system',isSystem:true,name:'Sistema',active:true}
 ]}
 assert.deepEqual(identityAdministrationView(state).roles.map(role=>role.id),['a','system'])
})
