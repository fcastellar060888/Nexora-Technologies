import test from'node:test'
import assert from'node:assert/strict'
import{applyRemoteRecords,enqueueChanges}from'../src/services/syncEngine.js'

test('M11-F004: upsert queue canonicalizes tenant ownership without rewriting record identity',()=>{
 const state={syncQueue:[]}
 const next=enqueueChanges(state,[{collection:'plantPositions',recordId:'plant-1',operation:'upsert',payload:{id:'plant-1',bedId:'bed-1'}}],{companyId:'org-a',userId:'user-1',deviceId:'device-1'})
 assert.equal(next.syncQueue.length,1)
 assert.equal(next.syncQueue[0].companyId,'org-a')
 assert.equal(next.syncQueue[0].payload.id,'plant-1')
 assert.equal(next.syncQueue[0].payload._organizationId,'org-a')
})

test('M11-F004: queue rejects a cross-tenant domain payload before persistence',()=>{
 assert.throws(()=>enqueueChanges({syncQueue:[]},[{collection:'plantPositions',recordId:'plant-1',operation:'upsert',payload:{id:'plant-1',organizationId:'org-b'}}],{companyId:'org-a'}),/otra empresa/)
})

test('M11-F004: remote records materialize with authoritative tenant ownership',()=>{
 const state={currentContext:{companyId:'org-a'},plantPositions:[]}
 const next=applyRemoteRecords(state,[{companyId:'org-a',collection:'plantPositions',recordId:'plant-1',payload:{bedId:'bed-1'},version:3,updatedAt:'2026-08-14T00:00:00.000Z'}])
 assert.equal(next.plantPositions[0].id,'plant-1')
 assert.equal(next.plantPositions[0]._organizationId,'org-a')
 assert.equal(next.plantPositions[0]._syncVersion,3)
})
