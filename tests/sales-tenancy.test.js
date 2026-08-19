import test from 'node:test'
import assert from 'node:assert/strict'

import {reserveFinishedGoods,dispatchSale,cancelReservation} from '../src/domain/sales.js'

const baseState=()=>({
 currentContext:{companyId:'org-a'},
 companies:[{id:'org-a'},{id:'org-b'}],
 sites:[
  {id:'site-a',organizationId:'org-a'},
  {id:'site-b',organizationId:'org-b'}
 ],
 finishedGoods:[
  {id:'stock-shared',organizationId:'org-b',siteId:'site-b',lotId:'lot-b',classification:'A',availableGrams:900,reservedGrams:0,soldGrams:0},
  {id:'stock-shared',organizationId:'org-a',siteId:'site-a',lotId:'lot-a',classification:'A',availableGrams:500,reservedGrams:0,soldGrams:0}
 ],
 sales:[],
 finishedGoodsMovements:[]
})

test('M4.3 F001: reservation mutates exactly one stock homonym in the active tenant and persists ownership',()=>{
 const state=baseState()
 const next=reserveFinishedGoods(state,{id:'sale-a',stockId:'stock-shared',organizationId:'org-a',siteId:'site-a',customer:'Cliente A',grams:100,pricePerGram:10,currency:'COP',exchangeRate:1,movementId:'move-reserve-a',createdAt:'2026-08-19T12:00:00.000Z'})
 assert.equal(next.finishedGoods[0].organizationId,'org-b')
 assert.equal(next.finishedGoods[0].availableGrams,900)
 assert.equal(next.finishedGoods[1].organizationId,'org-a')
 assert.equal(next.finishedGoods[1].availableGrams,400)
 assert.equal(next.finishedGoods[1].reservedGrams,100)
 assert.equal(next.sales[0].organizationId,'org-a')
 assert.equal(next.sales[0].siteId,'site-a')
 assert.equal(next.finishedGoodsMovements[0].organizationId,'org-a')
 assert.equal(next.finishedGoodsMovements[0].siteId,'site-a')
})

test('M4.3 F001: foreign-only stock and spoofed authority fail closed',()=>{
 const state=baseState()
 state.finishedGoods=state.finishedGoods.slice(0,1)
 assert.throws(()=>reserveFinishedGoods(state,{stockId:'stock-shared',organizationId:'org-a',siteId:'site-a',customer:'Cliente A',grams:10}),/empresa|organización|tenant|ownership|inventario/i)
 const normal=baseState()
 assert.throws(()=>reserveFinishedGoods(normal,{stockId:'stock-shared',organizationId:'org-b',siteId:'site-b',customer:'Cliente B',grams:10}),/otra empresa|organización|tenant/i)
})

test('M4.3 F001: duplicate stock identity inside active tenant fails closed',()=>{
 const state=baseState()
 state.finishedGoods.push({id:'stock-shared',organizationId:'org-a',siteId:'site-a',lotId:'lot-a-2',classification:'A',availableGrams:100,reservedGrams:0,soldGrams:0})
 assert.throws(()=>reserveFinishedGoods(state,{stockId:'stock-shared',organizationId:'org-a',siteId:'site-a',customer:'Cliente A',grams:10}),/duplicad|ambigu/i)
})

test('M4.3 F001: dispatch resolves sale and stock inside active tenant and never mutates foreign homonyms',()=>{
 const state=baseState()
 state.finishedGoods[0]={...state.finishedGoods[0],availableGrams:800,reservedGrams:100}
 state.finishedGoods[1]={...state.finishedGoods[1],availableGrams:400,reservedGrams:100}
 state.sales=[
  {id:'sale-shared',organizationId:'org-b',siteId:'site-b',stockId:'stock-shared',lotId:'lot-b',classification:'A',grams:100,status:'Reservada'},
  {id:'sale-shared',organizationId:'org-a',siteId:'site-a',stockId:'stock-shared',lotId:'lot-a',classification:'A',grams:100,status:'Reservada'}
 ]
 const next=dispatchSale(state,{saleId:'sale-shared',organizationId:'org-a',siteId:'site-a',movementId:'move-dispatch-a',createdAt:'2026-08-19T13:00:00.000Z'})
 assert.equal(next.sales[0].status,'Reservada')
 assert.equal(next.sales[1].status,'Despachada')
 assert.equal(next.finishedGoods[0].reservedGrams,100)
 assert.equal(next.finishedGoods[0].soldGrams,0)
 assert.equal(next.finishedGoods[1].reservedGrams,0)
 assert.equal(next.finishedGoods[1].soldGrams,100)
 assert.equal(next.finishedGoodsMovements[0].organizationId,'org-a')
 assert.equal(next.finishedGoodsMovements[0].siteId,'site-a')
})

test('M4.3 F001: cancellation releases only the active-tenant reservation',()=>{
 const state=baseState()
 state.finishedGoods[0]={...state.finishedGoods[0],availableGrams:800,reservedGrams:100}
 state.finishedGoods[1]={...state.finishedGoods[1],availableGrams:400,reservedGrams:100}
 state.sales=[
  {id:'sale-shared',organizationId:'org-b',siteId:'site-b',stockId:'stock-shared',lotId:'lot-b',classification:'A',grams:100,status:'Reservada'},
  {id:'sale-shared',organizationId:'org-a',siteId:'site-a',stockId:'stock-shared',lotId:'lot-a',classification:'A',grams:100,status:'Reservada'}
 ]
 const next=cancelReservation(state,{saleId:'sale-shared',organizationId:'org-a',siteId:'site-a',movementId:'move-cancel-a',reason:'Cliente canceló',createdAt:'2026-08-19T14:00:00.000Z'})
 assert.equal(next.sales[0].status,'Reservada')
 assert.equal(next.sales[1].status,'Cancelada')
 assert.equal(next.finishedGoods[0].availableGrams,800)
 assert.equal(next.finishedGoods[0].reservedGrams,100)
 assert.equal(next.finishedGoods[1].availableGrams,500)
 assert.equal(next.finishedGoods[1].reservedGrams,0)
 assert.equal(next.finishedGoodsMovements[0].organizationId,'org-a')
 assert.equal(next.finishedGoodsMovements[0].siteId,'site-a')
})
