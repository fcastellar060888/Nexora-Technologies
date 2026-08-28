import test from'node:test'
import assert from'node:assert/strict'
import{SYNCABLE_COLLECTIONS,collectionChanges,enqueueChanges,applyRemoteRecords}from'../src/services/syncEngine.js'

const tenant='org-a'
const movement={
 id:'mov-1',organizationId:tenant,lotId:'lot-1',productId:'product-1',type:'Consumo',quantity:2,signedQuantity:-2,balanceBefore:10,balanceAfter:8,ledgerSequence:1,previousMovementId:'',date:'2026-08-27'
}
const receipt=(overrides={})=>({id:'cmd-1',commandId:'cmd-1',organizationId:tenant,signature:'sig-1',operation:'CREATE_LOT',aggregateId:'lot-1',occurredAt:'2026-08-27T20:00:00.000Z',...overrides})
const remote=(collection,recordId,payload,version=1)=>({companyId:tenant,collection,recordId,version,updatedAt:'2026-08-27T21:00:00.000Z',payload})

test('inventoryMovements cannot be deleted through outbound sync',()=>{
 const changes=collectionChanges({inventoryMovements:[movement]},{inventoryMovements:[]},['inventoryMovements'])
 assert.equal(changes.length,1)
 assert.equal(changes[0].operation,'delete')
 assert.throws(
  ()=>enqueueChanges({syncQueue:[]},changes,{companyId:tenant,userId:'u1',deviceId:'d1'}),
  /inventoryMovements es append-only y no admite delete de sync/
 )
})

test('remote tombstones cannot erase inventory ledger evidence',()=>{
 const state={currentContext:{companyId:tenant},inventoryMovements:[movement]}
 const records=[{companyId:tenant,collection:'inventoryMovements',recordId:movement.id,deletedAt:'2026-08-27T18:00:00.000Z'}]
 assert.throws(
  ()=>applyRemoteRecords(state,records,{companyId:tenant}),
  /inventoryMovements es append-only y no admite tombstones remotos/
 )
 assert.deepEqual(state.inventoryMovements,[movement])
})

test('normal tenant-owned inventory movement upserts remain syncable',()=>{
 const changes=collectionChanges({inventoryMovements:[]},{inventoryMovements:[movement]},['inventoryMovements'])
 const next=enqueueChanges({syncQueue:[]},changes,{companyId:tenant,userId:'u1',deviceId:'d1'})
 assert.equal(next.syncQueue.length,1)
 assert.equal(next.syncQueue[0].collection,'inventoryMovements')
 assert.equal(next.syncQueue[0].operation,'upsert')
 assert.equal(next.syncQueue[0].companyId,tenant)
})

test('inventory command receipts are durable sync records and remain append-only',()=>{
 assert.equal(SYNCABLE_COLLECTIONS.includes('inventoryCommandReceipts'),true)
 const changes=collectionChanges({inventoryCommandReceipts:[]},{inventoryCommandReceipts:[receipt()]},['inventoryCommandReceipts'])
 const next=enqueueChanges({syncQueue:[]},changes,{companyId:tenant,userId:'u1',deviceId:'d1'})
 assert.equal(next.syncQueue.length,1)
 assert.equal(next.syncQueue[0].collection,'inventoryCommandReceipts')
 assert.equal(next.syncQueue[0].payload.commandId,'cmd-1')
 const deletes=collectionChanges({inventoryCommandReceipts:[receipt()]},{inventoryCommandReceipts:[]},['inventoryCommandReceipts'])
 assert.throws(()=>enqueueChanges({syncQueue:[]},deletes,{companyId:tenant}),/inventoryCommandReceipts es append-only/)
})

test('inventory command receipt hydrates idempotently after restart and preserves foreign homonyms',()=>{
 const foreign=receipt({organizationId:'org-b',signature:'sig-b',aggregateId:'lot-b'})
 const state={currentContext:{companyId:tenant},inventoryCommandReceipts:[foreign]}
 const records=[{companyId:tenant,collection:'inventoryCommandReceipts',recordId:'cmd-1',version:3,updatedAt:'2026-08-27T21:00:00.000Z',payload:receipt()}]
 const hydrated=applyRemoteRecords(state,records,{companyId:tenant})
 assert.equal(hydrated.inventoryCommandReceipts.length,2)
 assert.equal(hydrated.inventoryCommandReceipts.find(item=>item.organizationId===tenant).signature,'sig-1')
 assert.equal(hydrated.inventoryCommandReceipts.find(item=>item.organizationId==='org-b').signature,'sig-b')
 const replayed=applyRemoteRecords(hydrated,records,{companyId:tenant})
 assert.equal(replayed.inventoryCommandReceipts.length,2)
})

test('remote inventory receipt contradiction and tombstone fail closed',()=>{
 const state={currentContext:{companyId:tenant},inventoryCommandReceipts:[receipt()]}
 const hostile=[{companyId:tenant,collection:'inventoryCommandReceipts',recordId:'cmd-1',version:4,payload:receipt({signature:'sig-hostile'})}]
 assert.throws(()=>applyRemoteRecords(state,hostile,{companyId:tenant}),/contradice la firma durable local/)
 const tombstone=[{companyId:tenant,collection:'inventoryCommandReceipts',recordId:'cmd-1',deletedAt:'2026-08-27T22:00:00.000Z'}]
 assert.throws(()=>applyRemoteRecords(state,tombstone,{companyId:tenant}),/append-only/)
})

test('sync hydration validates Product -> Lot -> Movement causality even when remote rows arrive out of order',()=>{
 const state={currentContext:{companyId:tenant},sites:[{id:'s1',organizationId:tenant}],products:[],inventoryLots:[],inventoryMovements:[]}
 const rows=[
  remote('inventoryMovements','m1',{id:'m1',organizationId:tenant,lotId:'l1',productId:'p1'}),
  remote('inventoryLots','l1',{id:'l1',organizationId:tenant,productId:'p1',siteId:'s1'}),
  remote('products','p1',{id:'p1',organizationId:tenant})
 ]
 const next=applyRemoteRecords(state,rows,{companyId:tenant})
 assert.equal(next.products.length,1)
 assert.equal(next.inventoryLots.length,1)
 assert.equal(next.inventoryMovements.length,1)
})

test('sync hydration rejects Lot whose Product exists only in another tenant',()=>{
 const state={currentContext:{companyId:tenant},sites:[{id:'s1',organizationId:tenant}],products:[{id:'p1',organizationId:'org-b'}],inventoryLots:[],inventoryMovements:[]}
 const rows=[remote('inventoryLots','l1',{id:'l1',organizationId:tenant,productId:'p1',siteId:'s1'})]
 assert.throws(()=>applyRemoteRecords(state,rows,{companyId:tenant}),/causalidad tenant-aware/)
})

test('sync hydration rejects Movement that contradicts Lot -> Product chain',()=>{
 const state={currentContext:{companyId:tenant},sites:[{id:'s1',organizationId:tenant}],products:[{id:'p1',organizationId:tenant},{id:'p2',organizationId:tenant}],inventoryLots:[{id:'l1',organizationId:tenant,productId:'p1',siteId:'s1'}],inventoryMovements:[]}
 const rows=[remote('inventoryMovements','m1',{id:'m1',organizationId:tenant,lotId:'l1',productId:'p2'})]
 assert.throws(()=>applyRemoteRecords(state,rows,{companyId:tenant}),/causalidad tenant-aware/)
})
