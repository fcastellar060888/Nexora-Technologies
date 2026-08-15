import test from'node:test'
import assert from'node:assert/strict'
import{SYNCABLE_COLLECTIONS,collectionChanges,enqueueChanges,applyRemoteRecords}from'../src/services/syncEngine.js'

const collections=['growingMediumProducts','growingMediumFormulas','growingMediumBatches','growingMediumAssignments','growingMediumReusePolicies','growingMediumReuseCycles','growingMediumPurchaseRequirements']

test('M22-F001/F006/F008: all growing medium collections participate in tenant-aware sync',()=>{
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
 assert.throws(()=>applyRemoteRecords({currentContext:{companyId:'org-a'}},[{companyId:'org-a',collection:'growingMediumProducts',recordId:'gm-1',payload:{organizationId:'org-b',name:'Foreign'}}]),/payload perteneciente a otra empresa/)
})

test('M22 re-audit: local diff uses organization plus id when tenants repeat ids',()=>{
 const foreign={id:'shared',organizationId:'org-b',name:'Coco B'}
 const previous={growingMediumProducts:[{id:'shared',organizationId:'org-a',name:'Coco A'},foreign]}
 const next={growingMediumProducts:[{id:'shared',organizationId:'org-a',name:'Coco A actualizado'},foreign]}
 const changes=collectionChanges(previous,next,['growingMediumProducts'])
 assert.equal(changes.length,1)
 assert.equal(changes[0].organizationId,'org-a')
 assert.equal(changes[0].payload.name,'Coco A actualizado')
 const queued=enqueueChanges({...next,syncQueue:[]},changes,{companyId:'org-a'})
 assert.equal(queued.syncQueue.length,1)
 assert.equal(queued.syncQueue[0].companyId,'org-a')
})

test('M22 re-audit: remote upsert and delete preserve a foreign record with the same id',()=>{
 const state={currentContext:{companyId:'org-a'},growingMediumProducts:[{id:'shared',organizationId:'org-b',name:'Coco B'},{id:'shared',organizationId:'org-a',name:'Coco A'}]}
 const updated=applyRemoteRecords(state,[{companyId:'org-a',collection:'growingMediumProducts',recordId:'shared',payload:{organizationId:'org-a',name:'Coco A remoto'},version:2}])
 assert.equal(updated.growingMediumProducts.find(item=>item.organizationId==='org-a').name,'Coco A remoto')
 assert.equal(updated.growingMediumProducts.find(item=>item.organizationId==='org-b').name,'Coco B')
 const deleted=applyRemoteRecords(updated,[{companyId:'org-a',collection:'growingMediumProducts',recordId:'shared',deletedAt:'2026-08-15T00:00:00.000Z'}])
 assert.deepEqual(deleted.growingMediumProducts.map(item=>[item.organizationId,item.name]),[['org-b','Coco B']])
})

test('M22 re-audit: a foreign delete cannot be queued under the active tenant',()=>{
 const changes=collectionChanges({growingMediumAssignments:[{id:'shared',organizationId:'org-b'}]},{growingMediumAssignments:[]},['growingMediumAssignments'])
 assert.equal(changes[0].organizationId,'org-b')
 assert.throws(()=>enqueueChanges({syncQueue:[]},changes,{companyId:'org-a'}),/otra empresa/)
})
