import test from'node:test'
import assert from'node:assert/strict'
import fs from'node:fs'

const pageSource=fs.readFileSync(new URL('../src/pages/InventoryPage.jsx',import.meta.url),'utf8')
const storeSource=fs.readFileSync(new URL('../src/services/inventoryCommandStore.js',import.meta.url),'utf8')

test('F002 Inventory UI usa scope tenant-aware para productos, sedes y existencias',()=>{
 assert.match(pageSource,/useInventoryCommandStore/)
 assert.match(storeSource,/scopeInventoryUiState\(store\.state\)/)
 assert.match(pageSource,/inventory\.products\.map/)
 assert.match(pageSource,/inventory\.sites\.map/)
 assert.match(pageSource,/inventory\.inventoryLots\.map/)
 assert.doesNotMatch(pageSource,/\{state\.products\.map/)
 assert.doesNotMatch(pageSource,/\{state\.sites\.map/)
 assert.doesNotMatch(pageSource,/\{state\.inventoryLots\.map/)
})

test('F002 Inventory UI evita key global de lote homónimo cross-tenant',()=>{
 assert.match(pageSource,/key=\{`\$\{l\.organizationId\}:\$\{l\.id\}`\}/)
})
