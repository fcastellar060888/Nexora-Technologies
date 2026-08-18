import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

import {appendPostharvestRecord,advanceProductionFlow,postharvestViewForActiveOrganization} from '../src/domain/production.js'

const baseState=()=>({
 currentContext:{companyId:'org-a'},
 companies:[{id:'org-a'},{id:'org-b'}],
 sites:[
  {id:'site-a',organizationId:'org-a',name:'A'},
  {id:'site-b',organizationId:'org-b',name:'B'}
 ],
 productionBatches:[
  {id:'harvest-b',organizationId:'org-b',siteId:'site-b'},
  {id:'harvest-a',siteId:'site-a'}
 ],
 dryingBatches:[{id:'dry-a',organizationId:'org-a',siteId:'site-a'},{id:'dry-b',organizationId:'org-b',siteId:'site-b'}],
 trimmingBatches:[{id:'trim-a',organizationId:'org-a',siteId:'site-a'},{id:'trim-b',organizationId:'org-b',siteId:'site-b'}],
 selectionBatches:[{id:'select-a',organizationId:'org-a',siteId:'site-a'},{id:'select-b',organizationId:'org-b',siteId:'site-b'}],
 packingBatches:[{id:'pack-a',organizationId:'org-a',siteId:'site-a'},{id:'pack-b',organizationId:'org-b',siteId:'site-b'}],
 propagationBatches:[{id:'lot-a',organizationId:'org-a',siteId:'site-a'},{id:'lot-b',organizationId:'org-b',siteId:'site-b'}],
 finishedGoods:[{id:'fg-a',organizationId:'org-a',siteId:'site-a'},{id:'fg-b',organizationId:'org-b',siteId:'site-b'}],
 productionFlows:[
  {id:'flow-shared',organizationId:'org-b',siteId:'site-b',stage:'Cosecha',wetWeight:120,history:[{stage:'Cosecha',output:120}]},
  {id:'flow-shared',organizationId:'org-a',siteId:'site-a',stage:'Cosecha',wetWeight:100,history:[{stage:'Cosecha',output:100}]}
 ]
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
 assert.equal(view.productionFlows.length,1)
 assert.equal(view.productionFlows[0].organizationId,'org-a')
})

test('M4.2 F003: manual postharvest append stamps organization and rejects a foreign site',()=>{
 const state=baseState()
 const next=appendPostharvestRecord(state,'productionBatches',{id:'harvest-new',siteId:'site-a',wetWeight:10,acceptedWeight:9})
 assert.equal(next.productionBatches.at(-1).organizationId,'org-a')
 assert.equal(next.productionBatches.at(-1).siteId,'site-a')
 assert.throws(()=>appendPostharvestRecord(state,'dryingBatches',{id:'dry-foreign',siteId:'site-b'}),/empresa|organización|sede|ownership/i)
})

test('M4.2 F003: integrated production flow advances exactly one tenant-scoped homonym',()=>{
 const state=baseState()
 const next=advanceProductionFlow(state,{flowId:'flow-shared',output:80,responsible:'Operador A',date:'2026-08-19'})
 assert.equal(next.productionFlows[0].organizationId,'org-b')
 assert.equal(next.productionFlows[0].stage,'Cosecha')
 assert.equal(next.productionFlows[1].organizationId,'org-a')
 assert.equal(next.productionFlows[1].stage,'Secado')
 assert.equal(next.productionFlows[1].history.at(-1).output,80)
 assert.equal(next.productionFlows[1].history.at(-1).organizationId,'org-a')
 assert.equal(next.productionFlows[1].history.at(-1).siteId,'site-a')
})

test('M4.2 F003: duplicate integrated-flow identity inside active tenant fails closed',()=>{
 const state=baseState()
 state.productionFlows.push({id:'flow-shared',organizationId:'org-a',siteId:'site-a',stage:'Cosecha',wetWeight:70,history:[{stage:'Cosecha',output:70}]})
 assert.throws(()=>advanceProductionFlow(state,{flowId:'flow-shared',output:60}),/duplicad|ambigu/i)
})

test('M4.2 F003: direct postharvest pages consume the common tenancy boundary',()=>{
 const stagePages=['ProductionPage.jsx','DryingPage.jsx','TrimmingPage.jsx','SelectionPage.jsx','PackingPage.jsx']
 for(const page of stagePages){
  const source=readFileSync(new URL(`../src/pages/${page}`,import.meta.url),'utf8')
  assert.match(source,/postharvestViewForActiveOrganization/)
  assert.match(source,/appendPostharvestRecord/)
 }
 const finished=readFileSync(new URL('../src/pages/FinishedGoodsPage.jsx',import.meta.url),'utf8')
 assert.match(finished,/postharvestViewForActiveOrganization/)
 const flow=readFileSync(new URL('../src/pages/ProductionFlowPage.jsx',import.meta.url),'utf8')
 assert.match(flow,/postharvestViewForActiveOrganization/)
 assert.match(flow,/appendPostharvestRecord/)
 assert.match(flow,/advanceProductionFlow/)
})
