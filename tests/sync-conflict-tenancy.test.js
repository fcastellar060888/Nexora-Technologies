import test from'node:test'
import assert from'node:assert/strict'
import{syncStatus}from'../src/services/syncEngine.js'
import{retryMutation,retryAllFailed,applyConflictResolution}from'../src/services/syncConflictCenter.js'

const state=()=>({
 currentContext:{companyId:'org-a'},
 companies:[{id:'org-a'},{id:'org-b'}],sites:[],
 products:[{id:'product-a',organizationId:'org-a',name:'A'},{id:'product-b',organizationId:'org-b',name:'B'}],
 syncQueue:[
  {id:'mutation-shared',companyId:'org-b',collection:'products',recordId:'product-b',status:'failed',attempts:3},
  {id:'mutation-shared',companyId:'org-a',collection:'products',recordId:'product-a',status:'failed',attempts:2},
  {id:'mutation-ownerless',collection:'products',recordId:'legacy',status:'failed',attempts:1}
 ],
 syncConflicts:[
  {id:'conflict-shared',companyId:'org-b',mutationId:'mutation-shared',collection:'products',recordId:'product-b',localPayload:{id:'product-b',organizationId:'org-b',name:'B local'},remotePayload:{id:'product-b',organizationId:'org-b',name:'B remote'},localVersion:1,remoteVersion:2,status:'open'},
  {id:'conflict-shared',companyId:'org-a',mutationId:'mutation-shared',collection:'products',recordId:'product-a',localPayload:{id:'product-a',organizationId:'org-a',name:'A local'},remotePayload:{id:'product-a',organizationId:'org-a',name:'A remote'},localVersion:1,remoteVersion:2,status:'open'}
 ]
})

test('M4.5 F004: sync status counts only active-company queue and conflicts',()=>{
 const status=syncStatus(state(),'org-a')
 assert.equal(status.pending,0)
 assert.equal(status.failed,1)
 assert.equal(status.conflicts,1)
})

test('M4.5 F005: retryMutation changes exactly one active-tenant homonym',()=>{
 const next=retryMutation(state(),'mutation-shared','org-a')
 assert.equal(next.syncQueue[0].status,'failed')
 assert.equal(next.syncQueue[0].attempts,3)
 assert.equal(next.syncQueue[1].status,'pending')
 assert.equal(next.syncQueue[1].attempts,0)
})

test('M4.5 F005: ownerless or foreign retry authority fails closed',()=>{
 assert.throws(()=>retryMutation(state(),'mutation-ownerless','org-a'),/empresa|tenant|ownership|mutación|encontrad/i)
 assert.throws(()=>retryMutation(state(),'mutation-shared','org-c'),/empresa|tenant|mutación|encontrad/i)
})

test('M4.5 F005: retryAllFailed never retries foreign or ownerless entries',()=>{
 const next=retryAllFailed(state(),'org-a')
 assert.equal(next.syncQueue[0].status,'failed')
 assert.equal(next.syncQueue[1].status,'pending')
 assert.equal(next.syncQueue[2].status,'failed')
})

test('M4.5 F005: conflict resolution selects and completes only active-tenant homonyms',()=>{
 const next=applyConflictResolution(state(),'conflict-shared',{strategy:'remote',resolvedBy:'Admin'})
 assert.equal(next.syncConflicts[0].status,'open')
 assert.equal(next.syncConflicts[1].status,'resolved')
 assert.equal(next.products.find(item=>item.organizationId==='org-b').name,'B')
 assert.equal(next.products.find(item=>item.organizationId==='org-a').name,'A remote')
 assert.equal(next.syncQueue[0].status,'failed')
 assert.equal(next.syncQueue[1].status,'completed')
})
