import test from'node:test'
import assert from'node:assert/strict'
import{inventoryRecordOrganizationId,inventoryRecordsForOrganization}from'../src/domain/inventoryTenancy.js'

const base={
 currentContext:{companyId:'org-a'},
 companies:[{id:'org-a'},{id:'org-b'}],
 sites:[
  {id:'site-a',organizationId:'org-a'},
  {id:'site-b',organizationId:'org-b'}
 ],
 products:[{id:'p1',organizationId:'org-a',name:'Producto A'}]
}

test('InventoryLot falla cerrado si organizationId explícito contradice la sede',()=>{
 const lot={id:'l1',organizationId:'org-a',productId:'p1',siteId:'site-b'}
 const state={...base,inventoryLots:[lot],inventoryMovements:[]}
 assert.equal(inventoryRecordOrganizationId(state,'inventoryLots',lot),'')
 assert.deepEqual(inventoryRecordsForOrganization(state,'inventoryLots','org-a'),[])
})

test('InventoryMovement tampoco puede heredar una cadena cuyo Lot contradice sede y tenant',()=>{
 const lot={id:'l1',organizationId:'org-a',productId:'p1',siteId:'site-b'}
 const movement={id:'m1',organizationId:'org-a',productId:'p1',lotId:'l1',siteId:'site-b'}
 const state={...base,inventoryLots:[lot],inventoryMovements:[movement]}
 assert.equal(inventoryRecordOrganizationId(state,'inventoryLots',lot),'')
 assert.equal(inventoryRecordOrganizationId(state,'inventoryMovements',movement),'')
})

test('ownership explícito consistente con la sede conserva causalidad válida',()=>{
 const lot={id:'l1',organizationId:'org-a',productId:'p1',siteId:'site-a'}
 const movement={id:'m1',organizationId:'org-a',productId:'p1',lotId:'l1',siteId:'site-a'}
 const state={...base,inventoryLots:[lot],inventoryMovements:[movement]}
 assert.equal(inventoryRecordOrganizationId(state,'inventoryLots',lot),'org-a')
 assert.equal(inventoryRecordOrganizationId(state,'inventoryMovements',movement),'org-a')
})
