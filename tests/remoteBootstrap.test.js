import test from'node:test'
import assert from'node:assert/strict'
import{groupRemoteRecords,hydrateAuthoritativeState,overlayPendingMutations}from'../src/services/remoteBootstrap.js'

const row=(collection,id,payload,extra={})=>({organization_id:'org-1',collection,record_id:id,payload,version:2,updated_at:'2026-07-31T12:00:00.000Z',deleted_at:null,...extra})
const ledgerEntry=(id='event-1',sequence=1)=>({
 id,sequence,recordedAt:'2026-07-31T11:59:00.000Z',
 event:{
  eventId:id,name:'production.plant.updated',version:1,
  aggregate:{type:'plant',id:'plant-1'},
  context:{organizationId:'org-1',siteId:null,actorId:'user-1'},
  occurredAt:'2026-07-31T11:58:00.000Z',correlationId:null,causationId:null,payload:{},metadata:{}
 }
})

test('groups active PostgreSQL records and ignores tombstones',()=>{
 const grouped=groupRemoteRecords([
  row('sites','s1',{id:'s1',name:'Villeta'}),
  row('sites','s2',{id:'s2',name:'Borrada'},{deleted_at:'2026-07-31T12:01:00.000Z'})
 ])
 assert.equal(grouped.sites.length,1)
 assert.equal(grouped.sites[0].name,'Villeta')
 assert.equal(grouped.sites[0]._serverVersion,2)
})

test('pending local mutations are preserved over authoritative records',()=>{
 const local={currentContext:{companyId:'org-1'},syncQueue:[{id:'m1',status:'pending',collection:'sites',recordId:'s1',operation:'upsert',payload:{id:'s1',name:'Cambio offline'}},{id:'m2',status:'pending',collection:'sites',recordId:'s2',operation:'delete'}]}
 const base={sites:[{id:'s1',name:'Servidor'},{id:'s2',name:'Eliminar'}]}
 const result=overlayPendingMutations(local,base)
 assert.deepEqual(result.sites,[{id:'s1',name:'Cambio offline',_organizationId:'org-1'}])
})

test('hydrates operational data from PostgreSQL while retaining local identity and queue',()=>{
 const local={
  sites:[{id:'old',name:'Local anterior'}],houses:[{id:'h-old'}],
  users:[{id:'u1',name:'Administrador',activeSession:true,remoteId:'remote-u1'}],roles:[{id:'r1'}],memberships:[{id:'m1'}],
  syncQueue:[{id:'q1',status:'pending',collection:'sites',recordId:'offline',operation:'upsert',payload:{id:'offline',name:'Sin red'}}],
  syncConflicts:[],syncHealthEvents:[],syncDeviceHealth:[],userSessions:[],auditLog:[],
  operationalLedgerEntries:[ledgerEntry()],timelineEntries:[{id:'timeline-1',organizationId:'org-1',occurredAt:'2026-07-31T11:58:00.000Z'}],
  currentContext:{companyId:'org-1'}
 }
 const result=hydrateAuthoritativeState(local,[row('sites','server',{id:'server',name:'Servidor'})],{companyId:'org-1',hydratedAt:'2026-07-31T13:00:00.000Z'})
 assert.deepEqual(result.sites.map(item=>item.id).sort(),['offline','server'])
 assert.deepEqual(result.houses,[])
 assert.equal(result.users[0].activeSession,true)
 assert.equal(result.syncQueue.length,1)
 assert.equal(result.syncQueue[0].companyId,'org-1')
 assert.equal(result.operationalLedgerEntries.length,1)
 assert.equal(result.operationalLedgerEntries[0].id,'event-1')
 assert.equal(result.timelineEntries.length,1)
 assert.equal(result.syncMeta.hydrationSource,'postgres')
 assert.equal(result.syncMeta.hydratedCompanyId,'org-1')
})
