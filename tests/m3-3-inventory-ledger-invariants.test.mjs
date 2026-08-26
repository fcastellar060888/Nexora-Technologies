import test from'node:test'
import assert from'node:assert/strict'
import{assertInventoryLotMatchesLedger,inventoryLedgerForLot,verifyInventoryLedger}from'../src/domain/inventoryLedger.js'

const movement=(id,organizationId,before,signed,after,createdAt)=>({id,organizationId,lotId:'lot-shared',productId:'product-shared',siteId:`site-${organizationId}`,type:signed>=0?'Entrada':'Salida',quantity:Math.abs(signed),signedQuantity:signed,balanceBefore:before,balanceAfter:after,createdAt})
const base=()=>({inventoryLots:[{id:'lot-shared',organizationId:'org-a',quantity:7},{id:'lot-shared',organizationId:'org-b',quantity:50}],inventoryMovements:[movement('a1','org-a',0,10,10,'2026-08-26T08:10:00.000Z'),movement('a2','org-a',10,-3,7,'2026-08-26T08:11:00.000Z'),movement('b1','org-b',0,50,50,'2026-08-26T08:10:00.000Z')]})

test('F004 ledger: deriva saldo exclusivamente de movimientos del tenant y lote causales',()=>{
 const state=base(),verification=verifyInventoryLedger(state,{organizationId:'org-a',lotId:'lot-shared'})
 assert.equal(verification.balance,7);assert.equal(verification.movementCount,2)
 assert.deepEqual(inventoryLedgerForLot(state,{organizationId:'org-a',lotId:'lot-shared'}).map(item=>item.id),['a1','a2'])
})

test('F004 ledger: discontinuidad balanceBefore falla cerrado',()=>{
 const state=base();state.inventoryMovements[1]={...state.inventoryMovements[1],balanceBefore:9}
 assert.throws(()=>verifyInventoryLedger(state,{organizationId:'org-a',lotId:'lot-shared'}),/continuidad|balanceBefore/i)
})

test('F004 ledger: balanceAfter adulterado falla cerrado',()=>{
 const state=base();state.inventoryMovements[1]={...state.inventoryMovements[1],balanceAfter:8}
 assert.throws(()=>verifyInventoryLedger(state,{organizationId:'org-a',lotId:'lot-shared'}),/balanceAfter inconsistente/i)
})

test('F004 ledger: saldo materializado no puede contradecir kardex',()=>{
 const state=base(),lot=state.inventoryLots[0];assert.equal(assertInventoryLotMatchesLedger(state,lot).balance,7)
 assert.throws(()=>assertInventoryLotMatchesLedger(state,{...lot,quantity:99}),/contradice.*kardex/i)
})

test('F004 ledger: movimiento duplicado same-tenant falla cerrado y homónimo cross-tenant no contamina',()=>{
 const state=base();state.inventoryMovements.push({...state.inventoryMovements[0]})
 assert.throws(()=>verifyInventoryLedger(state,{organizationId:'org-a',lotId:'lot-shared'}),/movimiento duplicado/i)
 const clean=base();assert.equal(verifyInventoryLedger(clean,{organizationId:'org-b',lotId:'lot-shared'}).balance,50)
})
