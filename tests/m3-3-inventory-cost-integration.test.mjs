import assert from'node:assert/strict'
import fs from'node:fs'
import test from'node:test'

const mipe=fs.readFileSync(new URL('../src/domain/mipe.js',import.meta.url),'utf8')
const mirfe=fs.readFileSync(new URL('../src/domain/irrigationExecution.js',import.meta.url),'utf8')
const guard=fs.readFileSync(new URL('../supabase/migrations/20260827121000_inventory_cost_evidence_guard.sql',import.meta.url),'utf8')

test('F009 MIPE cost is backed by the exact materialized inventory movement',()=>{
 assert.match(mipe,/movementBackedCostEntry\(movement,/)
 assert.match(mipe,/inventoryMovements\|\|\[\]\)\.find\(x=>String\(x\.id\)===String\(input\.movementId\)\)/)
 assert.match(mipe,/const cost=costEntry\.amount/)
 assert.doesNotMatch(mipe,/const cost=quantity\*profile\.cost/)
})

test('F009 MIRFE aggregates the exact materialized movements and no longer reprices from Product',()=>{
 assert.match(mirfe,/const executedItems=\[\],costMovements=\[\]/)
 assert.match(mirfe,/costMovements\.push\(movement\)/)
 assert.match(mirfe,/movementsBackedCostEntry\(costMovements,/)
 assert.match(mirfe,/const totalCost=Number\(costEntry\?\.amount\|\|0\)/)
 assert.doesNotMatch(mirfe,/inventoryProduct\.cost\?\?nutrientProduct\.cost/)
})

test('F009 both operational costs declare causal source identities enforced by the deferred guard',()=>{
 assert.match(mipe,/sourceType:'MipeTreatment',sourceId:treatment\.id/)
 assert.match(mirfe,/sourceType:'MirfePreparation',sourceId:preparation\.id/)
 assert.match(guard,/source-mismatch/i)
 assert.match(guard,/deferrable initially deferred/i)
})

test('F009 PostgreSQL fails closed when MIPE or MIRFE omit movement evidence',()=>{
 assert.match(guard,/in \('MIPE','MIRFE'\)/)
 assert.match(guard,/INVENTORY_COST_EVIDENCE_INVALID:no-movements/)
})
