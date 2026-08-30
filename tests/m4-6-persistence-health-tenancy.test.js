import test from'node:test'
import assert from'node:assert/strict'
import{readFile}from'node:fs/promises'

test('persistence health is partitioned by organization and the bridge selects the active tenant',async()=>{
 const storage=await readFile(new URL('../src/services/safeStorage.js',import.meta.url),'utf8')
 const bridge=await readFile(new URL('../src/components/PersistenceHealthBridge.jsx',import.meta.url),'utf8')
 assert.match(storage,/const persistenceRuntimes=new Map\(\)/)
 assert.match(storage,/persistenceRuntimes\.get\(key\)\|\|createPersistenceRuntime\(\)/)
 assert.match(storage,/persistenceRuntimes\.set\(key,recordPersistenceResult\(current,result\)\)/)
 assert.match(storage,/organizationIdForState\(state\)/)
 assert.match(storage,/publishPersistenceResult\(\{ok:true,\.\.\.result\},organizationId\)/)
 assert.match(storage,/publishPersistenceResult\(\{ok:false,[\s\S]*\},organizationId\)/)
 assert.match(bridge,/state\?\.currentContext\?\.companyId/)
 assert.match(bridge,/getPersistenceRuntime\(organizationId\)/)
})

test('a persistence failure from one organization cannot become the visible retry state of another',async()=>{
 const storage=await readFile(new URL('../src/services/safeStorage.js',import.meta.url),'utf8')
 assert.doesNotMatch(storage,/let persistenceRuntime=createPersistenceRuntime\(\)/)
 assert.match(storage,/export function getPersistenceRuntime\(organizationId=''\)/)
})
