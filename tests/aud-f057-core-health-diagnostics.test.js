import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {registerCoreHealthProvider,getCoreHealthSnapshot,resetCoreHealthRegistryForTests} from '../src/core/health/coreHealthRegistry.js'

test.afterEach(()=>resetCoreHealthRegistryForTests())

test('core health registry reports absence of providers instead of simulating health',()=>{
 const snapshot=getCoreHealthSnapshot({organizationId:'org-a'})
 assert.equal(snapshot.status,'degraded')
 assert.equal(snapshot.providers,0)
 assert.equal(snapshot.checks.some(check=>check.id==='core-health-registry:no-providers'&&check.status===false&&check.level==='warning'),true)
})

test('core health registry exposes provider failures as critical diagnostics',()=>{
 registerCoreHealthProvider('failing-provider',()=>{throw new Error('core unavailable')})
 const snapshot=getCoreHealthSnapshot({organizationId:'org-a'})
 assert.equal(snapshot.status,'critical')
 assert.equal(snapshot.errors,1)
 assert.equal(snapshot.checks[0].providerId,'failing-provider')
 assert.match(snapshot.checks[0].detail,/core unavailable/)
})

test('system diagnostics consumes and renders the Core health snapshot',()=>{
 const source=fs.readFileSync(new URL('../src/pages/SystemDiagnosticsPage.jsx',import.meta.url),'utf8')
 assert.match(source,/getCoreHealthSnapshot/)
 assert.match(source,/checks=\[\.\.\.dataChecks,\.\.\.core\.checks\]/)
 assert.match(source,/>Core<\/span>/)
 assert.match(source,/core\.status/)
})
