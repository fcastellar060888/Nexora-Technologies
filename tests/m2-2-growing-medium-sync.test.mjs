import test from'node:test'
import assert from'node:assert/strict'
import{SYNCABLE_COLLECTIONS,collectionChanges,enqueueChanges,applyRemoteRecords}from'../src/services/syncEngine.js'

const collections=['growingMediumProducts','growingMediumFormulas','growingMediumBatches','growingMediumAssignments','growingMediumReusePolicies','growingMediumReuseCycles']

test('M22-F001/F008: all growing medium collections participate in tenant-aware sync',()=>{
 for(const collection of collections)assert.ok(SYNCABLE_COLLECTIONS.includes(collection),`${collection} debe sincronizarse`)
 const prev={growingMediumProducts:[],syncQueue:[]},next={...prev,growingMediumProducts:[{id:'gm-1',organizationId:'org-a',name:'Coco'}]}
 const changes=collectionChanges(prev,next)
 const queued=enqueueChanges(next,changes,{companyId:'org-a',userId:'u1',deviceId:'d1'})
 assert.equal(queued.syncQueue.length,1)
 assert.equal(queued.syncQueue[0].payload._organizationId,'org-a')
})

test('M22-F001: foreign growing-medium records cannot enter local sync or remote hydration',()=>{
 assert.throws(()=>enqueueChanges({syncQueue:[]},[{collection:'growingMediumProducts',recordId:'gm-1',operation:'upsert',payload:{id:'gm-1',organizationId:'org-b'}}],{companyId:'org-a'}),/otra empresa/)
 assert.throws(()=>applyRemoteRecords({currentContext:{companyId:'org-a'}},[{companyId:'org-b',collection:'growingMediumProducts',recordId:'gm-1',payload:{name:'Foreign'}}]),/otra empresa/)
})
