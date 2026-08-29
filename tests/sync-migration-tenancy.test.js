import test from'node:test'
import assert from'node:assert/strict'
import{buildMigrationManifest,migrationRows}from'../src/services/initialMigration.js'

const multiState=()=>({
 schemaVersion:16,
 currentContext:{companyId:'org-a'},
 companies:[{id:'org-a',name:'A'},{id:'org-b',name:'B'}],
 sites:[{id:'site-a',organizationId:'org-a'},{id:'site-b',organizationId:'org-b'}],
 products:[
  {id:'product-ownerless',name:'Legacy ambiguo'},
  {id:'product-transport-only',_organizationId:'org-a',name:'Envelope no es ownership'},
  {id:'product-a',organizationId:'org-a',name:'Producto A'},
  {id:'product-b',organizationId:'org-b',name:'Producto B'}
 ],
 users:[{id:'user-local',name:'Admin local'}],roles:[{id:'role-local',name:'Admin'}],memberships:[],
 syncQueue:[],syncConflicts:[],syncHealthEvents:[],syncDeviceHealth:[],auditLog:[],userSessions:[]
})

test('M4.5 F001: multi-company migration excludes local-only, foreign and transport-only records and fails closed on ambiguous ownership',()=>{
 const manifest=buildMigrationManifest(multiState(),{companyId:'org-a',migrationId:'migration-a'})
 assert.equal(manifest.validation.valid,false)
 assert.match(manifest.validation.errors.join(' '),/product-ownerless|product-transport-only|ownership|empresa|organización|ambigu/i)
 assert.equal(manifest.collections.some(group=>['companies','users','roles','memberships'].includes(group.collection)),false)
 const products=manifest.collections.find(group=>group.collection==='products')
 assert.deepEqual(products?.records.map(record=>record.id),['product-a'])
})

test('M4.5 F001: single-company ownerless operational data is materialized with first-class ownership',()=>{
 const state={...multiState(),companies:[{id:'org-a',name:'A'}],products:[{id:'product-legacy',name:'Legacy único'}],users:[],roles:[]}
 const manifest=buildMigrationManifest(state,{companyId:'org-a',migrationId:'migration-single'})
 assert.equal(manifest.validation.valid,true)
 const row=migrationRows(manifest).find(item=>item.record_id==='product-legacy')
 assert.equal(row.organization_id,'org-a')
 assert.equal(row.payload.organizationId,'org-a')
})
