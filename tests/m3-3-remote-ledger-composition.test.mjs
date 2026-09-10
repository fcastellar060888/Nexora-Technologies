import test from'node:test'
import assert from'node:assert/strict'
import{readFile}from'node:fs/promises'

test('M3.3 remote MIPE RPC accepts only canonical optional legacy bootstrap plus one treatment consumption',async()=>{
 const sql=await readFile(new URL('../supabase/migrations/20260817010000_mipe_treatment_execution.sql',import.meta.url),'utf8')
 assert.match(sql,/jsonb_array_length\(p_mutations\)\s+not in \(5,6\)/i)
 assert.match(sql,/sourceType'='MipeTreatment'/)
 assert.match(sql,/sourceType'='LegacyInventoryBootstrap'/)
 assert.match(sql,/inventory-opening:/)
 assert.match(sql,/invalid MIPE legacy inventory bootstrap/)
 assert.match(sql,/previousMovementId/)
 assert.match(sql,/ledgerSequence/)
 assert.match(sql,/balanceBefore/)
 assert.match(sql,/balanceAfter/)
})

test('M3.3 remote MIRFE RPC preserves bootstrap-to-consumption continuity per lot',async()=>{
 const sql=await readFile(new URL('../supabase/migrations/20260816130000_mirfe_inventory_execution.sql',import.meta.url),'utf8')
 assert.match(sql,/sourceType' not in \('MirfePreparation','LegacyInventoryBootstrap'\)/)
 assert.match(sql,/duplicate MIRFE legacy inventory bootstrap/)
 assert.match(sql,/each MIRFE lot requires an operational consumption/)
 assert.match(sql,/expected_current_balance/)
 assert.match(sql,/sourceType'='LegacyInventoryBootstrap'/)
 assert.match(sql,/inventory-opening:/)
 assert.match(sql,/previousMovementId/)
 assert.match(sql,/previous_sequence/)
 assert.match(sql,/MIRFE inventory movement chain is discontinuous/)
})