import test from'node:test'
import assert from'node:assert/strict'
import{readFile}from'node:fs/promises'
import{PERMISSIONS}from'../src/domain/accessControl.js'
import{ROLE_PERMISSIONS}from'../src/services/permissions.js'
import{inventoryUiAccess,scopeInventoryUiState}from'../src/services/inventoryUiAccess.js'

const org='org-a'
const baseState=({permissions=['view_inventory'],siteId='s1',membershipSites=['s1']}={})=>({
 companies:[{id:org}],
 currentContext:{companyId:org,siteId},
 users:[{id:'u1',remote:true,active:true,activeSession:true}],
 roles:[{id:'r1',permissions}],
 memberships:[{id:'m1',userId:'u1',companyId:org,roleId:'r1',siteIds:membershipSites,status:'active'}],
 sites:[{id:'s1',companyId:org,name:'Allowed'},{id:'s2',companyId:org,name:'Foreign site'}],
 products:[{id:'p1',organizationId:org,name:'Product'}],
 inventoryLots:[
  {id:'l1',organizationId:org,productId:'p1',siteId:'s1',quantity:10},
  {id:'l2',organizationId:org,productId:'p1',siteId:'s2',quantity:20}
 ],
 inventoryMovements:[
  {id:'mv1',organizationId:org,lotId:'l1',productId:'p1',siteId:'s1'},
  {id:'mv2',organizationId:org,lotId:'l2',productId:'p1',siteId:'s2'}
 ]
})

test('view_inventory is a canonical permission and legacy Inventory role can enter its own module',()=>{
 assert.equal(PERMISSIONS.includes('view_inventory'),true)
 assert.equal(ROLE_PERMISSIONS.Inventario.includes('view_inventory'),true)
 assert.equal(ROLE_PERMISSIONS.Inventario.includes('manage_inventory'),true)
})

test('site-scoped membership sees only Lot and Movement evidence from the active authorized site',()=>{
 const state=baseState()
 const access=inventoryUiAccess(state)
 assert.equal(access.canView,true)
 assert.equal(access.canManage,false)
 assert.equal(access.canManageProduct,false)
 const scoped=scopeInventoryUiState(state)
 assert.deepEqual(scoped.sites.map(x=>x.id),['s1'])
 assert.deepEqual(scoped.inventoryLots.map(x=>x.id),['l1'])
 assert.deepEqual(scoped.inventoryMovements.map(x=>x.id),['mv1'])
 assert.deepEqual(scoped.products.map(x=>x.id),['p1'])
})

test('membership for another site cannot read inventory through an unauthorized active context',()=>{
 const state=baseState({siteId:'s2',membershipSites:['s1']})
 const access=inventoryUiAccess(state)
 assert.equal(access.canView,false)
 assert.equal(access.canManage,false)
 assert.equal(access.canManageProduct,false)
 const scoped=scopeInventoryUiState(state)
 assert.deepEqual(scoped.products,[])
 assert.deepEqual(scoped.inventoryLots,[])
 assert.deepEqual(scoped.inventoryMovements,[])
 assert.deepEqual(scoped.sites,[])
})

test('site manage permission can operate Lots and Movements but cannot create organization-wide Product',()=>{
 const access=inventoryUiAccess(baseState({permissions:['view_inventory','manage_inventory'],membershipSites:['s1']}))
 assert.equal(access.canManage,true)
 assert.equal(access.canManageProduct,false)
})

test('organization-wide manage permission can create Product and operate the active site',()=>{
 const access=inventoryUiAccess(baseState({permissions:['view_inventory','manage_inventory'],membershipSites:[]}))
 assert.equal(access.canView,true)
 assert.equal(access.canManage,true)
 assert.equal(access.canManageProduct,true)
})

test('Inventory pages consume explicit access authority rather than exposing unconditional write forms',async()=>{
 const inventory=await readFile(new URL('../src/pages/InventoryPage.jsx',import.meta.url),'utf8')
 const movements=await readFile(new URL('../src/pages/InventoryMovementsPage.jsx',import.meta.url),'utf8')
 const store=await readFile(new URL('../src/services/inventoryCommandStore.js',import.meta.url),'utf8')
 assert.match(inventory,/state:inventory,access,execute/)
 assert.match(inventory,/access\.canManageProduct\?/)
 assert.match(inventory,/access\.canManage\?/)
 assert.match(movements,/state,access,execute/)
 assert.match(movements,/access\.canManage\?/)
 assert.match(store,/scopeInventoryUiState\(store\.state\)/)
 assert.match(store,/CREATE_PRODUCT\?currentAccess\.canManageProduct:currentAccess\.canManage/)
})
