import test from 'node:test'
import assert from 'node:assert/strict'

import {migrateState} from '../src/services/stateMigration.js'
import {applyRemoteRecords} from '../src/services/syncEngine.js'

test('F003: migration derives owner for legacy inventory records only from an explicitly owned site',()=>{
 const migrated=migrateState({
  companies:[{id:'org-a'},{id:'org-b'}],
  sites:[
   {id:'site-a',organizationId:'org-a'},
   {id:'site-b',organizationId:'org-b'}
  ],
  currentContext:{companyId:'org-b',siteId:'site-b'},
  inventoryLots:[{id:'lot-a',siteId:'site-a',productId:'product-a',quantity:7}],
  inventoryMovements:[{id:'move-a',lotId:'lot-a',siteId:'site-a',productId:'product-a',type:'Entrada',quantity:7}]
 })
 assert.equal(migrated.inventoryLots[0].organizationId,'org-a')
 assert.equal(migrated.inventoryMovements[0].organizationId,'org-a')
})

test('F003: migration leaves an ownerless inventory record unresolved when site ownership cannot be proven',()=>{
 const migrated=migrateState({
  companies:[{id:'org-a'},{id:'org-b'}],
  sites:[
   {id:'site-a',organizationId:'org-a'},
   {id:'site-b',organizationId:'org-b'}
  ],
  currentContext:{companyId:'org-a',siteId:'site-a'},
  inventoryLots:[{id:'legacy-unknown',siteId:'site-missing',productId:'product-a',quantity:3}]
 })
 assert.equal(migrated.inventoryLots[0].organizationId,undefined)
})

test('F003: remote hydration rejects an ownerless local inventory homonym instead of adopting it into the active tenant',()=>{
 const state={
  currentContext:{companyId:'org-a'},
  inventoryLots:[{id:'shared-lot',siteId:'site-unknown',productId:'product-a',quantity:4}],
  inventoryMovements:[]
 }
 assert.throws(()=>applyRemoteRecords(state,[{
  companyId:'org-a',
  collection:'inventoryLots',
  recordId:'shared-lot',
  version:4,
  updatedAt:'2026-08-18T15:00:00.000Z',
  payload:{id:'shared-lot',organizationId:'org-a',siteId:'site-a',productId:'product-a',quantity:11}
 }],{companyId:'org-a'}),/legacy|organizationId|ownership|tenant|propietario/i)
 assert.equal(state.inventoryLots[0].organizationId,undefined)
 assert.equal(state.inventoryLots[0].quantity,4)
})

test('F003: remote hydration preserves a foreign homonym and updates only the explicitly owned tenant record',()=>{
 const state={
  currentContext:{companyId:'org-a'},
  inventoryLots:[
   {id:'shared-lot',organizationId:'org-b',siteId:'site-b',productId:'product-b',quantity:19},
   {id:'shared-lot',organizationId:'org-a',siteId:'site-a',productId:'product-a',quantity:4}
  ],
  inventoryMovements:[]
 }
 const next=applyRemoteRecords(state,[{
  companyId:'org-a',
  collection:'inventoryLots',
  recordId:'shared-lot',
  version:5,
  updatedAt:'2026-08-18T15:05:00.000Z',
  payload:{id:'shared-lot',organizationId:'org-a',siteId:'site-a',productId:'product-a',quantity:12}
 }],{companyId:'org-a'})
 assert.equal(next.inventoryLots[0].organizationId,'org-b')
 assert.equal(next.inventoryLots[0].quantity,19)
 assert.equal(next.inventoryLots[1].organizationId,'org-a')
 assert.equal(next.inventoryLots[1].quantity,12)
})
