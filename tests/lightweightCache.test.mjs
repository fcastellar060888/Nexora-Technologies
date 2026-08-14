import test from'node:test'
import assert from'node:assert/strict'
import{cacheDiagnostics,cleanupLightweightCache,readLightweightCache,writeLightweightCache}from'../src/services/lightweightCache.js'

class MemoryStorage{
 constructor(){this.values=new Map()}
 getItem(key){return this.values.has(key)?this.values.get(key):null}
 setItem(key,value){this.values.set(key,String(value))}
 removeItem(key){this.values.delete(key)}
}

function ledgerEntry(id,organizationId,sequence){
 const occurredAt=new Date(Date.UTC(2026,0,1,0,0,sequence%60)).toISOString()
 return{id,sequence,recordedAt:occurredAt,event:{eventId:id,context:{organizationId},occurredAt}}
}

function state(companyId='c1'){
 return{
  schemaVersion:7,currentContext:{companyId},companies:[{id:'c1'},{id:'c2'}],
  users:[{id:'u1',activeSession:true}],roles:[],memberships:[],userSessions:[],auditLog:[],
  syncQueue:[{id:'q1',companyId,status:'pending',updatedAt:'2026-01-01T00:00:00Z'}],syncConflicts:[],syncHealthEvents:[],syncDeviceHealth:[],syncMeta:{},
  sites:[{id:'s1',companyId:'c1'},{id:'s2',companyId:'c2'}],
  genetics:[{id:'g1'}],operationalLedgerEntries:[]
 }
}

test('writes identity and company data separately',()=>{
 const storage=new MemoryStorage()
 writeLightweightCache(state('c1'),storage)
 const restored=readLightweightCache(storage)
 assert.equal(restored.currentContext.companyId,'c1')
 assert.deepEqual(restored.sites.map(x=>x.id),['s1'])
 assert.deepEqual(restored.genetics.map(x=>x.id),['g1'])
 assert.equal(restored.syncQueue.length,1)
 const diagnostics=cacheDiagnostics(storage)
 assert.equal(diagnostics.companies.length,1)
 assert.ok(diagnostics.totalBytes>0)
})

test('partitions Operational Ledger entries by nested event organization',()=>{
 const storage=new MemoryStorage(),source=state('c1')
 source.operationalLedgerEntries=[ledgerEntry('c1-event','c1',1),ledgerEntry('c2-event','c2',2)]
 writeLightweightCache(source,storage)
 const restored=readLightweightCache(storage)
 assert.deepEqual(restored.operationalLedgerEntries.map(item=>item.id),['c1-event'])
})

test('Operational Ledger is not truncated by the generic 1500-record collection cap',()=>{
 const storage=new MemoryStorage(),source=state('c1')
 source.operationalLedgerEntries=Array.from({length:1601},(_,index)=>ledgerEntry(`event-${index+1}`,'c1',index+1))
 writeLightweightCache(source,storage)
 const restored=readLightweightCache(storage)
 assert.equal(restored.operationalLedgerEntries.length,1601)
 assert.equal(restored.operationalLedgerEntries[0].sequence,1)
 assert.equal(restored.operationalLedgerEntries.at(-1).sequence,1601)
})

test('keeps at most three company caches',()=>{
 const storage=new MemoryStorage()
 for(const id of['c1','c2','c3','c4'])writeLightweightCache(state(id),storage)
 const diagnostics=cacheDiagnostics(storage)
 assert.equal(diagnostics.companies.length,3)
 assert.deepEqual(diagnostics.companies.map(x=>x.companyId),['c4','c3','c2'])
})

test('removes expired company caches',()=>{
 const storage=new MemoryStorage()
 writeLightweightCache(state('c1'),storage)
 const future=Date.now()+31*24*60*60*1000
 const result=cleanupLightweightCache(storage,{now:future,ttlMs:30*24*60*60*1000})
 assert.equal(result.removed,1)
 assert.equal(cacheDiagnostics(storage).companies.length,0)
})
