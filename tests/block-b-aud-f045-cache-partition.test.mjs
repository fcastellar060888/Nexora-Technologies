import test from'node:test'
import assert from'node:assert/strict'
import{compactCompanyState,writeLightweightCache,lightweightCacheKeys}from'../src/services/lightweightCache.js'

function memoryStorage(){
 const values=new Map()
 return{
  getItem:key=>values.has(key)?values.get(key):null,
  setItem:(key,value)=>values.set(key,String(value)),
  removeItem:key=>values.delete(key),
  snapshot:()=>new Map(values)
 }
}

test('AUD-F045: compactar una empresa excluye registros preservados de otros tenants',()=>{
 const compacted=compactCompanyState({sites:[
  {id:'a',name:'A',_organizationId:'company-a'},
  {id:'b',name:'B',_organizationId:'company-b'},
  {id:'legacy',name:'Legado sin marca'}
 ]},'company-a')
 assert.deepEqual(compacted.collections.sites.map(item=>item.id).sort(),['a','legacy'])
})

test('AUD-F045: aliases de propiedad organizacional se respetan al segmentar',()=>{
 const compacted=compactCompanyState({products:[
  {id:'a',companyId:'company-a'},
  {id:'b',organizationId:'company-b'},
  {id:'c',_organizationId:'company-c'}
 ]},'company-b')
 assert.deepEqual(compacted.collections.products.map(item=>item.id),['b'])
})

test('AUD-F045: guardar Empresa A no copia registros de Empresa B a su archivo cacheado',()=>{
 const storage=memoryStorage()
 writeLightweightCache({
  currentContext:{companyId:'company-a'},
  companies:[],users:[],roles:[],memberships:[],userSessions:[],auditLog:[],syncQueue:[],syncConflicts:[],syncHealthEvents:[],syncDeviceHealth:[],
  sites:[
   {id:'shared',name:'A',_organizationId:'company-a'},
   {id:'shared',name:'B',_organizationId:'company-b'}
  ]
 },storage)
 const raw=storage.getItem(`${lightweightCacheKeys.COMPANY_PREFIX}company-a`)
 const cached=JSON.parse(raw)
 assert.equal(cached.collections.sites.length,1)
 assert.equal(cached.collections.sites[0].name,'A')
 assert.equal(cached.collections.sites[0]._organizationId,'company-a')
})
