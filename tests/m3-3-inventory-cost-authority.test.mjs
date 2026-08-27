import test from 'node:test'
import assert from 'node:assert/strict'
import {inventoryMovementCost,movementBackedCostEntry,movementsBackedCostEntry,assertMovementBackedCostEntry} from '../src/domain/inventoryCostAuthority.js'

const movement=(overrides={})=>({id:'m1',organizationId:'org-a',quantity:-2,unitCost:3.5,...overrides})

test('MIPE cost derives from frozen movement evidence, not a later Product price',()=>{
 const m=movement()
 assert.equal(inventoryMovementCost(m),7)
 const entry=movementBackedCostEntry(m,{module:'MIPE',amount:999})
 assert.equal(entry.amount,7)
 assert.equal(entry.inventoryMovementId,'m1')
 assert.deepEqual(entry.inventoryMovementIds,['m1'])
})

test('MIRFE aggregate cost is exactly the sum of unique movement evidence',()=>{
 const entry=movementsBackedCostEntry([movement(),movement({id:'m2',quantity:-4,unitCost:1.25})],{module:'MIRFE'})
 assert.equal(entry.amount,12)
 assert.deepEqual(entry.inventoryMovementIds,['m1','m2'])
})

test('cross-tenant and duplicate movement evidence fail closed',()=>{
 assert.throws(()=>movementsBackedCostEntry([movement(),movement({id:'m2',organizationId:'org-b'})]),/organizaciones distintas/)
 assert.throws(()=>movementsBackedCostEntry([movement(),movement()]),/identidades únicas/)
})

test('persisted amount or movement references cannot contradict the kardex',()=>{
 const movements=[movement(),movement({id:'m2',quantity:-1,unitCost:2})]
 const good=movementsBackedCostEntry(movements,{module:'MIRFE'})
 assert.doesNotThrow(()=>assertMovementBackedCostEntry(good,movements))
 assert.throws(()=>assertMovementBackedCostEntry({...good,amount:good.amount+1},movements),/importe/)
 assert.throws(()=>assertMovementBackedCostEntry({...good,inventoryMovementIds:['m2','m1']},movements),/evidencia/)
})

test('invalid frozen economics fail closed',()=>{
 assert.throws(()=>inventoryMovementCost(movement({quantity:0})),/mayor que cero/)
 assert.throws(()=>inventoryMovementCost(movement({unitCost:-1})),/no negativo/)
})
