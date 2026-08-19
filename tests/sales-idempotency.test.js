import test from 'node:test'
import assert from 'node:assert/strict'

import {reserveFinishedGoods,dispatchSale,cancelReservation} from '../src/domain/sales.js'

const baseState=()=>({
 currentContext:{companyId:'org-a'},
 companies:[{id:'org-a'}],
 sites:[{id:'site-a',organizationId:'org-a'}],
 finishedGoods:[{id:'stock-a',organizationId:'org-a',siteId:'site-a',lotId:'lot-a',classification:'A',availableGrams:500,reservedGrams:0,soldGrams:0}],
 sales:[],
 finishedGoodsMovements:[]
})

const reservation={id:'sale-idem',movementId:'move-reserve-idem',organizationId:'org-a',siteId:'site-a',stockId:'stock-a',customer:'Cliente A',grams:100,pricePerGram:10,currency:'COP',exchangeRate:1,date:'2026-08-19',createdAt:'2026-08-19T12:00:00.000Z'}

test('M4.3 F003: replaying the same reservation command is stable and does not reserve twice',()=>{
 const once=reserveFinishedGoods(baseState(),reservation)
 const replay=reserveFinishedGoods(once,reservation)
 assert.deepEqual(replay,once)
 assert.equal(replay.finishedGoods[0].availableGrams,400)
 assert.equal(replay.finishedGoods[0].reservedGrams,100)
 assert.equal(replay.sales.length,1)
 assert.equal(replay.finishedGoodsMovements.length,1)
})

test('M4.3 F003: contradictory reuse of a sale identity fails closed',()=>{
 const once=reserveFinishedGoods(baseState(),reservation)
 assert.throws(()=>reserveFinishedGoods(once,{...reservation,grams:120}),/contrad|replay|idempot|identidad/i)
})

test('M4.3 F003: dispatch replay is stable and contradictory redispatch fails closed',()=>{
 const reserved=reserveFinishedGoods(baseState(),reservation)
 const command={saleId:'sale-idem',movementId:'move-dispatch-idem',organizationId:'org-a',siteId:'site-a',dispatchReference:'FAC-1',responsible:'Operador',createdAt:'2026-08-19T13:00:00.000Z'}
 const once=dispatchSale(reserved,command)
 const replay=dispatchSale(once,command)
 assert.deepEqual(replay,once)
 assert.equal(replay.finishedGoods[0].reservedGrams,0)
 assert.equal(replay.finishedGoods[0].soldGrams,100)
 assert.equal(replay.finishedGoodsMovements.filter(item=>item.id==='move-dispatch-idem').length,1)
 assert.throws(()=>dispatchSale(once,{...command,dispatchReference:'FAC-2'}),/contrad|replay|idempot|despach/i)
})

test('M4.3 F003: cancellation replay is stable and contradictory reuse fails closed',()=>{
 const reserved=reserveFinishedGoods(baseState(),reservation)
 const command={saleId:'sale-idem',movementId:'move-cancel-idem',organizationId:'org-a',siteId:'site-a',reason:'Cliente canceló',createdAt:'2026-08-19T13:00:00.000Z'}
 const once=cancelReservation(reserved,command)
 const replay=cancelReservation(once,command)
 assert.deepEqual(replay,once)
 assert.equal(replay.finishedGoods[0].availableGrams,500)
 assert.equal(replay.finishedGoods[0].reservedGrams,0)
 assert.equal(replay.finishedGoodsMovements.filter(item=>item.id==='move-cancel-idem').length,1)
 assert.throws(()=>cancelReservation(once,{...command,reason:'Otro motivo'}),/contrad|replay|idempot|cancel/i)
})

test('M4.3 F003: a movement identity cannot be reused by another commercial command',()=>{
 const first=reserveFinishedGoods(baseState(),reservation)
 const secondState={...first,finishedGoods:[{...first.finishedGoods[0],availableGrams:400}]}
 assert.throws(()=>reserveFinishedGoods(secondState,{...reservation,id:'sale-other',movementId:'move-reserve-idem',customer:'Cliente B',grams:50}),/movimiento|identidad|contrad|replay|idempot/i)
})
