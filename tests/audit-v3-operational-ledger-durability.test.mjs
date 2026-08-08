import test from'node:test'
import assert from'node:assert/strict'
import{readFile}from'node:fs/promises'
import{compactCompanyState}from'../src/services/lightweightCache.js'
import{synchronizeOperationalLedger}from'../src/services/operationalLedgerSync.js'

const ORG='11111111-1111-4111-8111-111111111111'

function domainEvent(eventId,aggregateId,actorId='22222222-2222-4222-8222-222222222222'){
 return{
  eventId,name:'production.plant.updated',version:1,
  aggregate:{type:'plant',id:aggregateId},
  context:{organizationId:ORG,siteId:null,actorId},
  occurredAt:'2026-08-07T20:00:00.000Z',correlationId:null,causationId:null,
  payload:{aggregateId},metadata:{}
 }
}

function ledgerEntry(eventId,aggregateId,sequence){
 const event=domainEvent(eventId,aggregateId)
 return{id:eventId,sequence,recordedAt:'2026-08-07T20:00:01.000Z',event}
}

function deviceState(entries=[],cursor=0,{pending=entries.map(entry=>entry.id)}={}){
 return{
  currentContext:{companyId:ORG},operationalLedgerEntries:entries,
  syncMeta:{ledgerCursorByCompany:{[ORG]:cursor},ledgerOutboxByCompany:{[ORG]:pending}}
 }
}

function fakeLedgerServer(seed=[]){
 const rows=[]
 const byId=new Map()
 let nextSequence=1
 for(const item of seed){
  const row={organization_id:ORG,sequence:nextSequence,event_id:item.event.eventId,event:item.event,recorded_at:item.recordedAt}
  rows.push(row);byId.set(row.event_id,row);nextSequence++
 }
 async function request(path,{body}={}){
  if(path==='/rest/v1/rpc/append_operational_ledger_event'){
   assert.equal(body.p_organization_id,ORG)
   const event=body.p_event
   const existing=byId.get(event.eventId)
   if(existing){
    assert.deepEqual(existing.event,event)
    return[{sequence:existing.sequence,recorded_at:existing.recorded_at,duplicate:true}]
   }
   const sequence=nextSequence++
   const recorded_at=new Date(Date.UTC(2026,7,8,1,0,sequence)).toISOString()
   const row={organization_id:ORG,sequence,event_id:event.eventId,event,recorded_at}
   rows.push(row);byId.set(event.eventId,row)
   return[{sequence,recorded_at,duplicate:false}]
  }
  if(path.startsWith('/rest/v1/operational_ledger_events?')){
   const params=new URL(`https://nexora.invalid${path}`).searchParams
   const organizationId=String(params.get('organization_id')||'').replace(/^eq\./,'')
   const cursor=Number(String(params.get('sequence')||'gt.0').replace(/^gt\./,''))
   const limit=Number(params.get('limit')||1000)
   return rows.filter(row=>row.organization_id===organizationId&&row.sequence>cursor).sort((a,b)=>a.sequence-b.sequence).slice(0,limit)
  }
  throw new Error(`Unexpected request: ${path}`)
 }
 return{request,rows}
}

test('server sequence resolves two devices that both created local sequence 1',async()=>{
 const server=fakeLedgerServer()
 const deviceA=deviceState([ledgerEntry('event-a','plant-a',1)])
 const deviceB=deviceState([ledgerEntry('event-b','plant-b',1)])

 const syncedA=await synchronizeOperationalLedger(deviceA,{request:server.request})
 assert.deepEqual(syncedA.state.operationalLedgerEntries.map(item=>[item.id,item.sequence]),[['event-a',1]])
 assert.deepEqual(syncedA.state.syncMeta.ledgerOutboxByCompany[ORG],[])
 assert.equal(syncedA.cursor,1)

 const syncedB=await synchronizeOperationalLedger(deviceB,{request:server.request})
 assert.deepEqual(syncedB.state.operationalLedgerEntries.map(item=>[item.id,item.sequence]),[['event-a',1],['event-b',2]])
 assert.deepEqual(syncedB.state.syncMeta.ledgerOutboxByCompany[ORG],[])
 assert.equal(syncedB.cursor,2)

 const reconciledA=await synchronizeOperationalLedger(syncedA.state,{request:server.request})
 assert.deepEqual(reconciledA.state.operationalLedgerEntries.map(item=>[item.id,item.sequence]),[['event-a',1],['event-b',2]])
 assert.equal(reconciledA.cursor,2)
 assert.equal(server.rows.length,2)
})

