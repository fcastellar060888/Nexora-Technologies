import test from'node:test'
import assert from'node:assert/strict'
import{migrateMipePersistenceState}from'../src/services/mipePersistenceMigration.js'
import{applyRemoteRecords}from'../src/services/syncEngine.js'

test('M32-F008 re-audit: identical command receipts converge to one durable identity',()=>{
 const common={commandId:'cmd-shared',organizationId:'org-a',signature:'same-signature',operation:'CREATE_INCIDENT',aggregateId:'cmd-shared'}
 const migrated=migrateMipePersistenceState({mipeCommandReceipts:[common,{...common,id:'cmd-shared'}]})
 assert.equal(migrated.mipeCommandReceipts.length,1)
 assert.equal(migrated.mipeCommandReceipts[0].id,'cmd-shared')
 assert.equal(migrated.mipeCommandReceipts[0].commandId,'cmd-shared')
})

test('M32-F008 re-audit: receipt tombstone removes only the active-tenant homonym',()=>{
 const state={mipeCommandReceipts:[
  {id:'cmd-shared',commandId:'cmd-shared',organizationId:'org-a',signature:'a'},
  {id:'cmd-shared',commandId:'cmd-shared',organizationId:'org-b',signature:'b'}
 ]}
 const next=applyRemoteRecords(state,[{companyId:'org-a',collection:'mipeCommandReceipts',recordId:'cmd-shared',payload:null,version:2,updatedAt:'2026-08-18T10:00:00.000Z',deletedAt:'2026-08-18T10:00:00.000Z'}],{companyId:'org-a'})
 assert.equal(next.mipeCommandReceipts.length,1)
 assert.equal(next.mipeCommandReceipts[0].organizationId,'org-b')
 assert.equal(next.mipeCommandReceipts[0].signature,'b')
})
