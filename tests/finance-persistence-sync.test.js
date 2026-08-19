import test from'node:test'
import assert from'node:assert/strict'
import{migrateState,CURRENT_SCHEMA_VERSION}from'../src/services/stateMigration.js'
import{SYNCABLE_COLLECTIONS,collectionChanges,applyRemoteRecords}from'../src/services/syncEngine.js'

const minimal=overrides=>({
 schemaVersion:15,currentContext:{companyId:'org-a'},companies:[{id:'org-a'}],sites:[{id:'site-a',organizationId:'org-a'}],
 propagationBatches:[],currencies:[],costEntries:[],...overrides
})

test('M4.4 F006: state migration preserves canonical productionLedger object and Empaque output',()=>{
 const migrated=migrateState(minimal({propagationBatches:[{id:'lot-a',organizationId:'org-a',siteId:'site-a',quantity:10,productionLedger:{Cosecha:{outputGrams:1000},Empaque:{inputGrams:600,outputGrams:500,lossGrams:100}}}]}))
 assert.equal(Array.isArray(migrated.propagationBatches[0].productionLedger),false)
 assert.equal(migrated.propagationBatches[0].productionLedger.Empaque.outputGrams,500)
 assert.ok(CURRENT_SCHEMA_VERSION>=16)
})

test('M4.4 F005: single-company legacy currency gains explicit owner and stable sync identity',()=>{
 const migrated=migrateState(minimal({currencies:[{code:'COP',name:'Peso',symbol:'$',rateToBase:1,active:true}]}))
 const currency=migrated.currencies[0]
 assert.equal(currency.organizationId,'org-a')
 assert.ok(currency.id)
 assert.equal(SYNCABLE_COLLECTIONS.includes('currencies'),true)
})

test('M4.4 F005: multi-company ownerless currency is not adopted and is excluded from sync diffs',()=>{
 const before=migrateState(minimal({companies:[{id:'org-a'},{id:'org-b'}],currencies:[{code:'COP',rateToBase:1,active:true}]}))
 assert.equal(before.currencies[0].organizationId,undefined)
 const after={...before,currencies:[...before.currencies,{id:'currency-a-usd',organizationId:'org-a',code:'USD',rateToBase:4000,active:true}]}
 const changes=collectionChanges(before,after,['currencies'])
 assert.equal(changes.length,1)
 assert.equal(changes[0].recordId,'currency-a-usd')
 assert.equal(changes[0].organizationId,'org-a')
})

test('M4.4 F005: uniquely owned legacy cost gains first-class owner; ambiguous cost stays unsynced',()=>{
 const single=migrateState(minimal({costEntries:[{id:'cost-a',siteId:'site-a',amount:100}]}))
 assert.equal(single.costEntries[0].organizationId,'org-a')
 const multi=migrateState(minimal({companies:[{id:'org-a'},{id:'org-b'}],sites:[{id:'shared',organizationId:'org-a'},{id:'shared',organizationId:'org-b'}],costEntries:[{id:'cost-legacy',siteId:'shared',amount:100}]}))
 assert.equal(multi.costEntries[0].organizationId,undefined)
 const changes=collectionChanges({...multi,costEntries:[]},multi,['costEntries'])
 assert.deepEqual(changes,[])
})

test('M4.4 F005: remote currency hydration is tenant-aware and materializes first-class ownership',()=>{
 const state={currentContext:{companyId:'org-a'},companies:[{id:'org-a'},{id:'org-b'}],sites:[],currencies:[{id:'cur-shared',organizationId:'org-b',code:'USD',rateToBase:4100}],costEntries:[]}
 const next=applyRemoteRecords(state,[{collection:'currencies',recordId:'cur-shared',companyId:'org-a',payload:{id:'cur-shared',organizationId:'org-a',code:'USD',rateToBase:4000},version:2,updatedAt:'2026-08-18T12:00:00.000Z'}],{companyId:'org-a'})
 assert.equal(next.currencies.length,2)
 assert.equal(next.currencies[0].organizationId,'org-b')
 assert.equal(next.currencies[1].organizationId,'org-a')
 assert.equal(next.currencies[1].rateToBase,4000)
})
