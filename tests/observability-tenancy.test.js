import test from'node:test'
import assert from'node:assert/strict'
import{readFileSync}from'node:fs'
import{observabilityViewForActiveOrganization,diagnosticStateForActiveOrganization}from'../src/domain/observability.js'
import{runDiagnostics}from'../src/domain/diagnostics.js'

const state=()=>({
 schemaVersion:16,
 currentContext:{companyId:'org-a'},
 companies:[{id:'org-a',name:'A'},{id:'org-b',name:'B'}],
 sites:[{id:'site-shared',organizationId:'org-b',name:'B'},{id:'site-shared',organizationId:'org-a',name:'A'}],
 houses:[{id:'house-shared',organizationId:'org-b',siteId:'site-shared',name:'B house'},{id:'house-shared',organizationId:'org-a',siteId:'site-shared',name:'A house'}],
 beds:[{id:'bed-shared',organizationId:'org-b',houseId:'house-shared',name:'B bed'},{id:'bed-shared',organizationId:'org-a',houseId:'house-shared',name:'A bed'}],
 plantPositions:[{id:'plant-shared',organizationId:'org-b',bedId:'bed-shared',row:1,position:1},{id:'plant-shared',organizationId:'org-a',bedId:'bed-shared',row:2,position:2}],
 auditLog:[
  {id:'audit-b',organizationId:'org-b',siteId:'site-shared',detail:'plant-shared',action:'B'},
  {id:'audit-a',organizationId:'org-a',siteId:'site-shared',detail:'plant-shared',action:'A'},
  {id:'audit-ownerless',detail:'plant-shared',action:'legacy'}
 ],
 mirfeMonitoring:[{id:'monitor-b',organizationId:'org-b',houseId:'house-shared',humidity:90,drainage:5,vpd:0.5},{id:'monitor-a',organizationId:'org-a',houseId:'house-shared',humidity:60,drainage:20,vpd:1.2}],
 findings:[{id:'finding-b',organizationId:'org-b',plantPositionId:'plant-shared',status:'Abierto'},{id:'finding-a',organizationId:'org-a',plantPositionId:'plant-shared',status:'Abierto'}],
 propagationBatches:[
  {id:'lot-shared',organizationId:'org-b',siteId:'site-shared',productionLedger:{Empaque:{inputGrams:100,outputGrams:90}}},
  {id:'lot-shared',organizationId:'org-a',siteId:'site-shared',productionLedger:{Empaque:{inputGrams:100,outputGrams:80}}}
 ],
 motherPlants:[],propagationUnits:[],phaseTransitions:[],cultivationCycles:[],operationalAreas:[],infrastructureElements:[],infrastructureAssets:[],assetMaintenances:[],environmentalReadings:[],genetics:[],incidents:[],treatments:[],products:[],inventoryLots:[],inventoryMovements:[],finishedGoods:[],finishedGoodsMovements:[],sales:[],waterAnalyses:[],nutrientObjectives:[],formulations:[],tankPreparations:[],workOrders:[],irrigationApplications:[],productionFlows:[],costEntries:[]
})

test('M4.6 F001: audit view exposes only active-tenant entries and resolves homonymous plant hierarchy inside that tenant',()=>{
 const view=observabilityViewForActiveOrganization(state())
 assert.deepEqual(view.auditLog.map(x=>x.id),['audit-a'])
 assert.equal(view.plantPositions.length,1)
 assert.equal(view.plantPositions[0].organizationId,'org-a')
 assert.equal(view.beds[0].name,'A bed')
 assert.equal(view.houses[0].name,'A house')
})

test('M4.6 F002: insights inputs are scoped before correlations are calculated',()=>{
 const view=observabilityViewForActiveOrganization(state())
 assert.deepEqual(view.houses.map(x=>x.name),['A house'])
 assert.deepEqual(view.mirfeMonitoring.map(x=>x.id),['monitor-a'])
 assert.deepEqual(view.findings.map(x=>x.id),['finding-a'])
})

test('M4.6 F003: diagnostics state treats duplicate raw IDs across tenants as legitimate and preserves canonical ledger object',()=>{
 const scoped=diagnosticStateForActiveOrganization(state())
 assert.equal(scoped.companies.length,1)
 assert.equal(scoped.companies[0].id,'org-a')
 assert.equal(scoped.houses.length,1)
 assert.equal(scoped.propagationBatches.length,1)
 assert.equal(Array.isArray(scoped.propagationBatches[0].productionLedger),false)
 const checks=runDiagnostics(scoped)
 const lotIds=checks.find(x=>x.name==='IDs únicos: propagationBatches')
 assert.equal(lotIds?.status,true)
 assert.ok(checks.find(x=>x.name==='Balance de masa productivo'))
})

test('M4.6 F001-F003: direct observability pages consume the scoped boundary',()=>{
 const audit=readFileSync(new URL('../src/pages/AuditLogPage.jsx',import.meta.url),'utf8')
 const insights=readFileSync(new URL('../src/pages/InsightsPage.jsx',import.meta.url),'utf8')
 const diagnostics=readFileSync(new URL('../src/pages/SystemDiagnosticsPage.jsx',import.meta.url),'utf8')
 assert.match(audit,/observabilityViewForActiveOrganization/)
 assert.doesNotMatch(audit,/state\.auditLog/)
 assert.match(insights,/observabilityViewForActiveOrganization/)
 assert.doesNotMatch(insights,/state\.houses/)
 assert.match(diagnostics,/diagnosticStateForActiveOrganization/)
 assert.doesNotMatch(diagnostics,/runDiagnostics\(state\)/)
})

test('M4.6 F001: new audit entries persist organization and site authority in the store',()=>{
 const source=readFileSync(new URL('../src/services/store.jsx',import.meta.url),'utf8')
 assert.match(source,/organizationId:\s*companyId/)
 assert.match(source,/siteId:/)
})
