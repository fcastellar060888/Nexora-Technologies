import test from'node:test'
import assert from'node:assert/strict'
import{buildMigrationManifest,migrationRows,validateMigrationState}from'../src/services/initialMigration.js'

test('crea manifiesto excluyendo colecciones operativas internas',()=>{
 const state={schemaVersion:7,currentContext:{companyId:'org-1'},companies:[{id:'org-1',name:'Cannapa'}],sites:[{id:'site-1',companyId:'org-1'}],syncQueue:[{id:'q1'}],auditLog:[{id:'a1'}]}
 const manifest=buildMigrationManifest(state,{companyId:'org-1',migrationId:'migration-1'})
 assert.equal(manifest.total,2)
 assert.deepEqual(manifest.collections.map(item=>item.collection),['companies','sites'])
 assert.equal(migrationRows(manifest).every(row=>row.organization_id==='org-1'),true)
})

test('detecta identificadores duplicados antes de migrar',()=>{
 const state={currentContext:{companyId:'org-1'},products:[{id:'p1'},{id:'p1'}]}
 const result=validateMigrationState(state,'org-1')
 assert.equal(result.valid,false)
 assert.match(result.errors.join(' '),/duplicado p1/)
})

test('advierte y excluye registros de otra empresa',()=>{
 const state={schemaVersion:7,currentContext:{companyId:'org-1'},sites:[{id:'s1',companyId:'org-1'},{id:'s2',companyId:'org-2'}]}
 const manifest=buildMigrationManifest(state,{companyId:'org-1',migrationId:'migration-2'})
 assert.equal(manifest.collections[0].count,1)
 assert.equal(manifest.validation.warnings.length,1)
})
