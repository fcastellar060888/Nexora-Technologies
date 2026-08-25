import test from 'node:test'
import assert from 'node:assert/strict'

import {createInventoryLot} from '../src/domain/inventory.js'

const baseState=overrides=>({
 currentContext:{companyId:'org-a'},
 companies:[{id:'org-a'},{id:'org-b'}],
 sites:[
  {id:'site-a',organizationId:'org-a',name:'Site A'},
  {id:'site-b',organizationId:'org-b',name:'Site B'}
 ],
 products:[
  {id:'product-a',organizationId:'org-a',name:'Product A'},
  {id:'product-b',organizationId:'org-b',name:'Product B'}
 ],
 inventoryLots:[],
 inventoryMovements:[],
 ...overrides
})

const lotInput=overrides=>({
 id:'lot-new',
 productId:'product-a',
 siteId:'site-a',
 lotNumber:'LOT-001',
 quantity:0,
 createdAt:'2026-08-18T20:00:00.000Z',
 ...overrides
})

test('F004: lot creation rejects a product owned only by another organization',()=>{
 const state=baseState({})
 assert.throws(()=>createInventoryLot(state,lotInput({productId:'product-b'})),/producto|empresa|organización|ownership/i)
 assert.equal(state.inventoryLots.length,0)
})

test('F004: lot creation rejects a site owned only by another organization',()=>{
 const state=baseState({})
 assert.throws(()=>createInventoryLot(state,lotInput({siteId:'site-b'})),/sede|empresa|organización|ownership/i)
 assert.equal(state.inventoryLots.length,0)
})

test('F004: caller cannot spoof organizationId during lot creation',()=>{
 const state=baseState({})
 assert.throws(()=>createInventoryLot(state,lotInput({organizationId:'org-b'})),/empresa|organización|organizationId|ownership/i)
 assert.equal(state.inventoryLots.length,0)
})

test('F004: lot-number uniqueness is tenant-local when product and site raw IDs collide across tenants',()=>{
 const state=baseState({
  sites:[
   {id:'site-shared',organizationId:'org-b',name:'Foreign Site'},
   {id:'site-shared',organizationId:'org-a',name:'Active Site'}
  ],
  products:[
   {id:'product-shared',organizationId:'org-b',name:'Foreign Product'},
   {id:'product-shared',organizationId:'org-a',name:'Active Product'}
  ],
  inventoryLots:[{
   id:'lot-foreign',organizationId:'org-b',productId:'product-shared',siteId:'site-shared',lotNumber:'LOT-SAME',quantity:8
  }]
 })
 const next=createInventoryLot(state,lotInput({
  id:'lot-active',productId:'product-shared',siteId:'site-shared',lotNumber:'LOT-SAME'
 }))
 assert.equal(next.inventoryLots.length,2)
 assert.equal(next.inventoryLots[0].organizationId,'org-b')
 assert.equal(next.inventoryLots[1].organizationId,'org-a')
})

test('F004: duplicate lot number remains forbidden inside the active tenant and site/product scope',()=>{
 const state=baseState({
  inventoryLots:[{
   id:'lot-existing',organizationId:'org-a',productId:'product-a',siteId:'site-a',lotNumber:' lot-001 ',quantity:2
  }]
 })
 assert.throws(()=>createInventoryLot(state,lotInput({lotNumber:'LOT-001'})),/ya existe|duplicad/i)
})

test('F004: ambiguous duplicate product identity inside the active tenant fails closed',()=>{
 const state=baseState({
  products:[
   {id:'product-a',organizationId:'org-a',name:'A1'},
   {id:'product-a',organizationId:'org-a',name:'A2'}
  ]
 })
 assert.throws(()=>createInventoryLot(state,lotInput({productId:'product-a'})),/producto.*ambigu|duplicad|identidad/i)
})
