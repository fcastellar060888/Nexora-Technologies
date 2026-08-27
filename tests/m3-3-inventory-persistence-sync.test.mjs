import test from'node:test'
import assert from'node:assert/strict'
import{collectionChanges,enqueueChanges,applyRemoteRecords}from'../src/services/syncEngine.js'

const tenant='org-a'
const movement={
 id:'mov-1',organizationId:tenant,lotId:'lot-1',productId:'product-1',type:'Consumo',quantity:2,signedQuantity:-2,balanceBefore:10,balanceAfter:8,ledgerSequence:1,previousMovementId:'',date:'2026-08-27'
}

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
