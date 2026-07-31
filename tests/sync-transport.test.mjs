import test from'node:test'
import assert from'node:assert/strict'
import{eligibleQueue,purgeCompleted,retryDelay}from'../src/services/syncTransport.js'

test('aplica backoff exponencial con límite',()=>{
 assert.equal(retryDelay(0),1000)
 assert.equal(retryDelay(3),8000)
 assert.equal(retryDelay(20),60000)
})

test('selecciona únicamente mutaciones elegibles',()=>{
 const now=Date.now()
 const queue=[
  {id:'a',companyId:'c',collection:'products',recordId:'1',status:'pending',attempts:0},
  {id:'b',companyId:'c',collection:'products',recordId:'2',status:'failed',attempts:6},
  {id:'c',companyId:'c',collection:'products',recordId:'3',status:'pending',attempts:1,nextAttemptAt:new Date(now+60000).toISOString()},
  {id:'d',companyId:'c',collection:'products',recordId:'4',status:'conflict',attempts:0}
 ]
 assert.deepEqual(eligibleQueue(queue,now).map(x=>x.id),['a'])
})

test('conserva un historial limitado de mutaciones completadas',()=>{
 const state={syncQueue:[
  {id:'a',status:'completed',updatedAt:'2026-01-03'},
  {id:'b',status:'completed',updatedAt:'2026-01-02'},
  {id:'c',status:'completed',updatedAt:'2026-01-01'},
  {id:'d',status:'pending'}
 ]}
 assert.deepEqual(purgeCompleted(state,2).syncQueue.map(x=>x.id).sort(),['a','b','d'])
})
