import test from'node:test'
import assert from'node:assert/strict'
import{observabilityViewForActiveOrganization,resolveObservabilityOwner}from'../src/domain/observability.js'
import fs from'node:fs'

const base={companies:[{id:'org-a'},{id:'org-b'}],currentContext:{companyId:'org-a',siteId:'site-a'}}

test('F001 audit view rejects foreign and ambiguous ownerless homonyms',()=>{
 const state={...base,sites:[{id:'same',organizationId:'org-a'},{id:'same',organizationId:'org-b'}],plantPositions:[{id:'plant',organizationId:'org-a',siteId:'same'},{id:'plant',organizationId:'org-b',siteId:'same'}],auditLog:[
  {id:'a',organizationId:'org-a',detail:'plant'},
  {id:'b',organizationId:'org-b',detail:'plant'},
  {id:'legacy',detail:'same'}
 ]}
 const view=observabilityViewForActiveOrganization(state)
 assert.deepEqual(view.auditLog.map(x=>x.id),['a'])
 assert.deepEqual(view.plantPositions.map(x=>x.organizationId),['org-a'])
 assert.equal(resolveObservabilityOwner(state,'auditLog',state.auditLog[2]),'')
})

test('F001 audit writer stamps organization and site first-class',()=>{
 const source=fs.readFileSync(new URL('../src/services/store.jsx',import.meta.url),'utf8')
 assert.match(source,/const organizationId=activeOrganizationId\(candidate\)/)
 assert.match(source,/organizationId,\s*\n\s*siteId,/)
 assert.match(source,/actorId:actorUser\?\.remoteId\|\|actorUser\?\.id/)
})

test('F001 ownerless legacy is only adopted when organization is unequivocal',()=>{
 const single={companies:[{id:'only'}],currentContext:{companyId:'only'},auditLog:[{id:'legacy'}]}
 assert.equal(resolveObservabilityOwner(single,'auditLog',single.auditLog[0]),'only')
 const multi={companies:[{id:'a'},{id:'b'}],currentContext:{companyId:'a'},auditLog:[{id:'legacy'}]}
 assert.equal(resolveObservabilityOwner(multi,'auditLog',multi.auditLog[0]),'')
})
