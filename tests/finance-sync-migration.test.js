import test from'node:test'
import assert from'node:assert/strict'
import{migrateState}from'../src/services/stateMigration.js'
import{SYNCABLE_COLLECTIONS,collectionChanges,enqueueChanges,applyRemoteRecords}from'../src/services/syncEngine.js'

test('M4.4 F005: currencies and cost entries are first-class sync collections',()=>{
 assert.ok(SYNCABLE_COLLECTIONS.includes('currencies'))
 assert.ok(SYNCABLE_COLLECTIONS.includes('costEntries'))
 const next={currencies:[{id:'currency:org-a:USD',code:'USD',organizationId:'org-a',rateToBase:4000}],costEntries:[{id:'cost-a',organizationId:'org-a',siteId:'site-a',amount:100}]}
 const changes=collectionChanges({},next,['currencies','costEntries'])
 assert.deepEqual(changes.map(x=>x.collection).sort(),['costEntries','currencies'])
})

test('M4.4 F005: finance sync rejects ownerless legacy mutations instead of silently adopting the active tenant',()=>{
 const state={syncQueue:[]}
 const ownerlessCurrency={collection:'currencies',recordId:'currency:USD',organizationId:'',operation:'upsert',payload:{id:'currency:USD',code:'USD',rateToBase:4000},previousPayload:null}
 const ownerlessCost={collection:'costEntries',recordId:'cost-legacy',organizationId:'',operation:'upsert',payload:{id:'cost-legacy',amount:100},previousPayload:null}
 assert.throws(()=>enqueueChanges(state,[ownerlessCurrency],{companyId:'org-a'}),/currencies.*organizationId|legacy/i)
 assert.throws(()=>enqueueChanges(state,[ownerlessCost],{companyId:'org-a'}),/costEntries.*organizationId|legacy/i)
})

test('M4.4 F005: finance hydration requires explicit tenant ownership and mutates only the active-tenant homonym',()=>{
 const state={currentContext:{companyId:'org-a'},currencies:[{id:'same',organizationId:'org-b',code:'USD',rateToBase:4100},{id:'same',organizationId:'org-a',code:'USD',rateToBase:4000}],costEntries:[]}
 const row={companyId:'org-a',collection:'currencies',recordId:'same',version:2,updatedAt:'2026-08-29T00:00:00.000Z',payload:{id:'same',organizationId:'org-a',code:'USD',rateToBase:4050}}
 const next=applyRemoteRecords(state,[row],{companyId:'org-a'})
 assert.equal(next.currencies[0].rateToBase,4100)
 assert.equal(next.currencies[1].rateToBase,4050)
 assert.throws(()=>applyRemoteRecords({...state,currencies:[...state.currencies,{id:'legacy',code:'COP',rateToBase:1}]},[{...row,recordId:'legacy',payload:{id:'legacy',code:'COP',rateToBase:1}}],{companyId:'org-a'}),/organizationId|legacy/i)
})

test('M4.4 F006: migration preserves object-valued production ledger structure',()=>{
 const ledger={planned:{units:12,cost:300},actual:{units:10,cost:280},entries:[{id:'e1',amount:120}]}
 const migrated=migrateState({companies:[{id:'org-a'}],currentContext:{companyId:'org-a'},propagationBatches:[{id:'batch-a',organizationId:'org-a',quantity:12,productionLedger:ledger}]})
 assert.deepEqual(migrated.propagationBatches[0].productionLedger,ledger)
 assert.notEqual(migrated.propagationBatches[0].productionLedger,ledger)
})

test('M4.4 F006: migration keeps legacy array ledgers while invalid scalar values fall back safely',()=>{
 const arrayLedger=[{id:'entry-a',amount:20}]
 const migrated=migrateState({propagationBatches:[{id:'array',quantity:1,productionLedger:arrayLedger},{id:'invalid',quantity:1,productionLedger:'corrupt'}]})
 assert.deepEqual(migrated.propagationBatches[0].productionLedger,arrayLedger)
 assert.notEqual(migrated.propagationBatches[0].productionLedger,arrayLedger)
 assert.deepEqual(migrated.propagationBatches[1].productionLedger,[])
})
