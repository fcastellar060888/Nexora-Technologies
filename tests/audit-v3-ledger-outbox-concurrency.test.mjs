import test from'node:test'
import assert from'node:assert/strict'
import{commitIncrementalSyncResult}from'../src/services/syncCommit.js'

const ORG='org-1'
const entry=id=>({id,event:{eventId:id,context:{organizationId:ORG}}})
const baseState=()=>({
 currentContext:{companyId:ORG},companies:[],users:[],roles:[],memberships:[],userSessions:[],auditLog:[],
 timelineEntries:[],operationalLedgerEntries:[],syncQueue:[],syncConflicts:[],syncHealthEvents:[],syncDeviceHealth:[],
 syncMeta:{ledgerCursorByCompany:{[ORG]:5},ledgerOutboxByCompany:{[ORG]:['event-a']}}
})

test('sync commit removes confirmed event but preserves event appended while sync was in flight',()=>{
 const initial=baseState()
 initial.operationalLedgerEntries=[entry('event-a')]
 const current=structuredClone(initial)
 current.operationalLedgerEntries=[entry('event-a'),entry('event-b')]
 current.syncMeta.ledgerOutboxByCompany[ORG]=['event-a','event-b']
 const processed=structuredClone(initial)
 processed.syncMeta.ledgerCursorByCompany[ORG]=6
 processed.syncMeta.ledgerOutboxByCompany[ORG]=[]
 const committed=commitIncrementalSyncResult(initial,current,processed)
 assert.deepEqual(committed.syncMeta.ledgerOutboxByCompany[ORG],['event-b'])
 assert.equal(committed.syncMeta.ledgerCursorByCompany[ORG],6)
 assert.deepEqual(committed.operationalLedgerEntries.map(item=>item.id),['event-a','event-b'])
})

test('sync commit preserves outbox partitions for other companies',()=>{
 const initial=baseState()
 initial.syncMeta.ledgerOutboxByCompany['org-2']=['other-a']
 const current=structuredClone(initial)
 current.syncMeta.ledgerOutboxByCompany['org-2']=['other-a','other-b']
 const processed=structuredClone(initial)
 processed.syncMeta.ledgerOutboxByCompany[ORG]=[]
 const committed=commitIncrementalSyncResult(initial,current,processed)
 assert.deepEqual(committed.syncMeta.ledgerOutboxByCompany[ORG],[])
 assert.deepEqual(committed.syncMeta.ledgerOutboxByCompany['org-2'],['other-a','other-b'])
})
