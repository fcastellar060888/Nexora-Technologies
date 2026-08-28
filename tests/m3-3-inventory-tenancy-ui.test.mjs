import test from'node:test'
import assert from'node:assert/strict'
import fs from'node:fs'

const source=fs.readFileSync(new URL('../src/pages/InventoryPage.jsx',import.meta.url),'utf8')

test('F002 Inventory UI usa scope tenant-aware para productos, sedes y existencias',()=>{
 assert.match(source,/scopeInventoryState\(state\)/)
 assert.match(source,/inventory\.products\.map/)
 assert.match(source,/inventory\.sites\.map/)
 assert.match(source,/inventory\.inventoryLots\.map/)
 assert.doesNotMatch(source,/\{state\.products\.map/)
 assert.doesNotMatch(source,/\{state\.sites\.map/)
 assert.doesNotMatch(source,/\{state\.inventoryLots\.map/)
})

test('F002 Inventory UI evita key global de lote homónimo cross-tenant',()=>{
 assert.match(source,/key=\{`\$\{l\.organizationId\}:\$\{l\.id\}`\}/)
})
