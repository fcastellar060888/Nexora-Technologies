import test from'node:test'
import assert from'node:assert/strict'
import{canAccessSite,hasPermission,permissionsForMembership,resolveActiveAccess}from'../src/domain/accessControl.js'

test('combina permisos del rol y overrides respetando denegaciones',()=>{
 const permissions=permissionsForMembership({
  membership:{roleId:'r1',permissionOverrides:['manage_sales'],deniedPermissions:['manage_inventory'],status:'active'},
  roles:[{id:'r1',permissions:['view_operations','manage_inventory']}]
 })
 assert.deepEqual(permissions.sort(),['manage_sales','view_operations'])
})

test('membresía sin sedes restringidas puede acceder a toda la organización',()=>{
 assert.equal(canAccessSite({status:'active',siteIds:[]},'site-1'),true)
 assert.equal(canAccessSite({status:'active',siteIds:['site-2']},'site-1'),false)
})

test('resuelve permisos por organización y sede',()=>{
 const state={
  roles:[{id:'r1',permissions:['manage_mipe']}],
  memberships:[{id:'m1',userId:'u1',companyId:'c1',roleId:'r1',siteIds:['s1'],status:'active'}]
 }
 assert.equal(resolveActiveAccess(state,'u1').length,1)
 assert.equal(hasPermission({state,userId:'u1',companyId:'c1',siteId:'s1',permission:'manage_mipe'}),true)
 assert.equal(hasPermission({state,userId:'u1',companyId:'c1',siteId:'s2',permission:'manage_mipe'}),false)
})
