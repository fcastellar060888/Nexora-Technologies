import test from'node:test'
import assert from'node:assert/strict'
import{readFile}from'node:fs/promises'
import{overlayConcurrentChanges,hydrateAuthoritativeState}from'../src/services/remoteBootstrap.js'

const baseState=overrides=>({
 currentContext:{companyId:'company-1'},
 sites:[{id:'site-1',name:'Inicial'}],
 houses:[],
 syncQueue:[],syncConflicts:[],syncHealthEvents:[],syncDeviceHealth:[],
 companies:[],users:[],roles:[],memberships:[],userSessions:[],auditLog:[],
 syncMeta:{},
 ...overrides
})

const row=({companyId='company-1',collection='sites',recordId='site-1',payload={id:'site-1',name:'Remoto'},version=2,deletedAt=null}={})=>({
 organization_id:companyId,collection,record_id:recordId,payload,version,
 updated_at:'2026-08-03T04:00:00.000Z',deleted_at:deletedAt
})

test('superpone una actualización local ocurrida mientras se cargaba PostgreSQL',()=>{
 const initial=baseState()
 const current=baseState({sites:[{id:'site-1',name:'Cambio local concurrente'}]})
 const remote={...current,sites:[{id:'site-1',name:'Remoto'}]}
 const result=overlayConcurrentChanges(initial,current,remote)
 assert.deepEqual(result.sites,[{id:'site-1',name:'Cambio local concurrente'}])
})

test('conserva altas y eliminaciones locales concurrentes frente al snapshot remoto',()=>{
 const initial=baseState({sites:[{id:'site-1',name:'Inicial'},{id:'site-2',name:'Eliminar'}]})
 const current=baseState({sites:[{id:'site-1',name:'Inicial'},{id:'site-3',name:'Nuevo local'}]})
 const remote={...current,sites:[{id:'site-1',name:'Remoto'},{id:'site-2',name:'Remoto antiguo'}]}
 const result=overlayConcurrentChanges(initial,current,remote)
 assert.equal(result.sites.some(item=>item.id==='site-2'),false)
 assert.deepEqual(result.sites.find(item=>item.id==='site-3'),{id:'site-3',name:'Nuevo local'})
 assert.deepEqual(result.sites.find(item=>item.id==='site-1'),{id:'site-1',name:'Remoto'})
})

test('hidrata datos remotos sin sobrescribir el delta local posterior al inicio',()=>{
 const initial=baseState()
 const current=baseState({sites:[{id:'site-1',name:'Cambio local concurrente'}]})
 const hydrated=hydrateAuthoritativeState(current,[row()],{
  companyId:'company-1',initialState:initial,hydratedAt:'2026-08-03T04:01:00.000Z'
 })
 assert.equal(hydrated.sites.find(item=>item.id==='site-1').name,'Cambio local concurrente')
 assert.equal(hydrated.syncMeta.hydratedCompanyId,'company-1')
 assert.equal(hydrated.syncMeta.lastHydratedAt,'2026-08-03T04:01:00.000Z')
})

test('AUD-F045: hidratar una empresa conserva íntegra la partición operativa de otra',()=>{
 const foreign={id:'site-shared',name:'Empresa B',_organizationId:'company-2'}
 const local=baseState({sites:[
  {id:'site-old',name:'Empresa A antigua',_organizationId:'company-1'},
  foreign
 ]})
 const hydrated=hydrateAuthoritativeState(local,[row({recordId:'site-new',payload:{id:'site-new',name:'Empresa A remota'}})],{companyId:'company-1',initialState:local})
 assert.deepEqual(hydrated.sites.find(item=>item._organizationId==='company-2'),foreign)
 assert.equal(hydrated.sites.some(item=>item.id==='site-old'),false)
 assert.equal(hydrated.sites.find(item=>item.id==='site-new')._organizationId,'company-1')
})

test('AUD-F045: IDs iguales permanecen aislados por organización durante bootstrap',()=>{
 const local=baseState({sites:[
  {id:'site-shared',name:'Empresa A local',_organizationId:'company-1'},
  {id:'site-shared',name:'Empresa B intacta',_organizationId:'company-2'}
 ]})
 const hydrated=hydrateAuthoritativeState(local,[row({recordId:'site-shared',payload:{id:'site-shared',name:'Empresa A remota'}})],{companyId:'company-1',initialState:local})
 assert.equal(hydrated.sites.length,2)
 assert.equal(hydrated.sites.find(item=>item._organizationId==='company-1').name,'Empresa A remota')
 assert.equal(hydrated.sites.find(item=>item._organizationId==='company-2').name,'Empresa B intacta')
})

test('AUD-F045: un snapshot remoto vacío elimina solo la partición activa',()=>{
 const local=baseState({houses:[
  {id:'house-a',name:'A',_organizationId:'company-1'},
  {id:'house-b',name:'B',_organizationId:'company-2'}
 ]})
 const hydrated=hydrateAuthoritativeState(local,[],{companyId:'company-1',initialState:local})
 assert.equal(hydrated.houses.length,1)
 assert.equal(hydrated.houses[0].id,'house-b')
 assert.equal(hydrated.houses[0].name,'B')
 assert.equal(hydrated.houses[0]._organizationId,'company-2')
})

test('AUD-F045: mutaciones pendientes del tenant activo no colisionan con el mismo ID extranjero',()=>{
 const local=baseState({
  sites:[{id:'site-shared',name:'Empresa B',_organizationId:'company-2'}],
  syncQueue:[{id:'q-1',companyId:'company-1',collection:'sites',recordId:'site-shared',operation:'upsert',status:'pending',payload:{id:'site-shared',name:'Empresa A pendiente'}}]
 })
 const hydrated=hydrateAuthoritativeState(local,[],{companyId:'company-1',initialState:local})
 assert.equal(hydrated.sites.length,2)
 assert.equal(hydrated.sites.find(item=>item._organizationId==='company-1').name,'Empresa A pendiente')
 assert.equal(hydrated.sites.find(item=>item._organizationId==='company-2').name,'Empresa B')
})

test('el Store entrega al bootstrap un lector del estado vigente',async()=>{
 const source=await readFile(new URL('../src/services/store.jsx',import.meta.url),'utf8')
 assert.match(source,/const initialState=stateRef\.current/)
 assert.match(source,/bootstrapOrganization\(initialState,companyId,\{getCurrentState:\(\)=>stateRef\.current\}\)/)
 assert.doesNotMatch(source,/bootstrapOrganization\(stateRef\.current,companyId\)/)
})
