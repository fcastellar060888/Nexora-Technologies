import test from'node:test'
import assert from'node:assert/strict'
import fs from'node:fs'

const source=fs.readFileSync(new URL('../src/pages/InventoryPage.jsx',import.meta.url),'utf8')

test('F003 InventoryPage escribe Product/Lot exclusivamente por command boundary',()=>{
 assert.match(source,/useInventoryCommandStore/)
 assert.match(source,/INVENTORY_OPERATIONS\.CREATE_PRODUCT/)
 assert.match(source,/INVENTORY_OPERATIONS\.CREATE_LOT/)
 assert.doesNotMatch(source,/\buseStore\b/)
 assert.doesNotMatch(source,/\bcreateInventoryLot\b/)
 assert.doesNotMatch(source,/\bupdate\s*\(/)
})
