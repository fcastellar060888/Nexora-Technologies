import test from'node:test'
import assert from'node:assert/strict'
import{inventoryRecordOrganizationId,inventoryRecordsForOrganization,scopeInventoryState,mergeInventoryState}from'../src/domain/inventoryTenancy.js'

const state=()=>({
 currentContext:{companyId:'org-a'},companies:[{id:'org-a'},{id:'org-b'}],
 sites:[{id:'site-a',organizationId:'org-a'},{id:'site-b',organizationId:'org-b'}],
 products:[{id:'product-shared',organizationId:'org-a',name:'A'},{id:'product-shared',organizationId:'org-b',name:'B'}],
 inventoryLots:[{id:'lot-shared',organizationId:'org-a',siteId:'site-a',productId:'product-shared',quantity:10},{id:'lot-shared',organizationId:'org-b',siteId:'site-b',productId:'product-shared',quantity:20}],
 inventoryMovements:[{id:'move-shared',organizationId:'org-a',siteId:'site-a',lotId:'lot-shared',productId:'product-shared',quantity:1},{id:'move-shared',organizationId:'org-b',siteId:'site-b',lotId:'lot-shared',productId:'product-shared',quantity:2}]
})

test('F002 scope: homónimos cross-tenant se aíslan en Product/Lot/Movement',()=>{
 const input=state(),scoped=scopeInventoryState(input,'org-a')
 assert.equal(scoped.products.length,1);assert.equal(scoped.products[0].name,'A')
 assert.equal(scoped.inventoryLots.length,1);assert.equal(scoped.inventoryLots[0].quantity,10)
 assert.equal(scoped.inventoryMovements.length,1);assert.equal(scoped.inventoryMovements[0].quantity,1)
 assert.deepEqual(scoped.sites.map(item=>item.id),['site-a'])
})

test('F002 causality: Lot explícitamente org-a que referencia Product solo org-b queda sin ownership válido',()=>{
 const input=state();input.products=input.products.filter(item=>item.organizationId==='org-b')
 assert.equal(inventoryRecordOrganizationId(input,'inventoryLots',input.inventoryLots[0]),'')
 assert.deepEqual(inventoryRecordsForOrganization(input,'inventoryLots','org-a'),[])
})

test('F002 causality: Movement con evidencia causal contradictoria queda fuera del scope',()=>{
 const input=state(),movement=input.inventoryMovements[0];movement.productId='foreign-only';input.products.push({id:'foreign-only',organizationId:'org-b'})
 assert.equal(inventoryRecordOrganizationId(input,'inventoryMovements',movement),'')
})

test('F002 merge: reemplaza solo partición activa y preserva homónimos extranjeros',()=>{
 const current=state(),incoming=scopeInventoryState(current,'org-a');incoming.inventoryLots=[{...incoming.inventoryLots[0],quantity:7}]
 const merged=mergeInventoryState(current,incoming,'org-a')
 assert.equal(merged.inventoryLots.find(item=>item.organizationId==='org-a').quantity,7)
 assert.equal(merged.inventoryLots.find(item=>item.organizationId==='org-b').quantity,20)
 assert.equal(merged.products.filter(item=>item.id==='product-shared').length,2)
})

test('F002 merge: duplicado same-tenant falla cerrado',()=>{
 const current=state(),incoming=scopeInventoryState(current,'org-a');incoming.inventoryLots=[incoming.inventoryLots[0],{...incoming.inventoryLots[0]}]
 assert.throws(()=>mergeInventoryState(current,incoming,'org-a'),/identidad duplicada/i)
})
