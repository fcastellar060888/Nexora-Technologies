import test from'node:test'
import assert from'node:assert/strict'
import fs from'node:fs'

const sql=fs.readFileSync(new URL('../supabase/migrations/20260828010500_inventory_legacy_lot_unit_evidence.sql',import.meta.url),'utf8')

test('legacy lot unit migration uses historical InventoryMovement evidence, never current Product as a backfill source',()=>{
 assert.match(sql,/collection = 'inventoryMovements'/)
 assert.match(sql,/m\.payload->>'lotId' = v_lot\.id::text/)
 assert.match(sql,/array_agg\(distinct nullif\(btrim\(m\.payload->>'unit'\),''\)\)/)
 assert.match(sql,/No historical unit evidence: leave the legacy lot untouched/)
 assert.match(sql,/if coalesce\(cardinality\(v_units\),0\) = 0 then\s*continue;/s)
})

test('contradictory historical movement units fail closed instead of guessing',()=>{
 assert.match(sql,/if cardinality\(v_units\) <> 1 then/)
 assert.match(sql,/INVENTORY_LEGACY_UNIT_CONFLICT/)
})

test('recovered historical unit must still agree with same-tenant Product authority',()=>{
 assert.match(sql,/p\.organization_id = v_lot\.organization_id/)
 assert.match(sql,/p\.collection = 'products'/)
 assert.match(sql,/INVENTORY_LEGACY_UNIT_PRODUCT_MISSING/)
 assert.match(sql,/INVENTORY_LEGACY_UNIT_PRODUCT_CONFLICT/)
 assert.match(sql,/jsonb_set\(payload,'\{unit\}',to_jsonb\(v_unit\),true\)/)
})
