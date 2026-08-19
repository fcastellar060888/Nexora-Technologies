import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

import {salesViewForActiveOrganization} from '../src/domain/sales.js'

const state={
 currentContext:{companyId:'org-a'},
 companies:[{id:'org-a'},{id:'org-b'}],
 sites:[{id:'site-a',organizationId:'org-a'},{id:'site-b',organizationId:'org-b'}],
 finishedGoods:[
  {id:'stock-shared',organizationId:'org-b',siteId:'site-b',lotId:'lot-shared',availableGrams:900},
  {id:'stock-shared',organizationId:'org-a',siteId:'site-a',lotId:'lot-shared',availableGrams:500}
 ],
 sales:[
  {id:'sale-shared',organizationId:'org-b',siteId:'site-b',stockId:'stock-shared',lotId:'lot-shared',status:'Despachada',grams:200,totalBase:2000},
  {id:'sale-shared',organizationId:'org-a',siteId:'site-a',stockId:'stock-shared',lotId:'lot-shared',status:'Reservada',grams:100,totalBase:1000}
 ],
 finishedGoodsMovements:[
  {id:'move-b',organizationId:'org-b',siteId:'site-b'},
  {id:'move-a',organizationId:'org-a',siteId:'site-a'}
 ],
 propagationBatches:[
  {id:'lot-shared',organizationId:'org-b',siteId:'site-b',code:'LOT-B'},
  {id:'lot-shared',organizationId:'org-a',siteId:'site-a',code:'LOT-A'}
 ]
}

test('M4.3 F002: commercial view exposes only active-tenant stock, sales, movements and lot joins',()=>{
 const view=salesViewForActiveOrganization(state)
 assert.equal(view.organizationId,'org-a')
 assert.deepEqual(view.finishedGoods.map(item=>item.siteId),['site-a'])
 assert.deepEqual(view.sales.map(item=>item.siteId),['site-a'])
 assert.deepEqual(view.finishedGoodsMovements.map(item=>item.siteId),['site-a'])
 assert.deepEqual(view.propagationBatches.map(item=>item.code),['LOT-A'])
})

test('M4.3 F002: SalesPage consumes the scoped commercial view instead of global sales/stock collections',()=>{
 const source=readFileSync(new URL('../src/pages/SalesPage.jsx',import.meta.url),'utf8')
 assert.match(source,/salesViewForActiveOrganization/)
 assert.match(source,/view\.finishedGoods/)
 assert.match(source,/view\.sales/)
 assert.match(source,/view\.propagationBatches/)
 assert.doesNotMatch(source,/available=state\.finishedGoods/)
 assert.doesNotMatch(source,/dispatchedSales=state\.sales/)
 assert.doesNotMatch(source,/reservedSales=state\.sales/)
 assert.doesNotMatch(source,/\[\.\.\.state\.sales\]/)
})
