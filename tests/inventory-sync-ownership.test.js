import test from 'node:test'
import assert from 'node:assert/strict'

import {applyRemoteRecords,collectionChanges,enqueueChanges} from '../src/services/syncEngine.js'

test('F002: sync rejects ownerless inventory lot upserts instead of assigning tenant only in the envelope',()=>{
 const prev={inventoryLots:[],inventoryMovements:[],syncQueue:[]}
 const next={
  inventoryLots:[{id:'lot-ownerless',siteId:'site-a',productId:'product-a',quantity:10}],
  inventoryMovements:[],
  syncQueue:[]
 }
 const changes=collectionChanges(prev,next,['inventoryLots'])
 assert.equal(changes.length,1)
 assert.equal(changes[0].organizationId,'')
 assert.throws(()=>enqueueChanges(next,changes,{companyId:'org-a'}),/organizationId|ownership|tenant|empresa/i)
})

test('F002: sync rejects ownerless inventory movement upserts',()=>{
 const prev={inventoryLots:[],inventoryMovements:[],syncQueue:[]}
 const next={
  inventoryLots:[],
  inventoryMovements:[{id:'movement-ownerless',lotId:'lot-a',siteId:'site-a',productId:'product-a',type:'Salida',quantity:1}],
  syncQueue:[]
 }
 const changes=collectionChanges(prev,next,['inventoryMovements'])
 assert.equal(changes.length,1)
 assert.equal(changes[0].organizationId,'')
 assert.throws(()=>enqueueChanges(next,changes,{companyId:'org-a'}),/organizationId|ownership|tenant|empresa/i)
})

test('F002: remote inventory hydration materializes first-class organizationId from authenticated company scope',()=>{
 const state={
  currentContext:{companyId:'org-a'},
  inventoryLots:[],
  inventoryMovements:[]
 }
 const next=applyRemoteRecords(state,[{
  companyId:'org-a',
  collection:'inventoryLots',
  recordId:'lot-a',
  version:3,
  updatedAt:'2026-08-18T14:00:00.000Z',
  payload:{id:'lot-a',siteId:'site-a',productId:'product-a',quantity:12}
 }],{companyId:'org-a'})
 assert.equal(next.inventoryLots.length,1)
 assert.equal(next.inventoryLots[0].organizationId,'org-a')
 assert.equal(next.inventoryLots[0]._organizationId,'org-a')
})
