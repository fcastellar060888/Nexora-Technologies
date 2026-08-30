import test from'node:test'
import assert from'node:assert/strict'
import fs from'node:fs'
import{diagnosticStateForActiveOrganization}from'../src/domain/observability.js'

const base={companies:[{id:'org-a'},{id:'org-b'}],currentContext:{companyId:'org-a',siteId:'site-a'}}

test('F002 dashboard diagnostics exclude foreign and ambiguous ownerless operational data',()=>{
 const state={...base,
  propagationBatches:[{id:'lot-a',organizationId:'org-a',phase:'Vegetativo'},{id:'lot-b',organizationId:'org-b',phase:'Floración'},{id:'legacy',phase:'Vegetativo'}],
  motherPlants:[{id:'mother-a',organizationId:'org-a',status:'Activa'},{id:'mother-b',organizationId:'org-b',status:'Activa'}],
  grandmotherPlants:[{id:'grand-a',organizationId:'org-a',status:'Activa'},{id:'grand-b',organizationId:'org-b',status:'Activa'}],
  finishedGoods:[{id:'fg-a',organizationId:'org-a',availableGrams:10},{id:'fg-b',organizationId:'org-b',availableGrams:999}],
  sales:[{id:'sale-a',organizationId:'org-a',totalBase:100},{id:'sale-b',organizationId:'org-b',totalBase:9000}]
 }
 const view=diagnosticStateForActiveOrganization(state)
 assert.deepEqual(view.propagationBatches.map(x=>x.id),['lot-a'])
 assert.deepEqual(view.motherPlants.map(x=>x.id),['mother-a'])
 assert.deepEqual(view.grandmotherPlants.map(x=>x.id),['grand-a'])
 assert.deepEqual(view.finishedGoods.map(x=>x.id),['fg-a'])
 assert.deepEqual(view.sales.map(x=>x.id),['sale-a'])
})

test('F002 dashboard consumes tenant-scoped diagnostic state instead of raw store arrays',()=>{
 const source=fs.readFileSync(new URL('../src/pages/DashboardPage.jsx',import.meta.url),'utf8')
 assert.match(source,/diagnosticStateForActiveOrganization/)
 assert.match(source,/const\{state:rawState\}=useStore\(\)/)
 assert.match(source,/const state=diagnosticStateForActiveOrganization\(rawState\)/)
})
