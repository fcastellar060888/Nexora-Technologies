import test from'node:test'
import assert from'node:assert/strict'
import{readFileSync}from'node:fs'
import{createCurrency,updateCurrencyRate,createCostEntry,financialViewForActiveOrganization,financialMetrics}from'../src/domain/finance.js'

const state=()=>({
 currentContext:{companyId:'org-a'},
 companies:[{id:'org-a'},{id:'org-b'}],
 sites:[{id:'site-shared',organizationId:'org-b',name:'B'},{id:'site-shared',organizationId:'org-a',name:'A'}],
 currencies:[
  {code:'USD',organizationId:'org-b',name:'USD B',symbol:'US$',rateToBase:4100,active:true},
  {code:'USD',organizationId:'org-a',name:'USD A',symbol:'US$',rateToBase:4000,active:true},
  {code:'COP',name:'Legacy ownerless',symbol:'$',rateToBase:1,active:true}
 ],
 costEntries:[
  {id:'cost-b',organizationId:'org-b',siteId:'site-shared',amount:900},
  {id:'cost-a',organizationId:'org-a',siteId:'site-shared',amount:100}
 ],
 propagationBatches:[
  {id:'lot-b',organizationId:'org-b',siteId:'site-shared',productionLedger:{Empaque:{outputGrams:900}}},
  {id:'lot-a',organizationId:'org-a',siteId:'site-shared',productionLedger:{Empaque:{outputGrams:50}}}
 ],
 packingBatches:[{id:'legacy',organizationId:'org-a',siteId:'site-shared',packedOutput:999999}]
})

test('M4.4 F001: currency rate update mutates exactly one active-tenant homonym',()=>{
 const next=updateCurrencyRate(state(),{code:'USD',organizationId:'org-a',rateToBase:4050})
 assert.equal(next.currencies[0].rateToBase,4100)
 assert.equal(next.currencies[1].rateToBase,4050)
})

test('M4.4 F001: foreign authority and duplicate tenant currency fail closed',()=>{
 const s=state()
 assert.throws(()=>updateCurrencyRate(s,{code:'USD',organizationId:'org-b',rateToBase:4200}),/otra empresa|organización/i)
 s.currencies.push({code:'USD',organizationId:'org-a',rateToBase:3900})
 assert.throws(()=>updateCurrencyRate(s,{code:'USD',organizationId:'org-a',rateToBase:4200}),/duplicad|ambigu/i)
})

test('M4.4 F001: ownerless legacy currency is not silently adopted in multi-company state',()=>{
 const view=financialViewForActiveOrganization(state())
 assert.deepEqual(view.currencies.map(x=>x.code),['USD'])
 const next=createCurrency(state(),{code:'COP',organizationId:'org-a',name:'Peso colombiano',symbol:'$',rateToBase:1,active:true})
 assert.equal(next.currencies.at(-1).organizationId,'org-a')
})

test('M4.4 F002: cost entry validates tenant/site and persists explicit ownership',()=>{
 const created=createCostEntry(state(),{id:'cost-new',organizationId:'org-a',siteId:'site-shared',date:'2026-08-18',category:'MIRFE',description:'Nutrientes',amount:250})
 const entry=created.costEntries.at(-1)
 assert.equal(entry.organizationId,'org-a')
 assert.equal(entry.siteId,'site-shared')
 assert.equal(entry.amount,250)
 assert.throws(()=>createCostEntry(state(),{id:'cost-x',organizationId:'org-b',siteId:'site-shared',amount:10}),/otra empresa|organización/i)
})

test('M4.4 F002: financial metrics use active-tenant costs and canonical packing ledger only',()=>{
 const metrics=financialMetrics(state())
 assert.equal(metrics.totalCost,100)
 assert.equal(metrics.packedGrams,50)
 assert.equal(metrics.costPerGram,2)
})

test('M4.4 F002: finance view never exposes foreign costs/sites/lots',()=>{
 const view=financialViewForActiveOrganization(state())
 assert.deepEqual(view.costEntries.map(x=>x.id),['cost-a'])
 assert.equal(view.sites.length,1)
 assert.equal(view.sites[0].organizationId,'org-a')
 assert.deepEqual(view.propagationBatches.map(x=>x.id),['lot-a'])
})

test('M4.4 F003: finance UI and Sales currency selector consume tenant-aware authority',()=>{
 const currencies=readFileSync(new URL('../src/pages/CurrenciesPage.jsx',import.meta.url),'utf8')
 const costs=readFileSync(new URL('../src/pages/CostsPage.jsx',import.meta.url),'utf8')
 const sales=readFileSync(new URL('../src/pages/SalesPage.jsx',import.meta.url),'utf8')
 assert.match(currencies,/financialViewForActiveOrganization|currencyViewForActiveOrganization/)
 assert.match(currencies,/createCurrency/)
 assert.match(currencies,/updateCurrencyRate/)
 assert.match(costs,/financialViewForActiveOrganization/)
 assert.match(costs,/financialMetrics/)
 assert.match(costs,/createCostEntry/)
 assert.doesNotMatch(costs,/state\.packingBatches/)
 assert.match(sales,/financialViewForActiveOrganization|currencyViewForActiveOrganization/)
 assert.doesNotMatch(sales,/state\.currencies\.filter/)
})