test('outbox uploads a new local event even when its local sequence is below the remote cursor',async()=>{
 const historical=Array.from({length:5},(_,index)=>ledgerEntry(`remote-${index+1}`,`plant-${index+1}`,index+1))
 const server=fakeLedgerServer(historical)
 const local=ledgerEntry('offline-new','plant-offline',1)
 const state=deviceState([local],5,{pending:['offline-new']})
 const synced=await synchronizeOperationalLedger(state,{request:server.request})
 assert.equal(server.rows.length,6)
 assert.equal(server.rows.at(-1).event_id,'offline-new')
 assert.equal(server.rows.at(-1).sequence,6)
 assert.equal(synced.cursor,6)
 assert.deepEqual(synced.state.syncMeta.ledgerOutboxByCompany[ORG],[])
 assert.equal(synced.state.operationalLedgerEntries.find(item=>item.id==='offline-new').sequence,6)
})

test('retry after append succeeds but pull fails is idempotent by eventId',async()=>{
 const server=fakeLedgerServer(),initial=deviceState([ledgerEntry('event-retry','plant-r',1)])
 let failPull=true
 const flaky=async(path,options)=>{
  if(path.startsWith('/rest/v1/operational_ledger_events?')&&failPull){failPull=false;throw new Error('network interrupted after append')}
  return server.request(path,options)
 }
 await assert.rejects(()=>synchronizeOperationalLedger(initial,{request:flaky}),/network interrupted/)
 assert.equal(server.rows.length,1)
 assert.deepEqual(initial.syncMeta.ledgerOutboxByCompany[ORG],['event-retry'])
 const retry=await synchronizeOperationalLedger(initial,{request:server.request})
 assert.equal(server.rows.length,1)
 assert.deepEqual(retry.state.operationalLedgerEntries.map(item=>[item.id,item.sequence]),[['event-retry',1]])
 assert.deepEqual(retry.state.syncMeta.ledgerOutboxByCompany[ORG],[])
})

test('missing event referenced by outbox fails closed before remote mutation',async()=>{
 const server=fakeLedgerServer()
 const broken=deviceState([],0,{pending:['missing-event']})
 await assert.rejects(()=>synchronizeOperationalLedger(broken,{request:server.request}),/evento local inexistente/)
 assert.equal(server.rows.length,0)
})

test('local cache never evicts outbox Ledger entries when confirmed window is compacted',()=>{
 const entries=Array.from({length:10003},(_,index)=>ledgerEntry(`event-${index+1}`,`plant-${index+1}`,index+1))
 const state={
  currentContext:{companyId:ORG},
  syncMeta:{ledgerCursorByCompany:{[ORG]:10003},ledgerOutboxByCompany:{[ORG]:['event-1','event-2']}},
  companies:[{id:ORG}],users:[],roles:[],memberships:[],userSessions:[],auditLog:[],syncQueue:[],syncConflicts:[],syncHealthEvents:[],syncDeviceHealth:[],
  operationalLedgerEntries:entries
 }
 const compacted=compactCompanyState(state,ORG).collections.operationalLedgerEntries
 assert.equal(compacted.length,10002)
 assert.deepEqual(compacted.slice(-2).map(item=>item.id),['event-1','event-2'])
 assert.ok(compacted.some(item=>item.id==='event-10003'))
})

test('database contract is append-only, organization-scoped and server-sequenced',async()=>{
 const sql=await readFile(new URL('../supabase/migrations/20260808000000_operational_ledger.sql',import.meta.url),'utf8')
 assert.match(sql,/create table if not exists public\.operational_ledger_events/i)
 assert.match(sql,/unique \(organization_id, sequence\)/i)
 assert.match(sql,/primary key \(organization_id, event_id\)/i)
 assert.match(sql,/public\.is_org_member\(p_organization_id\)/i)
 assert.match(sql,/for update/i)
 assert.match(sql,/eventId already belongs to different content/i)
 assert.match(sql,/before update or delete on public\.operational_ledger_events/i)
 assert.match(sql,/grant select on public\.operational_ledger_events to authenticated/i)
 assert.match(sql,/grant execute on function public\.append_operational_ledger_event\(uuid,jsonb\) to authenticated/i)
 assert.doesNotMatch(sql,/grant (insert|update|delete) on public\.operational_ledger_events to authenticated/i)
})
