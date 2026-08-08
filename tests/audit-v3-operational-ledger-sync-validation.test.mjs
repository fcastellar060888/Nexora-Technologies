import test from'node:test'
import assert from'node:assert/strict'
import{
 operationalLedgerCursor,operationalLedgerOutbox,pendingOperationalLedgerEntries,
 buildOperationalLedgerPullPath,mapOperationalLedgerRow,mergeOperationalLedgerPartition,
 synchronizeOperationalLedger
}from'../src/services/operationalLedgerSync.js'

const ORG='11111111-1111-4111-8111-111111111111'
const OTHER='33333333-3333-4333-8333-333333333333'
const event=(id='event-1',organizationId=ORG)=>({
 eventId:id,name:'production.plant.updated',version:1,
 aggregate:{type:'plant',id:'plant-1'},context:{organizationId,siteId:null,actorId:'user-1'},
 occurredAt:'2026-08-08T01:00:00.000Z',correlationId:null,causationId:null,payload:{},metadata:{}
})
const entry=(id='event-1',sequence=1,organizationId=ORG)=>({id,sequence,recordedAt:'2026-08-08T01:00:01.000Z',event:event(id,organizationId)})
const row=(id='event-1',sequence=1,organizationId=ORG)=>({organization_id:organizationId,sequence,event_id:id,event:event(id,organizationId),recorded_at:'2026-08-08T01:00:01.000Z'})

test('cursor and outbox sanitize invalid or duplicated local metadata',()=>{
 const state={currentContext:{companyId:ORG},syncMeta:{ledgerCursorByCompany:{[ORG]:-7},ledgerOutboxByCompany:{[ORG]:['event-1','event-1','',null]}}}
 assert.equal(operationalLedgerCursor(state),0)
 assert.deepEqual(operationalLedgerOutbox(state),['event-1'])
 assert.deepEqual(operationalLedgerOutbox(state,''),[])
})

test('pending entries are selected only by explicit eventId outbox and fail closed on orphan IDs',()=>{
 const valid={currentContext:{companyId:ORG},operationalLedgerEntries:[entry('a',99),entry('b',1)],syncMeta:{ledgerOutboxByCompany:{[ORG]:['b']}}}
 assert.deepEqual(pendingOperationalLedgerEntries(valid).map(item=>item.id),['b'])
 const broken={...valid,syncMeta:{ledgerOutboxByCompany:{[ORG]:['missing']}}}
 assert.throws(()=>pendingOperationalLedgerEntries(broken),/evento local inexistente/)
 assert.deepEqual(pendingOperationalLedgerEntries(valid,''),[])
})

test('pull path validates company and cursor',()=>{
 assert.throws(()=>buildOperationalLedgerPullPath('',0),/requiere empresa/i)
 assert.throws(()=>buildOperationalLedgerPullPath(ORG,-1),/cursor/i)
 const path=buildOperationalLedgerPullPath(ORG,7,{limit:25})
 assert.match(path,/organization_id=eq\./)
 assert.match(path,/sequence=gt\.7/)
 assert.match(path,/limit=25/)
})

test('remote row mapping rejects cross-tenant and malformed canonical data',()=>{
 assert.throws(()=>mapOperationalLedgerRow(row('e',1,OTHER),ORG),/otra empresa/)
 assert.throws(()=>mapOperationalLedgerRow({...row(),event:null},ORG),/evento inválido/)
 assert.throws(()=>mapOperationalLedgerRow({...row(),event:event('event-1',OTHER)},ORG),/no pertenece/)
 assert.throws(()=>mapOperationalLedgerRow({...row(),event_id:'different'},ORG),/identidad remota/)
 assert.throws(()=>mapOperationalLedgerRow({...row(),recorded_at:'not-a-date'},ORG),/fecha remota/)
 assert.throws(()=>mapOperationalLedgerRow({...row(),sequence:0},ORG),/secuencia remota/)
 const mapped=mapOperationalLedgerRow(row(),ORG)
 assert.equal(mapped.id,'event-1')
 assert.equal(Object.isFrozen(mapped),true)
})

test('partition merge preserves foreign tenants and rejects identity/sequence corruption',()=>{
 const merged=mergeOperationalLedgerPartition([entry('foreign',1,OTHER),entry('local',1)],[entry('remote',2)],ORG)
 assert.deepEqual(merged.map(item=>item.id),['foreign','local','remote'])
 assert.throws(()=>mergeOperationalLedgerPartition([], [entry('foreign',1,OTHER)],ORG),/otra empresa/)
 const missing={...entry('x',1),id:'',event:{...event(''),eventId:''}}
 assert.throws(()=>mergeOperationalLedgerPartition([], [missing],ORG),/requiere eventId/)
 assert.throws(()=>mergeOperationalLedgerPartition([], [entry('a',1),entry('b',1)],ORG),/Colisión de secuencia/)
 const replaced=mergeOperationalLedgerPartition([entry('old',1)], [entry('new',3)],ORG,{replaceCurrent:true})
 assert.deepEqual(replaced.map(item=>item.id),['new'])
})

test('synchronization rejects missing or stale tenant context before network access',async()=>{
 let calls=0
 const request=async()=>{calls++;return[]}
 await assert.rejects(()=>synchronizeOperationalLedger({currentContext:{}},{companyId:'',request}),/Selecciona una empresa/)
 await assert.rejects(()=>synchronizeOperationalLedger({currentContext:{companyId:OTHER}},{companyId:ORG,request}),/contexto activo/)
 assert.equal(calls,0)
})

test('invalid append confirmation fails closed and keeps caller state untouched',async()=>{
 const state={currentContext:{companyId:ORG},operationalLedgerEntries:[entry()],syncMeta:{ledgerCursorByCompany:{[ORG]:0},ledgerOutboxByCompany:{[ORG]:['event-1']}}}
 const request=async path=>{
  if(path.includes('/rpc/'))return[{sequence:1,recorded_at:'bad-date'}]
  return[]
 }
 await assert.rejects(()=>synchronizeOperationalLedger(state,{request}),/recorded_at válido/)
 assert.deepEqual(state.syncMeta.ledgerOutboxByCompany[ORG],['event-1'])
})

test('pull pagination advances strictly and rejects a non-advancing remote page',async()=>{
 const state={currentContext:{companyId:ORG},operationalLedgerEntries:[],syncMeta:{ledgerCursorByCompany:{[ORG]:4},ledgerOutboxByCompany:{[ORG]:[]}}}
 let calls=0
 const request=async path=>{
  if(path.includes('/rpc/'))throw new Error('unexpected append')
  calls++
  if(calls===1)return Array.from({length:1000},(_,index)=>row(`event-${index+5}`,index+5))
  return[row('event-final',1005)]
 }
 const synced=await synchronizeOperationalLedger(state,{request})
 assert.equal(calls,2)
 assert.equal(synced.cursor,1005)
 assert.equal(synced.pulled,1001)

 const brokenRequest=async()=>[row('stale',4)]
 await assert.rejects(()=>synchronizeOperationalLedger(state,{request:brokenRequest}),/no avanzó el cursor/)
})
