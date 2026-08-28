import assert from'node:assert/strict'
import fs from'node:fs'
import test from'node:test'

const sql=fs.readFileSync(new URL('../supabase/migrations/20260827121000_inventory_cost_evidence_guard.sql',import.meta.url),'utf8')

test('F009 cost evidence guard is deferred until the transaction has persisted all movements',()=>{
 assert.match(sql,/create constraint trigger erp_records_inventory_cost_evidence_guard/i)
 assert.match(sql,/deferrable initially deferred/i)
 assert.match(sql,/when \(new\.collection = 'costEntries'\)/i)
})

test('F009 resolves every declared movement inside the same tenant and recomputes amount from frozen kardex economics',()=>{
 assert.match(sql,/record\.organization_id = new\.organization_id/i)
 assert.match(sql,/record\.collection = 'inventoryMovements'/i)
 assert.match(sql,/record\.record_id = any\(v_ids\)/i)
 assert.match(sql,/abs\(\(record\.payload->>'quantity'\)::numeric\) \* \(record\.payload->>'unitCost'\)::numeric/i)
 assert.match(sql,/movement-missing-or-invalid/i)
 assert.match(sql,/amount-mismatch/i)
})

test('F009 rejects duplicate movement identities, cross-tenant ownership and causal source mismatch',()=>{
 assert.match(sql,/count\(distinct value\)/i)
 assert.match(sql,/organization-mismatch/i)
 assert.match(sql,/source-mismatch/i)
})

test('F009 freezes referenced economic evidence after persistence',()=>{
 for(const field of ['inventoryMovementIds','inventoryMovementId','amount','sourceType','sourceId'])assert.ok(sql.includes(field))
 assert.match(sql,/immutable-evidence/i)
})
