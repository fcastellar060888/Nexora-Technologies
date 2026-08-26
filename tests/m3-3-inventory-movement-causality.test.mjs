import test from'node:test'
import assert from'node:assert/strict'
import fs from'node:fs'
import{inventoryMovementSnapshot,assertInventoryMovementCausality}from'../src/domain/inventoryMovementCausality.js'
import{transactInventory}from'../src/domain/inventory.js'

const product={id:'p1',organizationId:'org1',companyId:'org1',unit:'mL',cost:12.5,category:'MIPE',doseUnit:'mL/L'}
const lot={id:'l1',organizationId:'org1',companyId:'org1',productId:'p1',siteId:'s1',unit:'mL',quantity:10,lotNumber:'A'}
const state={currentContext:{companyId:'org1',siteId:'s1'},companies:[{id:'org1'}],sites:[{id:'s1',organizationId:'org1',companyId:'org1'}],products:[product],inventoryLots:[lot],inventoryMovements:[]}

test('F007 movement freezes unit and unit cost from Product/Lot authority',()=>{assert.deepEqual(inventoryMovementSnapshot(product,lot,{sourceType:'MIPE',sourceId:'treatment-1'}),{unit:'mL',unitCost:12.5,sourceType:'MIPE',sourceId:'treatment-1'})})
test('F007 operational origin cannot omit sourceId',()=>{assert.throws(()=>inventoryMovementSnapshot(product,lot,{sourceType:'MIPE'}),/sourceId/)})
test('F007 contradictory Product/Lot units fail closed',()=>{assert.throws(()=>inventoryMovementSnapshot(product,{...lot,unit:'g'},{sourceType:'Manual'}),/contradictorias/)})
test('F007 negative or non finite product cost cannot enter movement evidence',()=>{assert.throws(()=>inventoryMovementSnapshot({...product,cost:-1},lot,{sourceType:'Manual'}),/costo unitario/)})
test('F007 transactInventory persists causal snapshot instead of caller supplied evidence',()=>{const next=transactInventory(state,{id:'m1',lotId:'l1',type:'Entrada',quantity:2,sourceType:'Manual',unit:'g',unitCost:999});const movement=next.inventoryMovements.find(x=>x.id==='m1');assert.equal(movement.unit,'mL');assert.equal(movement.unitCost,12.5);assert.equal(movement.sourceType,'Manual')})
test('F007 persisted movement causality detects later contradictory evidence',()=>{const movement={unit:'mL',unitCost:99,sourceType:'MIPE',sourceId:'t1'};assert.throws(()=>assertInventoryMovementCausality(product,lot,movement),/costo unitario/)})

test('F007 persistence enforces causal snapshot server-side for every inventory movement write',()=>{
 const sql=fs.readFileSync(new URL('../supabase/migrations/20260826173000_inventory_movement_causality_guard.sql',import.meta.url),'utf8')
 assert.match(sql,/before insert or update on public\.erp_records/i)
 assert.match(sql,/new\.collection='inventoryMovements'/)
 assert.match(sql,/collection='inventoryLots'/)
 assert.match(sql,/collection='products'/)
 assert.match(sql,/INVENTORY_MOVEMENT_CAUSALITY_CONFLICT:lot-product/)
 assert.match(sql,/INVENTORY_MOVEMENT_CAUSALITY_CONFLICT:unit'/)
 assert.match(sql,/INVENTORY_MOVEMENT_CAUSALITY_CONFLICT:unit-cost/)
 assert.match(sql,/v_source_type <> 'Manual' and v_source_id is null/)
 assert.match(sql,/INVENTORY_MOVEMENT_CAUSALITY_CONFLICT:immutable/)
})
