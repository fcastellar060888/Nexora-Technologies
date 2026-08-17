import test from'node:test'
import assert from'node:assert/strict'
import{migrateMipePersistenceState}from'../src/services/mipePersistenceMigration.js'
import{applyRemoteRecords,enqueueChanges}from'../src/services/syncEngine.js'

test('M32-F008 re-audit: identical command receipts converge to one durable identity',()=>{
 const common={commandId:'cmd-shared',organizationId:'org-a',signature:'same-signature',operation:'CREATE_INCIDENT',aggregateId:'cmd-shared'}
 const migrated=migrateMipePersistenceState({mipeCommandReceipts:[common,{...common,id:'cmd-shared'}]})
 assert.equal(migrated.mipeCommandReceipts.length,1)
 assert.equal(migrated.mipeCommandReceipts[0].id,'cmd-shared')
 assert.equal(migrated.mipeCommandReceipts[0].commandId,'cmd-shared')
})

test('M32-F012: receipt tombstone remoto falla cerrado y preserva homónimos de ambos tenants',()=>{
 const state={mipeCommandReceipts:[
  {id:'cmd-shared',commandId:'cmd-shared',organizationId:'org-a',signature:'a'},
  {id:'cmd-shared',commandId:'cmd-shared',organizationId:'org-b',signature:'b'}
 ]}
 const before=structuredClone(state)
 assert.throws(()=>applyRemoteRecords(state,[{companyId:'org-a',collection:'mipeCommandReceipts',recordId:'cmd-shared',payload:null,version:2,updatedAt:'2026-08-18T10:00:00.000Z',deletedAt:'2026-08-18T10:00:00.000Z'}],{companyId:'org-a'}),/append-only|tombstones/i)
 assert.deepEqual(state,before)
})

test('M32-F012: delete saliente de receipt no entra a la cola de sync',()=>{
 const state={syncQueue:[]},changes=[{collection:'mipeCommandReceipts',recordId:'cmd-a',organizationId:'org-a',operation:'delete',payload:null}]
 assert.throws(()=>enqueueChanges(state,changes,{companyId:'org-a'}),/append-only|delete/i)
 assert.deepEqual(state.syncQueue,[])
})

test('M32-F012: receipt remoto no puede reescribir una firma durable local',()=>{
 const state={mipeCommandReceipts:[{id:'cmd-a',commandId:'cmd-a',organizationId:'org-a',signature:'signature-a'}]}
 const row={companyId:'org-a',collection:'mipeCommandReceipts',recordId:'cmd-a',payload:{commandId:'cmd-a',organizationId:'org-a',signature:'signature-hostile'},version:2,updatedAt:'2026-08-18T10:00:00.000Z'}
 assert.throws(()=>applyRemoteRecords(state,[row],{companyId:'org-a'}),/firma durable local/i)
 assert.equal(state.mipeCommandReceipts[0].signature,'signature-a')
})

test('M32-F012: receipt remoto legítimo conserva identidad canónica para replay cross-device',()=>{
 const state={mipeCommandReceipts:[]}
 const row={companyId:'org-a',collection:'mipeCommandReceipts',recordId:'cmd-remote',payload:{commandId:'cmd-remote',organizationId:'org-a',signature:'signature-remote',operation:'CREATE_INCIDENT',aggregateId:'cmd-remote'},version:1,updatedAt:'2026-08-18T10:00:00.000Z'}
 const next=applyRemoteRecords(state,[row],{companyId:'org-a'}),receipt=next.mipeCommandReceipts[0]
 assert.equal(receipt.id,'cmd-remote');assert.equal(receipt.commandId,'cmd-remote');assert.equal(receipt.organizationId,'org-a');assert.equal(receipt.signature,'signature-remote')
})
