import test from'node:test'
import assert from'node:assert/strict'
import{createInventoryLot,transactInventory}from'../src/domain/inventory.js'

const base=()=>({
 currentContext:{companyId:'org-a',siteId:'site-a'},companies:[{id:'org-a'},{id:'org-b'}],
 sites:[{id:'site-a',organizationId:'org-a'},{id:'site-b',organizationId:'org-b'}],
 products:[{id:'product-shared',organizationId:'org-a',name:'A'},{id:'product-shared',organizationId:'org-b',name:'B'}],
 inventoryLots:[{id:'lot-shared',organizationId:'org-a',productId:'product-shared',siteId:'site-a',lotNumber:'A-1',quantity:10},{id:'lot-shared',organizationId:'org-b',productId:'product-shared',siteId:'site-b',lotNumber:'B-1',quantity:50}],inventoryMovements:[]
})

test('F001 inventario: homónimo cross-tenant solo muta el lote de la empresa activa',()=>{
 const next=transactInventory(base(),{id:'move-a',lotId:'lot-shared',type:'Salida',quantity:3,createdAt:'2026-08-26T03:30:00.000Z'})
 assert.equal(next.inventoryLots.find(item=>item.organizationId==='org-a').quantity,7)
 assert.equal(next.inventoryLots.find(item=>item.organizationId==='org-b').quantity,50)
 assert.equal(next.inventoryMovements.length,1)
 assert.equal(next.inventoryMovements[0].organizationId,'org-a')
 assert.equal(next.inventoryMovements[0].siteId,'site-a')
})

test('F001 inventario: lote nuevo congela organizationId y no puede apuntar a sede extranjera',()=>{
 const state=base()
 assert.throws(()=>createInventoryLot(state,{id:'lot-new',productId:'product-shared',siteId:'site-b',lotNumber:'X'}),/sede.*empresa activa|no pertenece/i)
 const next=createInventoryLot(state,{id:'lot-new',productId:'product-shared',siteId:'site-a',lotNumber:'A-2',quantity:4,createdAt:'2026-08-26T03:31:00.000Z'})
 const lot=next.inventoryLots.find(item=>item.id==='lot-new')
 assert.equal(lot.organizationId,'org-a')
 assert.equal(lot.quantity,4)
 const opening=next.inventoryMovements.find(item=>item.lotId==='lot-new')
 assert.equal(opening.organizationId,'org-a')
 assert.equal(opening.balanceAfter,4)
})

test('F001 inventario: organizationId hostil del cliente falla cerrado',()=>{
 assert.throws(()=>createInventoryLot(base(),{id:'lot-new',organizationId:'org-b',productId:'product-shared',siteId:'site-a',lotNumber:'A-2'}),/otra empresa/i)
})

test('F001 inventario: duplicado same-tenant de identidad de lote falla cerrado',()=>{
 const state=base();state.inventoryLots.push({...state.inventoryLots[0]})
 assert.throws(()=>transactInventory(state,{lotId:'lot-shared',type:'Salida',quantity:1}),/identidad duplicada/i)
})
