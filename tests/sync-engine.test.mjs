import test from'node:test'
import assert from'node:assert/strict'
import{collectionChanges,compactQueue,resolveConflict,applyRemoteRecords}from'../src/services/syncEngine.js'

test('detecta altas, cambios y eliminaciones por colección',()=>{
 const prev={products:[{id:'a',name:'A'},{id:'b',name:'B'}]}
 const next={products:[{id:'a',name:'A2'},{id:'c',name:'C'}]}
 const changes=collectionChanges(prev,next,['products'])
 assert.deepEqual(changes.map(x=>[x.recordId,x.operation]).sort(),[['a','upsert'],['b','delete'],['c','upsert']])
 assert.deepEqual(changes.find(x=>x.recordId==='a').previousPayload,{id:'a',name:'A'})
 assert.deepEqual(changes.find(x=>x.recordId==='b').previousPayload,{id:'b',name:'B'})
 assert.equal(changes.find(x=>x.recordId==='c').previousPayload,null)
})

test('compacta múltiples mutaciones conservando la última',()=>{
 const queue=[
  {id:'1',companyId:'o',collection:'products',recordId:'a',status:'pending'},
  {id:'2',companyId:'o',collection:'products',recordId:'a',status:'pending'},
  {id:'3',companyId:'o',collection:'products',recordId:'b',status:'completed'}
 ]
 assert.deepEqual(compactQueue(queue).map(x=>x.id),['2'])
})

test('resuelve conflicto por registro más reciente',()=>{
 const result=resolveConflict({
  local:{id:'a',updatedAt:'2026-01-01T00:00:00Z'},
  remote:{id:'a',updatedAt:'2026-01-02T00:00:00Z'},
  strategy:'newest'
 })
 assert.equal(result.winner,'remote')
})

test('aplica registros remotos y borrados lógicos',()=>{
 const companyId='company-a'
 const state={currentContext:{companyId},products:[{id:'a',organizationId:companyId,name:'Viejo'},{id:'b',organizationId:companyId,name:'B'}]}
 const next=applyRemoteRecords(state,[
  {companyId,collection:'products',recordId:'a',payload:{organizationId:companyId,name:'Nuevo'},version:3,updatedAt:'2026-01-01T00:00:00Z'},
  {companyId,collection:'products',recordId:'b',deletedAt:'2026-01-01T00:00:00Z'}
 ],{companyId})
 assert.equal(next.products.length,1)
 assert.equal(next.products[0].name,'Nuevo')
 assert.equal(next.products[0]._syncVersion,3)
})
