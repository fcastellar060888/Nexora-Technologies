import test from 'node:test'
import assert from 'node:assert/strict'

import { transactInventory } from '../src/domain/inventory.js'

test('F001: inventory transaction mutates only the scoped tenant lot when raw IDs collide', () => {
 const state={
  inventoryLots:[
   {id:'lot-shared',organizationId:'org-b',siteId:'site-b',productId:'product-b',quantity:90},
   {id:'lot-shared',organizationId:'org-a',siteId:'site-a',productId:'product-a',quantity:20}
  ],
  inventoryMovements:[]
 }

 const next=transactInventory(state,{
  organizationId:'org-a',
  siteId:'site-a',
  lotId:'lot-shared',
  type:'Salida',
  quantity:5,
  id:'movement-a',
  createdAt:'2026-08-18T12:00:00.000Z'
 })

 assert.equal(next.inventoryLots[0].quantity,90,'foreign homonymous lot must remain untouched')
 assert.equal(next.inventoryLots[1].quantity,15,'authorized tenant lot must receive the movement')
 assert.deepEqual(next.inventoryMovements.map(({organizationId,siteId,productId,lotId})=>({organizationId,siteId,productId,lotId})),[
  {organizationId:'org-a',siteId:'site-a',productId:'product-a',lotId:'lot-shared'}
 ])
})

test('F001: inventory transaction rejects a lot that only belongs to another organization', () => {
 const state={
  inventoryLots:[
   {id:'lot-foreign',organizationId:'org-b',siteId:'site-b',productId:'product-b',quantity:20}
  ],
  inventoryMovements:[]
 }

 assert.throws(()=>transactInventory(state,{
  organizationId:'org-a',
  siteId:'site-a',
  lotId:'lot-foreign',
  type:'Salida',
  quantity:1
 }),/organización|empresa|lote de inventario válido/i)
})

test('F001: inventory transaction fails closed when the scoped lot identity is ambiguous', () => {
 const state={
  inventoryLots:[
   {id:'lot-duplicate',organizationId:'org-a',siteId:'site-a',productId:'product-a',quantity:20},
   {id:'lot-duplicate',organizationId:'org-a',siteId:'site-a',productId:'product-a',quantity:30}
  ],
  inventoryMovements:[]
 }

 assert.throws(()=>transactInventory(state,{
  organizationId:'org-a',
  siteId:'site-a',
  lotId:'lot-duplicate',
  type:'Salida',
  quantity:1
 }),/ambigu/i)
})
