import test from'node:test'
import assert from'node:assert/strict'
import{createInventoryLot,transactInventory}from'../src/domain/inventory.js'
import{verifyInventoryLedger}from'../src/domain/inventoryLedger.js'

function base(){return{
 currentContext:{companyId:'org-a',siteId:'site-a'},companies:[{id:'org-a'}],
 sites:[{id:'site-a',organizationId:'org-a',companyId:'org-a',name:'A'}],
 products:[{id:'product-a',organizationId:'org-a',siteId:'site-a',name:'Producto A'}],
 inventoryLots:[{id:'lot-a',organizationId:'org-a',productId:'product-a',siteId:'site-a',lotNumber:'LOT-A',quantity:10,createdAt:'2026-08-20T08:00:00.000Z'}],
 inventoryMovements:[]
}}
function movement(overrides={}){return{id:'mov-opening',organizationId:'org-a',lotId:'lot-a',productId:'product-a',siteId:'site-a',type:'Saldo inicial',quantity:10,signedQuantity:10,balanceBefore:0,balanceAfter:10,date:'2026-08-20',createdAt:'2026-08-20T08:00:00.000Z',sourceType:'Test',sourceId:'lot-a',...overrides}}

test('F004 write authority: lote legacy materializa saldo inicial determinista antes del primer movimiento',()=>{
 const state=base(),next=transactInventory(state,{id:'mov-out',lotId:'lot-a',type:'Salida',quantity:3,createdAt:'2026-08-21T08:00:00.000Z'})
 assert.equal(state.inventoryMovements.length,0,'La operación es pura y no muta el estado de entrada')
 assert.equal(next.inventoryMovements.length,2)
 assert.equal(next.inventoryMovements[0].id,'inventory-opening:org-a:lot-a')
 assert.equal(next.inventoryMovements[0].sourceType,'LegacyInventoryBootstrap')
 assert.equal(next.inventoryMovements[1].balanceBefore,10)
 assert.equal(next.inventoryMovements[1].balanceAfter,7)
 assert.equal(next.inventoryLots[0].quantity,7)
 assert.equal(verifyInventoryLedger(next,{organizationId:'org-a',lotId:'lot-a'}).balance,7)
})

test('F004 write authority: saldo materializado adulterado no puede convertirse en autoridad del siguiente movimiento',()=>{
 const state=base();state.inventoryMovements=[movement()];state.inventoryLots[0]={...state.inventoryLots[0],quantity:100}
 assert.throws(()=>transactInventory(state,{id:'mov-out',lotId:'lot-a',type:'Salida',quantity:3,createdAt:'2026-08-21T08:00:00.000Z'}),/contradice su kardex append-only/i)
 assert.equal(state.inventoryLots[0].quantity,100)
 assert.equal(state.inventoryMovements.length,1)
})

test('F004 write authority: movimiento con id duplicado same-tenant falla antes de devolver estado corrupto',()=>{
 const state=base();state.inventoryMovements=[movement()]
 assert.throws(()=>transactInventory(state,{id:'mov-opening',lotId:'lot-a',type:'Entrada',quantity:1,createdAt:'2026-08-21T08:00:00.000Z'}),/movimiento duplicado/i)
 assert.equal(state.inventoryLots[0].quantity,10)
 assert.equal(state.inventoryMovements.length,1)
})

test('F004 write authority: lote nuevo con existencia inicial genera un único movimiento canónico, no bootstrap legacy',()=>{
 const state=base();state.inventoryLots=[]
 const next=createInventoryLot(state,{id:'lot-new',productId:'product-a',siteId:'site-a',lotNumber:'LOT-NEW',quantity:6,createdAt:'2026-08-22T08:00:00.000Z'})
 const rows=next.inventoryMovements.filter(item=>item.lotId==='lot-new')
 assert.equal(rows.length,1)
 assert.equal(rows[0].type,'Saldo inicial')
 assert.notEqual(rows[0].sourceType,'LegacyInventoryBootstrap')
 assert.equal(rows[0].balanceBefore,0)
 assert.equal(rows[0].balanceAfter,6)
 assert.equal(next.inventoryLots.find(item=>item.id==='lot-new').quantity,6)
})

test('F004 write authority: un kardex válido existente determina balanceBefore del siguiente movimiento',()=>{
 const state=base();state.inventoryMovements=[movement()]
 const next=transactInventory(state,{id:'mov-in',lotId:'lot-a',type:'Entrada',quantity:2,createdAt:'2026-08-21T08:00:00.000Z'})
 const row=next.inventoryMovements.find(item=>item.id==='mov-in')
 assert.equal(row.balanceBefore,10)
 assert.equal(row.balanceAfter,12)
 assert.equal(verifyInventoryLedger(next,{organizationId:'org-a',lotId:'lot-a'}).balance,12)
})
