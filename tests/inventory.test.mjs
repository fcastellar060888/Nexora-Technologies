import test from 'node:test'
import assert from 'node:assert/strict'
import { createInventoryLot, movementSign, transactInventory } from '../src/domain/inventory.js'

const product={id:'p1',organizationId:'org1',companyId:'org1',unit:'mL',cost:1}
const site={id:'s1',organizationId:'org1',companyId:'org1'}
const base={currentContext:{companyId:'org1',siteId:'s1'},companies:[{id:'org1'}],sites:[site],products:[product],inventoryLots:[],inventoryMovements:[]}
const lot=overrides=>({id:'l1',organizationId:'org1',companyId:'org1',productId:'p1',siteId:'s1',unit:'mL',lotNumber:'A-1',quantity:5,...overrides})

test('movement types have explicit signs',()=>{
 assert.equal(movementSign('Entrada'),1)
 assert.equal(movementSign('Salida'),-1)
 assert.throws(()=>movementSign('Otro'),/no soportado/)
})

test('opening stock creates a kardex movement',()=>{
 const next=createInventoryLot(base,{id:'l1',productId:'p1',siteId:'s1',lotNumber:'A-1',quantity:10,minimum:2,createdAt:'2026-07-30T00:00:00.000Z'})
 assert.equal(next.inventoryLots[0].quantity,10)
 assert.equal(next.inventoryMovements.length,1)
 assert.equal(next.inventoryMovements[0].type,'Saldo inicial')
 assert.equal(next.inventoryMovements[0].balanceBefore,0)
 assert.equal(next.inventoryMovements[0].balanceAfter,10)
})

test('negative stock is rejected',()=>{
 const state={...base,inventoryLots:[lot()]}
 assert.throws(()=>transactInventory(state,{lotId:'l1',type:'Salida',quantity:6}),/supera la existencia/)
})

test('duplicate lots are rejected by product and site',()=>{
 const state={...base,inventoryLots:[lot({lotNumber:'ABC',quantity:0})]}
 assert.throws(()=>createInventoryLot(state,{productId:'p1',siteId:'s1',lotNumber:' abc ',quantity:0}),/Ya existe/)
})

test('transactions preserve traceability fields',()=>{
 const state={...base,inventoryLots:[lot()]}
 const next=transactInventory(state,{id:'m1',lotId:'l1',type:'Consumo',quantity:2,sourceType:'Treatment',sourceId:'t1',responsible:'Ana',createdAt:'2026-07-30T00:00:00.000Z'})
 assert.equal(next.inventoryLots[0].quantity,3)
 assert.equal(next.inventoryMovements[0].sourceType,'LegacyInventoryBootstrap')
 assert.equal(next.inventoryMovements[0].sourceId,'l1')
 assert.equal(next.inventoryMovements[1].sourceType,'Treatment')
 assert.equal(next.inventoryMovements[1].sourceId,'t1')
 assert.equal(next.inventoryMovements[1].balanceBefore,5)
 assert.equal(next.inventoryMovements[1].balanceAfter,3)
})
