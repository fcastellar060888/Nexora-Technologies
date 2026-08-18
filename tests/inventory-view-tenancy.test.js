import test from 'node:test'
import assert from 'node:assert/strict'

import {inventoryViewForActiveOrganization} from '../src/domain/inventory.js'

const multiTenantState={
 currentContext:{companyId:'org-a'},
 companies:[{id:'org-a'},{id:'org-b'}],
 sites:[
  {id:'site-shared',organizationId:'org-b',name:'Foreign Site'},
  {id:'site-shared',organizationId:'org-a',name:'Active Site'},
  {id:'site-ownerless',name:'Legacy Site'}
 ],
 products:[
  {id:'product-shared',organizationId:'org-b',name:'Foreign Product'},
  {id:'product-shared',organizationId:'org-a',name:'Active Product'},
  {id:'product-ownerless',name:'Legacy Product'}
 ],
 inventoryLots:[
  {id:'lot-shared',organizationId:'org-b',siteId:'site-shared',productId:'product-shared',lotNumber:'FOREIGN',quantity:20},
  {id:'lot-shared',organizationId:'org-a',siteId:'site-shared',productId:'product-shared',lotNumber:'ACTIVE',quantity:7},
  {id:'lot-ownerless',siteId:'site-ownerless',productId:'product-ownerless',lotNumber:'LEGACY',quantity:3}
 ],
 inventoryMovements:[
  {id:'move-b',organizationId:'org-b',lotId:'lot-shared',productId:'product-shared',siteId:'site-shared',quantity:2},
  {id:'move-a',organizationId:'org-a',lotId:'lot-shared',productId:'product-shared',siteId:'site-shared',quantity:1},
  {id:'move-ownerless',lotId:'lot-ownerless',productId:'product-ownerless',siteId:'site-ownerless',quantity:1}
 ]
}

test('F005: inventory view exposes only records owned by the active organization even when raw IDs collide',()=>{
 const view=inventoryViewForActiveOrganization(multiTenantState)
 assert.deepEqual(view.products.map(x=>x.name),['Active Product'])
 assert.deepEqual(view.sites.map(x=>x.name),['Active Site'])
 assert.deepEqual(view.lots.map(x=>x.lotNumber),['ACTIVE'])
 assert.deepEqual(view.movements.map(x=>x.id),['move-a'])
})

test('F005: ownerless inventory records fail closed in a multi-company view',()=>{
 const view=inventoryViewForActiveOrganization(multiTenantState)
 assert.equal(view.products.some(x=>x.id==='product-ownerless'),false)
 assert.equal(view.sites.some(x=>x.id==='site-ownerless'),false)
 assert.equal(view.lots.some(x=>x.id==='lot-ownerless'),false)
 assert.equal(view.movements.some(x=>x.id==='move-ownerless'),false)
})

test('F005: legacy ownerless inventory remains visible in an unequivocal single-company installation',()=>{
 const state={
  currentContext:{companyId:'org-a'},
  companies:[{id:'org-a'}],
  sites:[{id:'site-a',name:'Legacy Site'}],
  products:[{id:'product-a',name:'Legacy Product'}],
  inventoryLots:[{id:'lot-a',siteId:'site-a',productId:'product-a',lotNumber:'LEGACY',quantity:2}],
  inventoryMovements:[{id:'move-a',lotId:'lot-a',siteId:'site-a',productId:'product-a',quantity:1}]
 }
 const view=inventoryViewForActiveOrganization(state)
 assert.equal(view.products.length,1)
 assert.equal(view.sites.length,1)
 assert.equal(view.lots.length,1)
 assert.equal(view.movements.length,1)
})
