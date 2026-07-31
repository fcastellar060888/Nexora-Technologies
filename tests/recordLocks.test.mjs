import test from'node:test'
import assert from'node:assert/strict'
import{activeLocks,lockForDescriptor,recordKey}from'../src/services/recordLocks.js'

test('recordKey isolates route, form and record',()=>{
 assert.equal(recordKey({path:'/mipe/findings',formId:'finding',recordId:'123'}),'/mipe/findings::finding::123')
})

test('lockForDescriptor ignores the current actor and expired locks',()=>{
 const now=Date.now()
 const descriptor={path:'/inventory',formId:'movement',recordId:'A'}
 const locks=[
  {...descriptor,actorId:'self',updatedAt:new Date(now).toISOString()},
  {...descriptor,actorId:'other',actorName:'Ana',updatedAt:new Date(now-1000).toISOString()},
  {...descriptor,actorId:'old',updatedAt:new Date(now-60000).toISOString()}
 ]
 assert.equal(activeLocks(locks,now).length,2)
 assert.equal(lockForDescriptor(locks,descriptor,'self',now)?.actorName,'Ana')
})
