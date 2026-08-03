import test from'node:test'
import assert from'node:assert/strict'
import{eligibleQueue}from'../src/services/syncTransport.js'
import{applyRemoteRecords}from'../src/services/syncEngine.js'
import{groupRemoteRecords,hydrateAuthoritativeState,overlayPendingMutations}from'../src/services/remoteBootstrap.js'

const mutation=(id,companyId)=>({id,companyId,collection:'products',recordId:id,status:'pending',attempts:0})

test('AUD-F016: la cola elegible solo devuelve mutaciones de la empresa solicitada',()=>{
 const queue=[mutation('a-1','company-a'),mutation('b-1','company-b')]
 assert.deepEqual(eligibleQueue(queue,Date.now(),'company-a').map(item=>item.id),['a-1'])
 assert.deepEqual(eligibleQueue(queue,Date.now(),'company-b').map(item=>item.id),['b-1'])
})

test('AUD-F016: registros remotos de otro tenant se rechazan atómicamente',()=>{
 const state={currentContext:{companyId:'company-a'},products:[{id:'local',name:'Local'}]}
 const rows=[
  {companyId:'company-a',collection:'products',recordId:'a-1',payload:{name:'A'},version:1,updatedAt:'2026-08-03T08:00:00.000Z'},
  {companyId:'company-b',collection:'products',recordId:'b-1',payload:{name:'B'},version:1,updatedAt:'2026-08-03T08:00:00.000Z'}
 ]
 assert.throws(()=>applyRemoteRecords(state,rows,{companyId:'company-a'}),/otra empresa/)
 assert.deepEqual(state.products,[{id:'local',name:'Local'}])
})

test('AUD-F016: bootstrap rechaza una respuesta que mezcle organizaciones',()=>{
 const rows=[
  {organization_id:'company-a',collection:'products',record_id:'a-1',payload:{name:'A'},version:1,updated_at:'2026-08-03T08:00:00.000Z'},
  {organization_id:'company-b',collection:'products',record_id:'b-1',payload:{name:'B'},version:1,updated_at:'2026-08-03T08:00:00.000Z'}
 ]
 assert.throws(()=>groupRemoteRecords(rows,{companyId:'company-a'}),/otra empresa/)
})

test('AUD-F016: hidratación no acepta un companyId distinto al contexto activo',()=>{
 const state={currentContext:{companyId:'company-a'},products:[],syncQueue:[],syncConflicts:[],syncHealthEvents:[],syncDeviceHealth:[],companies:[],users:[],roles:[],memberships:[],userSessions:[],auditLog:[]}
 assert.throws(()=>hydrateAuthoritativeState(state,[],{companyId:'company-b'}),/contexto activo/)
})

test('AUD-F016: mutaciones pendientes de otro tenant no se superponen al bootstrap activo',()=>{
 const state={
  currentContext:{companyId:'company-a'},
  products:[],
  syncQueue:[
   {id:'qa',companyId:'company-a',collection:'products',recordId:'a-1',operation:'upsert',payload:{id:'a-1',name:'A'},status:'pending'},
   {id:'qb',companyId:'company-b',collection:'products',recordId:'b-1',operation:'upsert',payload:{id:'b-1',name:'B'},status:'pending'}
  ]
 }
 const result=overlayPendingMutations(state,{products:[]})
 assert.deepEqual(result.products,[{id:'a-1',name:'A'}])
})
