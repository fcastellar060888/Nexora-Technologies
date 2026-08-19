import test from'node:test'
import assert from'node:assert/strict'
import{compactCompanyState,compactIdentity,lightweightCacheKeys}from'../src/services/lightweightCache.js'

const state=()=>({
 schemaVersion:16,currentContext:{companyId:'org-a'},companies:[{id:'org-a'},{id:'org-b'}],
 auditLog:[{id:'audit-a',organizationId:'org-a'},{id:'audit-b',organizationId:'org-b'},{id:'audit-ownerless'}],
 products:[{id:'product-a',organizationId:'org-a'},{id:'product-b',organizationId:'org-b'},{id:'product-ownerless'}],
 users:[],roles:[],memberships:[],userSessions:[],syncQueue:[],syncConflicts:[],syncHealthEvents:[],syncDeviceHealth:[],operationalLedgerEntries:[],timelineEntries:[]
})

test('M4.6 F004: company cache never adopts foreign or ownerless records in multi-company state',()=>{
 const cached=compactCompanyState(state(),'org-a')
 assert.deepEqual(cached.collections.products.map(x=>x.id),['product-a'])
 assert.deepEqual(cached.collections.auditLog.map(x=>x.id),['audit-a'])
})

test('M4.6 F004: audit log is partitioned per company, not stored in global identity cache',()=>{
 const identity=compactIdentity(state())
 assert.equal(Object.hasOwn(identity,'auditLog'),false)
})

test('M4.6 F004: single-company legacy ownerless records remain cacheable by unequivocal ownership',()=>{
 const single={...state(),companies:[{id:'org-a'}],products:[{id:'legacy'}],auditLog:[{id:'audit-legacy'}]}
 const cached=compactCompanyState(single,'org-a')
 assert.deepEqual(cached.collections.products.map(x=>x.id),['legacy'])
 assert.deepEqual(cached.collections.auditLog.map(x=>x.id),['audit-legacy'])
})

test('M4.6 F004: cache namespace uses Nexora branding/version and no Cannapa legacy prefix',()=>{
 assert.match(lightweightCacheKeys.COMPANY_PREFIX,/nexora/i)
 assert.doesNotMatch(lightweightCacheKeys.COMPANY_PREFIX,/cann?apa/i)
})
