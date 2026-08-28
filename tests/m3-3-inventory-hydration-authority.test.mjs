import test from'node:test'
import assert from'node:assert/strict'
import{stageInventoryHydration}from'../src/domain/inventoryHydrationAuthority.js'

const base={products:[],inventoryLots:[],inventoryMovements:[],sites:[{id:'s1',organizationId:'org-a'}]}
const row=(collection,record)=>({collection,record})

test('hydrates Product -> Lot -> Movement causally even when rows arrive out of order',()=>{
 const records=[
  row('inventoryMovements',{id:'m1',organizationId:'org-a',lotId:'l1',productId:'p1'}),
  row('inventoryLots',{id:'l1',organizationId:'org-a',productId:'p1',siteId:'s1'}),
  row('products',{id:'p1',organizationId:'org-a'})
 ]
 const next=stageInventoryHydration(base,records,{organizationId:'org-a'})
 assert.equal(next.inventoryMovements.length,1)
})

test('rejects a Lot whose Product only exists in another tenant',()=>{
 const state={...base,products:[{id:'p1',organizationId:'org-b'}]}
 assert.throws(()=>stageInventoryHydration(state,[row('inventoryLots',{id:'l1',organizationId:'org-a',productId:'p1',siteId:'s1'})],{organizationId:'org-a'}),/causalidad tenant-aware/)
})

test('rejects a Movement whose Lot and Product do not form one causal chain',()=>{
 const state={...base,products:[{id:'p1',organizationId:'org-a'},{id:'p2',organizationId:'org-a'}],inventoryLots:[{id:'l1',organizationId:'org-a',productId:'p1',siteId:'s1'}]}
 assert.throws(()=>stageInventoryHydration(state,[row('inventoryMovements',{id:'m1',organizationId:'org-a',lotId:'l1',productId:'p2'})],{organizationId:'org-a'}),/causalidad tenant-aware/)
})

test('preserves a homonymous record owned by another tenant',()=>{
 const state={...base,products:[{id:'p1',organizationId:'org-b'}]}
 const next=stageInventoryHydration(state,[row('products',{id:'p1',organizationId:'org-a'})],{organizationId:'org-a'})
 assert.equal(next.products.length,2)
 assert.deepEqual(new Set(next.products.map(x=>x.organizationId)),new Set(['org-a','org-b']))
})

test('fails closed on duplicate same-tenant identity before hydration',()=>{
 const state={...base,products:[{id:'p1',organizationId:'org-a'},{id:'p1',organizationId:'org-a'}]}
 assert.throws(()=>stageInventoryHydration(state,[row('products',{id:'p1',organizationId:'org-a'})],{organizationId:'org-a'}),/duplicada/)
})
