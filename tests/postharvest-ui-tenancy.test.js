import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

import {appendPostharvestRecord,advanceProductionFlow,postharvestViewForActiveOrganization} from '../src/domain/production.js'

const baseState=()=>({
 currentContext:{companyId:'org-a'},
 companies:[{id:'org-a'},{id:'org-b'}],
 sites:[{id:'site-a',organizationId:'org-a',name:'A'},{id:'site-b',organizationId:'org-b',name:'B'}],
 productionBatches:[{id:'harvest-b',organizationId:'org-b',siteId:'site-b'},{id:'harvest-a',siteId:'site-a'}],
 dryingBatches:[{id:'dry-a',organizationId:'org-a',siteId:'site-a'},{id:'dry-b',organizationId:'org-b',siteId:'site-b'}],
 trimmingBatches:[{id:'trim-a',organizationId:'org-a',siteId:'site-a'},{id:'trim-b',organizationId:'org-b',siteId:'site-b'}],
 selectionBatches:[{id:'select-a',organizationId:'org-a',siteId:'site-a'},{id:'select-b',organizationId:'org-b',siteId:'site-b'}],
 packingBatches:[{id:'pack-a',organizationId:'org-a',siteId:'site-a'},{id:'pack-b',organizationId:'org-b',siteId:'site-b'}],
 propagationBatches:[{id:'lot-a',organizationId:'org-a',siteId:'site-a'},{id:'lot-b',organizationId:'org-b',siteId:'site-b'}],
 finishedGoods:[{id:'fg-a',organizationId:'org-a',siteId:'site-a'},{id:'fg-b',organizationId:'org-b',siteId:'site-b'}],
 productionFlows:[{id:'flow-a',organizationId:'org-a',siteId:'site-a',stage:'Cosecha'},{id:'flow-b',organizationId:'org-b',siteId:'site-b',stage:'Cosecha'}]
})

test('M4.2 F003: postharvest view exposes only records belonging to the active organization',()=>{
 const view=postharvestViewForActiveOrganization(baseState())
 assert.equal(view.organizationId,'org-a')
 assert.deepEqual(view.sites.map(x=>x.id),['site-a'])
 assert.deepEqual(view.productionBatches.map(x=>x.id),['harvest-a'])
 assert.deepEqual(view.dryingBatches.map(x=>x.id),['dry-a'])
 assert.deepEqual(view.trimmingBatches.map(x=>x.id),['trim-a'])
 assert.deepEqual(view.selectionBatches.map(x=>x.id),['select-a'])
 assert.deepEqual(view.packingBatches.map(x=>x.id),['pack-a'])
 assert.deepEqual(view.propagationBatches.map(x=>x.id),['lot-a'])
 assert.deepEqual(view.finishedGoods.map(x=>x.id),['fg-a'])
 assert.deepEqual(view.productionFlows.map(x=>x.id),['flow-a'])
})

test('M4.2 F003/F004: legacy stage arrays and productionFlows are historical read-only projections',()=>{
 const state=baseState()
 assert.throws(()=>appendPostharvestRecord(state,'productionBatches',{id:'harvest-new',organizationId:'org-a',siteId:'site-a'}),/solo lectura|canónico/i)
 assert.throws(()=>appendPostharvestRecord(state,'dryingBatches',{id:'dry-new',organizationId:'org-a',siteId:'site-a'}),/solo lectura|canónico/i)
 assert.throws(()=>advanceProductionFlow(state,{flowId:'flow-a',organizationId:'org-a',siteId:'site-a',output:80}),/solo lectura|advanceProductionLot|canónico/i)
})

test('M4.2 F003/F004: operational postharvest pages consume canonical boundaries',()=>{
 const stagePages=['ProductionPage.jsx','DryingPage.jsx','TrimmingPage.jsx','SelectionPage.jsx','PackingPage.jsx']
 for(const page of stagePages){
  const source=readFileSync(new URL(`../src/pages/${page}`,import.meta.url),'utf8')
  assert.match(source,/CanonicalPostharvestStage/)
  assert.doesNotMatch(source,/appendPostharvestRecord|advanceProductionFlow/)
 }
 const canonical=readFileSync(new URL('../src/components/CanonicalPostharvestStage.jsx',import.meta.url),'utf8')
 assert.match(canonical,/advanceProductionLot/)
 assert.match(canonical,/postharvestViewForActiveOrganization/)
 assert.match(canonical,/organizationId/)
 const finished=readFileSync(new URL('../src/pages/FinishedGoodsPage.jsx',import.meta.url),'utf8')
 assert.match(finished,/postharvestViewForActiveOrganization/)
 assert.match(finished,/organizationId:view\.organizationId/)
 const flow=readFileSync(new URL('../src/pages/ProductionFlowPage.jsx',import.meta.url),'utf8')
 assert.match(flow,/advanceProductionLot/)
 assert.match(flow,/postharvestViewForActiveOrganization/)
 assert.doesNotMatch(flow,/appendPostharvestRecord|advanceProductionFlow/)
})
