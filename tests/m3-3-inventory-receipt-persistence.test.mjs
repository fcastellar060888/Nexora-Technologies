import test from'node:test'
import assert from'node:assert/strict'
import{assertInventoryCommandReceipt,mergeInventoryCommandReceipts,assertInventoryReceiptAppendOnly}from'../src/domain/inventoryReceiptPersistence.js'

const tenant='org-a'
const receipt=(overrides={})=>({commandId:'cmd-1',organizationId:tenant,signature:'sig-1',operation:'CREATE_LOT',aggregateId:'lot-1',occurredAt:'2026-08-27T20:00:00.000Z',...overrides})

test('durable inventory receipt requires explicit tenant identity and signature',()=>{
 assert.throws(()=>assertInventoryCommandReceipt(receipt({organizationId:''})),/organizationId explícito/)
 assert.throws(()=>assertInventoryCommandReceipt(receipt({signature:''})),/firma durable/)
 assert.throws(()=>assertInventoryCommandReceipt(receipt(),{organizationId:'org-b'}),/otra empresa/)
})

test('same commandId and same signature hydrates idempotently after restart',()=>{
 const local=[receipt()]
 const remote=[receipt()]
 const merged=mergeInventoryCommandReceipts(local,remote,tenant)
 assert.equal(merged.length,1)
 assert.equal(merged[0].commandId,'cmd-1')
 assert.equal(merged[0].signature,'sig-1')
})

test('same tenant commandId with contradictory durable signature fails closed',()=>{
 assert.throws(()=>mergeInventoryCommandReceipts([receipt()],[receipt({signature:'sig-hostile'})],tenant),/contradice la firma durable local/)
})

test('homonymous commandIds from another tenant remain isolated',()=>{
 const foreign=receipt({organizationId:'org-b',signature:'sig-b',aggregateId:'lot-b'})
 const merged=mergeInventoryCommandReceipts([foreign],[receipt()],tenant)
 assert.equal(merged.length,2)
 assert.equal(merged.find(item=>item.organizationId==='org-b').signature,'sig-b')
 assert.equal(merged.find(item=>item.organizationId===tenant).signature,'sig-1')
})

test('durable inventory receipts cannot be deleted or rewritten',()=>{
 assert.throws(()=>assertInventoryReceiptAppendOnly([receipt()],[],tenant),/append-only/)
 assert.throws(()=>assertInventoryReceiptAppendOnly([receipt()],[receipt({aggregateId:'lot-hostile'})],tenant),/inmutable/)
 assert.equal(assertInventoryReceiptAppendOnly([receipt()],[receipt(),receipt({commandId:'cmd-2',signature:'sig-2',aggregateId:'lot-2'})],tenant),true)
})
