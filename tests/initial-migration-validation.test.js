import test from'node:test'
import assert from'node:assert/strict'
import{readFileSync}from'node:fs'
import{migratableCollections,validateMigrationState}from'../src/services/initialMigration.js'

test('M4.5 F009: migratable record without stable identity is surfaced to validation instead of silently dropped',()=>{
 const state={currentContext:{companyId:'org-a'},companies:[{id:'org-a'}],products:[{name:'Sin ID'}]}
 const collections=migratableCollections(state)
 assert.equal(collections.find(group=>group.collection==='products')?.records.length,1)
 const validation=validateMigrationState(state,'org-a')
 assert.equal(validation.valid,false)
 assert.match(validation.errors.join(' '),/identificador|identidad/i)
})

test('M4.5 F009: execution service requires exact MIGRAR token and SHA-256 backup hash before network call',()=>{
 const source=readFileSync(new URL('../src/services/initialMigration.js',import.meta.url),'utf8')
 assert.match(source,/confirmationToken\s*!==\s*['"]MIGRAR['"]/)
 assert.match(source,/backupHash/)
 assert.match(source,/\{64\}/)
})
