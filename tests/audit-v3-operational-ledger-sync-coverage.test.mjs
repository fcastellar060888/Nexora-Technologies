import test from'node:test'
import assert from'node:assert/strict'
import{
 operationalLedgerCursor,operationalLedgerOutbox,buildOperationalLedgerPullPath,
 mapOperationalLedgerRow,synchronizeOperationalLedger
}from'../src/services/operationalLedgerSync.js'

const ORG='11111111-1111-4111-8111-111111111111'
const event=(id='event-1')=>({eventId:id,name:'production.plant.updated',version:1,aggregate:{type:'plant',id:'plant-1'},context:{organizationId:ORG,siteId:null,actorId:'user-1'},occurredAt:'2026-08-08T01:00:00.000Z',correlationId:null,causationId:null,payload:{},metadata:{}})
const entry=(id='event-1',sequence=1)=>({id,sequence,recordedAt:'2026-08-08T01:00:01.000Z',event:event(id)})
const row=(id='event-1',sequence=1)=>({organization_id:ORG,sequence,event_id:id,event:event(id),recorded_at:'2026-08-08T01:00:01.000Z'})

test('valid metadata and default pull options retain canonical values',()=>{
 const state={currentContext:{companyId:ORG},syncMeta:{ledgerCursorByCompany:{[ORG]:12},ledgerOutboxByCompany:{[ORG]:'invalid'}}}
 assert.equal(operationalLedgerCursor(state),12)
 assert.deepEqual(operationalLedgerOutbox(state),[])
 const path=buildOperationalLedgerPullPath(ORG)
 assert.match(path,/sequence=gt\.0/)
 assert.match(path,/limit=1000/)
})

test('row mapping accepts event identity fallback when event_id is absent',()=>{
 const mapped=mapOperationalLedgerRow({...row(),event_id:''},ORG)
 assert.equal(mapped.id,'event-1')
 assert.equal(mapped.sequence,1)
 assert.equal(mapped.recordedAt,'2026-08-08T01:00:01.000Z')
})

test('object append confirmation works and invalid canonical sequence fails closed',async()=>{
 const state={currentContext:{companyId:ORG},operationalLedgerEntries:[entry()],syncMeta:{ledgerCursorByCompany:{[ORG]:0},ledgerOutboxByCompany:{[ORG]:['event-1']}}}
 let invalid=false
 const request=async path=>path.includes('/rpc/')?{sequence:invalid?0:1,recorded_at:'2026-08-08T01:00:02.000Z'}:[]
 const synced=await synchronizeOperationalLedger(state,{request})
 assert.equal(synced.pushed,1)
 assert.equal(synced.cursor,1)
 assert.deepEqual(synced.state.syncMeta.ledgerOutboxByCompany[ORG],[])
 invalid=true
 await assert.rejects(()=>synchronizeOperationalLedger(state,{request}),/secuencia remota/)
})

test('empty synchronization with explicit company preserves cursor and partition',async()=>{
 const state={currentContext:{},operationalLedgerEntries:[entry('historical',3)],syncMeta:{ledgerCursorByCompany:{[ORG]:3},ledgerOutboxByCompany:{[ORG]:[]}}}
 let calls=0
 const request=async()=>{calls++;return[]}
 const synced=await synchronizeOperationalLedger(state,{companyId:ORG,request})
 assert.equal(calls,1)
 assert.equal(synced.pushed,0)
 assert.equal(synced.pulled,0)
 assert.equal(synced.cursor,3)
 assert.deepEqual(synced.state.operationalLedgerEntries.map(item=>item.id),['historical'])
})
