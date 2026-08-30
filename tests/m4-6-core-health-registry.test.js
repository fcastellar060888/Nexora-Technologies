import test from'node:test'
import assert from'node:assert/strict'
import{getCoreHealthSnapshot,registerCoreHealthProvider,resetCoreHealthRegistryForTests}from'../src/core/health/coreHealthRegistry.js'

test('Core Health Registry aggregates deterministic provider checks with tenant context',()=>{
 resetCoreHealthRegistryForTests()
 let seenOrganization=''
 const unregister=registerCoreHealthProvider('ledger',context=>{seenOrganization=context.organizationId;return{id:'runtime',name:'Ledger runtime',status:true,detail:'Operativo',level:'ok'}})
 const snapshot=getCoreHealthSnapshot({organizationId:'org-a'})
 assert.equal(seenOrganization,'org-a')
 assert.equal(snapshot.status,'healthy')
 assert.equal(snapshot.providers,1)
 assert.equal(snapshot.checks[0].providerId,'ledger')
 unregister()
 resetCoreHealthRegistryForTests()
})

test('Core Health Registry fails closed when a provider throws',()=>{
 resetCoreHealthRegistryForTests()
 registerCoreHealthProvider('broken',()=>{throw new Error('boom')})
 const snapshot=getCoreHealthSnapshot({organizationId:'org-a'})
 assert.equal(snapshot.status,'critical')
 assert.equal(snapshot.errors,1)
 assert.equal(snapshot.checks[0].status,false)
 assert.match(snapshot.checks[0].detail,/boom/)
 resetCoreHealthRegistryForTests()
})

test('Core Health Registry exposes missing runtime providers instead of reporting false health',()=>{
 resetCoreHealthRegistryForTests()
 const snapshot=getCoreHealthSnapshot({organizationId:'org-a'})
 assert.equal(snapshot.status,'degraded')
 assert.equal(snapshot.warnings,1)
 assert.match(snapshot.checks[0].detail,/No hay proveedores/)
})
