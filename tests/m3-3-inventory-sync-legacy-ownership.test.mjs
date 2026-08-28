import test from'node:test'
import assert from'node:assert/strict'
import{enqueueChanges,applyRemoteRecords}from'../src/services/syncEngine.js'

const tenant='org-a'

test('outbound legacy inventory record without organizationId fails closed before sync',()=>{
 const legacy={id:'p1',name:'Legacy Product'}
 const changes=[{collection:'products',recordId:'p1',operation:'upsert',payload:legacy,previousPayload:null}]
 assert.throws(
  ()=>enqueueChanges({syncQueue:[],products:[legacy],inventoryLots:[],inventoryMovements:[]},changes,{companyId:tenant}),
  /products legacy sin organizationId debe migrarse antes de sync/
 )
})

test('remote inventory upsert requires explicit organizationId in payload',()=>{
 const state={currentContext:{companyId:tenant},products:[],inventoryLots:[],inventoryMovements:[]}
 const rows=[{companyId:tenant,collection:'products',recordId:'p1',version:1,payload:{id:'p1',name:'ownerless'}}]
 assert.throws(()=>applyRemoteRecords(state,rows,{companyId:tenant}),/products remoto requiere organizationId explícito/)
})

test('remote inventory row cannot replace an ownerless legacy homonym by id',()=>{
 const legacy={id:'p1',name:'legacy-ownerless'}
 const state={currentContext:{companyId:tenant},products:[legacy],inventoryLots:[],inventoryMovements:[]}
 const rows=[{companyId:tenant,collection:'products',recordId:'p1',version:2,payload:{id:'p1',organizationId:tenant,name:'tenant-owned'}}]
 assert.throws(()=>applyRemoteRecords(state,rows,{companyId:tenant}),/homónimo legacy sin organizationId/)
 assert.deepEqual(state.products,[legacy])
})

test('remote tombstone cannot erase an ownerless legacy homonym by id',()=>{
 const legacy={id:'p1',name:'legacy-ownerless'}
 const state={currentContext:{companyId:tenant},products:[legacy],inventoryLots:[],inventoryMovements:[]}
 const rows=[{companyId:tenant,collection:'products',recordId:'p1',deletedAt:'2026-08-28T01:00:00.000Z'}]
 assert.throws(()=>applyRemoteRecords(state,rows,{companyId:tenant}),/homónimo legacy sin organizationId/)
 assert.deepEqual(state.products,[legacy])
})
