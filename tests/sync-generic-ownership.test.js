import test from'node:test'
import assert from'node:assert/strict'
import{applyRemoteRecords,enqueueChanges}from'../src/services/syncEngine.js'

const multi=()=>({
 currentContext:{companyId:'org-a'},companies:[{id:'org-a'},{id:'org-b'}],sites:[],
 products:[{id:'product-shared',name:'Legacy ownerless'}],
 syncQueue:[],syncConflicts:[]
})

test('M4.5 F006: generic remote hydration never adopts or overwrites ownerless homonym in multi-company state',()=>{
 const state=multi()
 const next=applyRemoteRecords(state,[{companyId:'org-a',collection:'products',recordId:'product-shared',payload:{id:'product-shared',name:'Remoto A'},version:2,updatedAt:'2026-08-29T12:00:00.000Z'}],{companyId:'org-a'})
 assert.equal(next.products.length,2)
 const legacy=next.products.find(item=>!item.organizationId&&!item._organizationId)
 const remote=next.products.find(item=>item.organizationId==='org-a')
 assert.equal(legacy?.name,'Legacy ownerless')
 assert.equal(remote?.name,'Remoto A')
 assert.equal(remote?._organizationId,'org-a')
})

test('M4.5 F006: multi-company outbound generic mutation requires explicit domain ownership',()=>{
 const state=multi()
 const changes=[{collection:'products',recordId:'product-ownerless',organizationId:'',operation:'upsert',payload:{id:'product-ownerless',name:'No adoptar'}}]
 assert.throws(()=>enqueueChanges(state,changes,{companyId:'org-a',deviceId:'device-a'}),/organizationId|ownership|empresa/i)
})

test('M4.5 F006: transport envelope cannot substitute domain ownership in multi-company outbound sync',()=>{
 const state=multi()
 const changes=[{collection:'products',recordId:'product-envelope',organizationId:'org-a',operation:'upsert',payload:{id:'product-envelope',_organizationId:'org-a',name:'Envelope only'}}]
 assert.throws(()=>enqueueChanges(state,changes,{companyId:'org-a',deviceId:'device-a'}),/organizationId|ownership|empresa/i)
})

test('M4.5 F006: single-company outbound legacy mutation materializes first-class ownership in queued payload',()=>{
 const state={...multi(),companies:[{id:'org-a'}]}
 const changes=[{collection:'products',recordId:'product-legacy',organizationId:'',operation:'upsert',payload:{id:'product-legacy',name:'Legacy único'}}]
 const next=enqueueChanges(state,changes,{companyId:'org-a',deviceId:'device-a'})
 assert.equal(next.syncQueue[0].companyId,'org-a')
 assert.equal(next.syncQueue[0].payload.organizationId,'org-a')
 assert.equal(next.syncQueue[0].payload._organizationId,'org-a')
})
