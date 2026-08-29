import test from'node:test'
import assert from'node:assert/strict'
import{reserveFinishedGoods}from'../src/domain/sales.js'

const base=()=>({
 currentContext:{companyId:'org-a'},
 companies:[{id:'org-a'},{id:'org-b'}],
 sites:[{id:'site-a',organizationId:'org-a'},{id:'site-b',organizationId:'org-b'}],
 currencies:[
  {id:'currency:org-a:USD',code:'USD',organizationId:'org-a',rateToBase:4000,active:true},
  {id:'currency:org-b:EUR',code:'EUR',organizationId:'org-b',rateToBase:4500,active:true},
  {code:'COP',rateToBase:1,active:true}
 ],
 finishedGoods:[{id:'stock-a',organizationId:'org-a',siteId:'site-a',lotId:'lot-a',classification:'A',availableGrams:100,reservedGrams:0,soldGrams:0}],
 sales:[],finishedGoodsMovements:[]
})

const command=(overrides={})=>({id:'sale-1',movementId:'move-1',stockId:'stock-a',organizationId:'org-a',siteId:'site-a',customer:'Cliente',grams:10,pricePerGram:100,currency:'USD',exchangeRate:4000,date:'2026-08-29',...overrides})

test('M4.4 F004: reservation accepts only currency owned by active organization',()=>{
 const next=reserveFinishedGoods(base(),command())
 assert.equal(next.sales[0].currency,'USD')
 assert.equal(next.sales[0].exchangeRate,4000)
 assert.throws(()=>reserveFinishedGoods(base(),command({currency:'EUR'})),/moneda|empresa|ownership/i)
 assert.throws(()=>reserveFinishedGoods(base(),command({currency:'COP'})),/moneda|empresa|ownership|inequívoc/i)
})

test('M4.4 F004: reservation rejects invalid frozen exchange rates',()=>{
 assert.throws(()=>reserveFinishedGoods(base(),command({exchangeRate:0})),/tasa|mayor que cero/i)
 assert.throws(()=>reserveFinishedGoods(base(),command({exchangeRate:-1})),/tasa|mayor que cero/i)
 assert.throws(()=>reserveFinishedGoods(base(),command({exchangeRate:'NaN'})),/tasa|mayor que cero/i)
})

test('M4.4 F004: inactive tenant currency cannot be used for a new reservation',()=>{
 const state=base();state.currencies[0].active=false
 assert.throws(()=>reserveFinishedGoods(state,command()),/moneda|inactiva|empresa/i)
})
