import test from'node:test'
import assert from'node:assert/strict'
import{readFileSync}from'node:fs'
import{migrationRows}from'../src/services/initialMigration.js'

test('M4.5 F008: migrationRows rejects handcrafted ownerless or foreign payloads even if caller bypasses manifest validation',()=>{
 assert.throws(()=>migrationRows({companyId:'org-a',migrationId:'m1',collections:[{collection:'products',records:[{id:'ownerless'}]}]}),/organizationId|empresa|ownership/i)
 assert.throws(()=>migrationRows({companyId:'org-a',migrationId:'m1',collections:[{collection:'products',records:[{id:'foreign',organizationId:'org-b'}]}]}),/otra empresa|pertenece/i)
})

test('M4.5 F008: migration UI binds backup preview execute and rollback to the same prepared manifest',()=>{
 const source=readFileSync(new URL('../src/pages/InitialMigrationPage.jsx',import.meta.url),'utf8')
 assert.match(source,/preparedManifest/)
 assert.match(source,/previewInitialMigration\(preparedManifest\)/)
 assert.match(source,/executeInitialMigration\(preparedManifest/)
 assert.match(source,/migrationId:preparedManifest\.migrationId/)
 assert.match(source,/rollbackInitialMigration\(\{companyId:completed\.companyId,migrationId:completed\.migrationId\}\)/)
 assert.doesNotMatch(source,/executeInitialMigration\(manifest/)
 assert.doesNotMatch(source,/rollbackInitialMigration\(\{companyId,migrationId:manifest\.migrationId\}\)/)
})
