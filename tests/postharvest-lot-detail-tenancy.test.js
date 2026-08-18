import test from'node:test'
import assert from'node:assert/strict'
import{readFileSync}from'node:fs'
import{canonicalPostharvestLotDetail}from'../src/domain/production.js'

const state=()=>({
 currentContext:{companyId:'org-a'},
 companies:[{id:'org-a'},{id:'org-b'}],
 sites:[{id:'site-a',organizationId:'org-a'},{id:'site-b',organizationId:'org-b'}],
 propagationBatches:[
  {id:'lot-shared',organizationId:'org-b',siteId:'site-b',motherPlantId:'mother-shared',geneticId:'gen-shared',phase:'Secado',activeQuantity:90,productionLedger:{}},
  {id:'lot-shared',organizationId:'org-a',siteId:'site-a',motherPlantId:'mother-shared',geneticId:'gen-shared',phase:'Secado',activeQuantity:50,productionLedger:{}}
 ],
 propagationUnits:[
  {id:'unit-b',organizationId:'org-b',batchId:'lot-shared'},
  {id:'unit-a',organizationId:'org-a',batchId:'lot-shared'},
  {id:'unit-ownerless',batchId:'lot-shared'}
 ],
 motherPlants:[
  {id:'mother-shared',organizationId:'org-b',siteId:'site-b',grandmotherPlantId:'grand-shared',lotCode:'M-B'},
  {id:'mother-shared',organizationId:'org-a',siteId:'site-a',grandmotherPlantId:'grand-shared',lotCode:'M-A'}
 ],
 grandmotherPlants:[
  {id:'grand-shared',organizationId:'org-b',siteId:'site-b',lotCode:'G-B'},
  {id:'grand-shared',organizationId:'org-a',siteId:'site-a',lotCode:'G-A'}
 ],
 genetics:[
  {id:'gen-shared',organizationId:'org-b',name:'Gen B'},
  {id:'gen-shared',organizationId:'org-a',name:'Gen A'}
 ],
 lotEvents:[
  {id:'evt-b',organizationId:'org-b',siteId:'site-b',lotId:'lot-shared',title:'Cosecha → Secado'},
  {id:'evt-a',organizationId:'org-a',siteId:'site-a',lotId:'lot-shared',title:'Cosecha → Secado'},
  {id:'evt-ownerless',lotId:'lot-shared',title:'legacy ambiguous'}
 ]
})

test('M4.2 F005: canonical lot detail joins only records owned by the active organization',()=>{
 const detail=canonicalPostharvestLotDetail(state(),'lot-shared')
 assert.equal(detail.organizationId,'org-a')
 assert.equal(detail.lot.organizationId,'org-a')
 assert.deepEqual(detail.units.map(item=>item.id),['unit-a'])
 assert.equal(detail.mother?.lotCode,'M-A')
 assert.equal(detail.grandmother?.lotCode,'G-A')
 assert.equal(detail.genetic?.name,'Gen A')
 assert.deepEqual(detail.events.map(item=>item.id),['evt-a'])
})

test('M4.2 F005: duplicate related identity inside active tenant fails closed',()=>{
 const duplicate=state()
 duplicate.motherPlants.push({id:'mother-shared',organizationId:'org-a',siteId:'site-a',grandmotherPlantId:'grand-shared'})
 assert.throws(()=>canonicalPostharvestLotDetail(duplicate,'lot-shared'),/duplicad|ambigu/i)
})

test('M4.2 F005: LotDetailStablePage uses scoped detail boundary instead of global raw-ID joins',()=>{
 const source=readFileSync(new URL('../src/pages/LotDetailStablePage.jsx',import.meta.url),'utf8')
 assert.match(source,/canonicalPostharvestLotDetail/)
 assert.doesNotMatch(source,/state\.propagationBatches\.find\(item=>item\.id===lotId\)/)
 assert.doesNotMatch(source,/state\.lotEvents\.filter\(item=>item\.lotId===lot\.id\)/)
})
