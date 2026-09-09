import test from'node:test'
import assert from'node:assert/strict'
import{applyConflictResolution,deviceSummary,retryAllFailed,retryMutation}from'../src/services/syncConflictCenter.js'

test('reintenta una mutación fallida limpiando su error',()=>{
 const state={syncQueue:[{id:'m1',status:'failed',attempts:6,error:'red',nextAttemptAt:'mañana'}]}
 const next=retryMutation(state,'m1')
 assert.equal(next.syncQueue[0].status,'pending')
 assert.equal(next.syncQueue[0].attempts,0)
 assert.equal(next.syncQueue[0].error,'')
})

test('reintenta solo fallidos de la empresa activa',()=>{
 const state={syncQueue:[{id:'a',companyId:'c1',status:'failed'},{id:'b',companyId:'c2',status:'failed'}]}
 const next=retryAllFailed(state,'c1')
 assert.equal(next.syncQueue[0].status,'pending')
 assert.equal(next.syncQueue[1].status,'failed')
})

test('resuelve un conflicto conservando la versión remota',()=>{
 const companyId='company-a'
 const state={
  currentContext:{companyId},
  products:[{id:'p1',organizationId:companyId,name:'Local'}],
  syncQueue:[{id:'m1',companyId,status:'conflict'}],
  syncConflicts:[{id:'x1',companyId,mutationId:'m1',collection:'products',recordId:'p1',localPayload:{id:'p1',organizationId:companyId,name:'Local'},remotePayload:{id:'p1',organizationId:companyId,name:'Remoto'},localVersion:1,remoteVersion:2,status:'open'}]
 }
 const next=applyConflictResolution(state,'x1',{strategy:'remote',resolvedBy:'Admin'})
 assert.equal(next.products[0].name,'Remoto')
 assert.equal(next.syncConflicts[0].status,'resolved')
 assert.equal(next.syncQueue[0].status,'completed')
})

test('AUD-F016: rechaza resolver un conflicto perteneciente a otra empresa',()=>{
 const state={
  currentContext:{companyId:'company-a'},
  products:[{id:'p1',name:'Local'}],
  syncQueue:[{id:'m1',companyId:'company-b',status:'conflict'}],
  syncConflicts:[{id:'x1',companyId:'company-b',mutationId:'m1',collection:'products',recordId:'p1',localPayload:{id:'p1',name:'Local'},remotePayload:{id:'p1',name:'Remoto'},localVersion:1,remoteVersion:2,status:'open'}]
 }
 assert.throws(()=>applyConflictResolution(state,'x1',{strategy:'remote'}),/otra empresa/)
 assert.equal(state.products[0].name,'Local')
 assert.equal(state.syncConflicts[0].status,'open')
 assert.equal(state.syncQueue[0].status,'conflict')
})

test('agrupa actividad por dispositivo',()=>{
 const result=deviceSummary([{deviceId:'ipad',status:'pending',updatedAt:'2026-01-01'},{deviceId:'ipad',status:'failed',updatedAt:'2026-01-02'}])
 assert.equal(result.length,1)
 assert.equal(result[0].pending,1)
 assert.equal(result[0].failed,1)
})
