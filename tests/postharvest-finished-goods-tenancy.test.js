import test from 'node:test'
import assert from 'node:assert/strict'

import {packedAvailableGrams,receiveFinishedGoods} from '../src/domain/production.js'

const stateFor=({propagationBatches,finishedGoods=[]})=>({
 currentContext:{companyId:'org-a'},
 companies:[{id:'org-a'},{id:'org-b'}],
 sites:[
  {id:'site-a',organizationId:'org-a'},
  {id:'site-b',organizationId:'org-b'}
 ],
 propagationBatches,
 finishedGoods,
 finishedGoodsMovements:[]
})

const packedLot=(organizationId,siteId,grams,extra={})=>({
 id:'lot-shared',organizationId,siteId,geneticId:`gen-${organizationId}`,phase:'Empaque',
 productionLedger:{Empaque:{inputGrams:grams,outputGrams:grams,lossGrams:0,yieldPct:100,date:'2026-08-18'}},
 ...extra
})

test('M4.2 F002: packed availability is calculated only from the active tenant lot and its receipts',()=>{
 const state=stateFor({
  propagationBatches:[packedLot('org-b','site-b',1000),packedLot('org-a','site-a',600)],
  finishedGoods:[
   {id:'fg-b',organizationId:'org-b',siteId:'site-b',lotId:'lot-shared',classification:'Flor',initialGrams:800,availableGrams:800},
   {id:'fg-a',organizationId:'org-a',siteId:'site-a',lotId:'lot-shared',classification:'Trim',initialGrams:150,availableGrams:150}
  ]
 })
 assert.equal(packedAvailableGrams(state,'lot-shared'),450)
})

test('M4.2 F002: same classification in another tenant does not block a legitimate finished-good receipt',()=>{
 const state=stateFor({
  propagationBatches:[packedLot('org-b','site-b',900),packedLot('org-a','site-a',600)],
  finishedGoods:[
   {id:'fg-b',organizationId:'org-b',siteId:'site-b',lotId:'lot-shared',classification:'Flor',initialGrams:300,availableGrams:300}
  ]
 })
 const next=receiveFinishedGoods(state,{
  lotId:'lot-shared',classification:'Flor',packedGrams:200,id:'fg-a',movementId:'move-a',
  packedAt:'2026-08-19',createdAt:'2026-08-19T13:00:00.000Z'
 })
 const created=next.finishedGoods.find(item=>item.id==='fg-a')
 assert.equal(created.organizationId,'org-a')
 assert.equal(created.siteId,'site-a')
 assert.equal(created.lotId,'lot-shared')
 const movement=next.finishedGoodsMovements.find(item=>item.id==='move-a')
 assert.deepEqual(
  {organizationId:movement.organizationId,siteId:movement.siteId,lotId:movement.lotId,finishedGoodId:movement.finishedGoodId},
  {organizationId:'org-a',siteId:'site-a',lotId:'lot-shared',finishedGoodId:'fg-a'}
 )
 assert.equal(next.finishedGoods.find(item=>item.id==='fg-b').availableGrams,300)
})

test('M4.2 F002: a foreign-only packed lot is rejected',()=>{
 const state=stateFor({propagationBatches:[packedLot('org-b','site-b',500)]})
 assert.throws(()=>receiveFinishedGoods(state,{lotId:'lot-shared',classification:'Flor',packedGrams:100}),/empresa|organización|ownership|lote/i)
})

test('M4.2 F002: duplicate packed-lot identity inside the active tenant fails closed',()=>{
 const state=stateFor({propagationBatches:[
  packedLot('org-a','site-a',600),packedLot('org-a','site-a',500)
 ]})
 assert.throws(()=>receiveFinishedGoods(state,{lotId:'lot-shared',classification:'Flor',packedGrams:100}),/duplicad|ambigu/i)
})

test('M4.2 F002: mass conservation uses only active-tenant receipts and rejects over-receipt',()=>{
 const state=stateFor({
  propagationBatches:[packedLot('org-b','site-b',1200),packedLot('org-a','site-a',600)],
  finishedGoods:[
   {id:'fg-b',organizationId:'org-b',siteId:'site-b',lotId:'lot-shared',classification:'Foreign',initialGrams:900,availableGrams:900},
   {id:'fg-a-old',organizationId:'org-a',siteId:'site-a',lotId:'lot-shared',classification:'Trim',initialGrams:250,availableGrams:250}
  ]
 })
 assert.equal(packedAvailableGrams(state,'lot-shared'),350)
 assert.throws(()=>receiveFinishedGoods(state,{lotId:'lot-shared',classification:'Flor',packedGrams:351}),/350|disponibles/i)
})

test('M4.2 F002: caller cannot spoof organization or site on finished-good receipt',()=>{
 const state=stateFor({propagationBatches:[packedLot('org-a','site-a',600)]})
 assert.throws(()=>receiveFinishedGoods(state,{lotId:'lot-shared',organizationId:'org-b',classification:'Flor',packedGrams:100}),/otra empresa|organización/i)
 assert.throws(()=>receiveFinishedGoods(state,{lotId:'lot-shared',siteId:'site-b',classification:'Flor',packedGrams:100}),/otra sede|sede/i)
})
