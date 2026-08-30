import test from'node:test'
import assert from'node:assert/strict'
import fs from'node:fs'
import{diagnosticStateForActiveOrganization}from'../src/domain/observability.js'
import{runDiagnostics}from'../src/domain/diagnostics.js'

test('F003 diagnostics exclude foreign and ambiguous ownerless records before integrity checks',()=>{
 const raw={schemaVersion:9,companies:[{id:'org-a'},{id:'org-b'}],currentContext:{companyId:'org-a'},sites:[{id:'site-a',organizationId:'org-a'},{id:'site-b',organizationId:'org-b'}],houses:[{id:'house-a',organizationId:'org-a',siteId:'site-a'},{id:'house-b',organizationId:'org-b',siteId:'missing'}],beds:[],plantPositions:[],operationalAreas:[],infrastructureElements:[],infrastructureAssets:[],assetMaintenances:[],environmentalReadings:[],motherPlants:[],grandmotherPlants:[],propagationBatches:[],propagationUnits:[],phaseTransitions:[],cultivationCycles:[],genetics:[],incidents:[],findings:[],treatments:[],products:[],nutrientProducts:[],inventoryLots:[],inventoryMovements:[],finishedGoods:[],finishedGoodsMovements:[],sales:[],mirfeMonitoring:[],waterAnalyses:[],nutrientObjectives:[],formulations:[],tankPreparations:[],workOrders:[],irrigationApplications:[],productionFlows:[],costEntries:[]}
 const scoped=diagnosticStateForActiveOrganization(raw)
 assert.deepEqual(scoped.houses.map(x=>x.id),['house-a'])
 const siteCheck=runDiagnostics(scoped).find(x=>x.name==='Naves con sede válida')
 assert.equal(siteCheck.status,true)
})

test('F002/F003 scoped diagnostic state covers dashboard and diagnostic-only collections',()=>{
 const raw={companies:[{id:'org-a'},{id:'org-b'}],currentContext:{companyId:'org-a'},grandmotherPlants:[{id:'a',organizationId:'org-a'},{id:'b',organizationId:'org-b'}],nutrientProducts:[{id:'na',organizationId:'org-a'},{id:'nb',organizationId:'org-b'}]}
 const scoped=diagnosticStateForActiveOrganization(raw)
 assert.deepEqual(scoped.grandmotherPlants.map(x=>x.id),['a'])
 assert.deepEqual(scoped.nutrientProducts.map(x=>x.id),['na'])
})

test('F003 SystemDiagnosticsPage never runs integrity checks on raw global store state',()=>{
 const source=fs.readFileSync(new URL('../src/pages/SystemDiagnosticsPage.jsx',import.meta.url),'utf8')
 assert.match(source,/state:rawState/)
 assert.match(source,/diagnosticStateForActiveOrganization\(rawState\)/)
 assert.match(source,/runDiagnostics\(state\)/)
})
