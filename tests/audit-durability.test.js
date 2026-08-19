import test from'node:test'
import assert from'node:assert/strict'
import{readFileSync}from'node:fs'
import{SYNCABLE_COLLECTIONS,collectionChanges,enqueueChanges,applyRemoteRecords}from'../src/services/syncEngine.js'

const base=()=>({
 currentContext:{companyId:'org-a'},companies:[{id:'org-a'},{id:'org-b'}],sites:[],
 auditLog:[],syncQueue:[],syncConflicts:[]
})

test('M4.6 F005: generic audit log is an explicit syncable append-only domain collection',()=>{
 assert.equal(SYNCABLE_COLLECTIONS.includes('auditLog'),true)
 const before=base()
 const entry={id:'audit-a',organizationId:'org-a',siteId:null,createdAt:'2026-08-18T12:00:00.000Z',actor:'Admin',module:'Inventario',action:'Actualización',detail:'X'}
 const after={...before,auditLog:[entry]}
 const changes=collectionChanges(before,after,['auditLog'])
 assert.equal(changes.length,1)
 const queued=enqueueChanges(after,changes,{companyId:'org-a',deviceId:'device-a'})
 assert.equal(queued.syncQueue.length,1)
 assert.equal(queued.syncQueue[0].collection,'auditLog')
 assert.equal(queued.syncQueue[0].payload.organizationId,'org-a')
})

test('M4.6 F005: ownerless multi-company audit cannot be synchronized by envelope adoption',()=>{
 const state=base()
 const changes=[{collection:'auditLog',recordId:'audit-ownerless',organizationId:'',operation:'upsert',payload:{id:'audit-ownerless',action:'Legacy'}}]
 assert.throws(()=>enqueueChanges(state,changes,{companyId:'org-a',deviceId:'device-a'}),/organizationId|ownership|empresa/i)
})

test('M4.6 F005: remote audit hydration is tenant-aware and preserves foreign homonyms',()=>{
 const state={...base(),auditLog:[{id:'audit-shared',organizationId:'org-b',action:'B'}]}
 const next=applyRemoteRecords(state,[{companyId:'org-a',collection:'auditLog',recordId:'audit-shared',payload:{id:'audit-shared',organizationId:'org-a',action:'A'},version:2,updatedAt:'2026-08-18T12:00:00.000Z'}],{companyId:'org-a'})
 assert.equal(next.auditLog.length,2)
 assert.equal(next.auditLog.find(x=>x.organizationId==='org-b').action,'B')
 assert.equal(next.auditLog.find(x=>x.organizationId==='org-a').action,'A')
})

test('M4.6 F005: store appends audit before collectionChanges so generic audit enters the same sync boundary',()=>{
 const source=readFileSync(new URL('../src/services/store.jsx',import.meta.url),'utf8')
 assert.match(source,/auditedCandidate/)
 const auditPosition=source.indexOf('auditedCandidate')
 const changesPosition=source.indexOf('collectionChanges(prev,auditedCandidate)')
 assert.ok(auditPosition>=0&&changesPosition>auditPosition)
})

test('M4.6 F005: authoritative bootstrap no longer classifies auditLog as local-only',()=>{
 const source=readFileSync(new URL('../src/services/remoteBootstrap.js',import.meta.url),'utf8')
 const localOnly=source.match(/LOCAL_ONLY_COLLECTIONS=new Set\(\[([\s\S]*?)\]\)/)?.[1]||''
 assert.doesNotMatch(localOnly,/['"]auditLog['"]/)
})
