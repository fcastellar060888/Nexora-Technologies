import test from'node:test'
import assert from'node:assert/strict'
import fs from'node:fs'
import{assertInventoryLotMovementAllowed}from'../src/domain/inventoryLotRestrictions.js'
import{transactInventory}from'../src/domain/inventory.js'

function state(){return{currentContext:{companyId:'org-a',siteId:'site-a'},companies:[{id:'org-a'}],sites:[{id:'site-a',organizationId:'org-a',companyId:'org-a'}],products:[{id:'p1',organizationId:'org-a',siteId:'site-a',category:'General',unit:'unidad'}],inventoryLots:[{id:'l1',organizationId:'org-a',productId:'p1',siteId:'site-a',unit:'unidad',lotNumber:'L1',quantity:5,expiryDate:'2026-08-25',createdAt:'2026-08-01T00:00:00.000Z'}],inventoryMovements:[]}}

test('F008: consumo posterior al vencimiento falla cerrado antes de mutar el kardex',()=>{
 const input=state()
 assert.throws(()=>transactInventory(input,{lotId:'l1',type:'Consumo',quantity:1,date:'2026-08-26',createdAt:'2026-08-26T08:00:00.000Z'}),/venció/i)
 assert.equal(input.inventoryLots[0].quantity,5)
 assert.equal(input.inventoryMovements.length,0)
})

test('F008: salida en la fecha de vencimiento sigue permitida; después no',()=>{
 assert.doesNotThrow(()=>assertInventoryLotMovementAllowed({expiryDate:'2026-08-25'},{type:'Salida',date:'2026-08-25'}))
 assert.throws(()=>assertInventoryLotMovementAllowed({expiryDate:'2026-08-25'},{type:'Salida',date:'2026-08-26'}),/venció/i)
})

test('F008: baja y vencimiento siguen permitidos después de expiry para retirar saldo append-only',()=>{
 assert.doesNotThrow(()=>assertInventoryLotMovementAllowed({expiryDate:'2026-08-25'},{type:'Baja',date:'2026-08-26'}))
 assert.doesNotThrow(()=>assertInventoryLotMovementAllowed({expiryDate:'2026-08-25'},{type:'Vencimiento',date:'2026-08-26'}))
})

test('F008: fecha operacional inválida falla cerrado y no depende del reloj implícito',()=>{
 assert.throws(()=>assertInventoryLotMovementAllowed({expiryDate:'2026-08-25'},{type:'Consumo',date:'26/08/2026'}),/fecha operacional/i)
 assert.throws(()=>assertInventoryLotMovementAllowed({expiryDate:'2026-02-30'},{type:'Consumo',date:'2026-02-28'}),/fecha de vencimiento/i)
})

test('F008: PostgreSQL revalida vencimiento para todo inventory movement y congela la decisión histórica',()=>{
 const sql=fs.readFileSync(new URL('../supabase/migrations/20260826230000_inventory_expiry_restrictions_guard.sql',import.meta.url),'utf8')
 assert.match(sql,/before insert or update on public\.erp_records/i)
 assert.match(sql,/new\.collection='inventoryMovements'/)
 assert.match(sql,/collection='inventoryLots'/)
 assert.match(sql,/v_type in \('Salida','Consumo'\) and v_date>v_expiry/)
 assert.match(sql,/old\.payload->>'lotId' is distinct from new\.payload->>'lotId'/)
 assert.match(sql,/old\.payload->>'type' is distinct from new\.payload->>'type'/)
 assert.match(sql,/old\.payload->>'date' is distinct from new\.payload->>'date'/)
 assert.match(sql,/INVENTORY_MOVEMENT_EXPIRY_CONFLICT:immutable/)
})

test('F008: MIPE y MIRFE entregan fechas operacionales YYYY-MM-DD al movimiento de consumo',()=>{
 const mipe=fs.readFileSync(new URL('../src/domain/mipe.js',import.meta.url),'utf8')
 const mirfe=fs.readFileSync(new URL('../src/domain/irrigationExecution.js',import.meta.url),'utf8')
 assert.match(mipe,/type:'Consumo',quantity,date:executedAt\.slice\(0,10\)/)
 assert.match(mirfe,/type:'Consumo',quantity,date:input\.date\|\|executedAt\.slice\(0,10\)/)
})
