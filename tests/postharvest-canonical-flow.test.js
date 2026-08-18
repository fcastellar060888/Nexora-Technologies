import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

import {advanceProductionFlow,advanceProductionLot} from '../src/domain/production.js'

const canonicalState=lot=>({
 currentContext:{companyId:'org-a'},
 companies:[{id:'org-a'}],
 sites:[{id:'site-a',organizationId:'org-a'}],
 propagationBatches:[lot],
 lotEvents:[],
 finishedGoods:[],
 finishedGoodsMovements:[],
 productionFlows:[]
})

const lotAt=(phase,ledger={},extra={})=>({
 id:'lot-a',organizationId:'org-a',siteId:'site-a',phase,activeQuantity:50,quantity:50,productionLedger:ledger,...extra
})

test('M4.2 F004: canonical lot cannot inflate active plant quantity during a phase transition',()=>{
 const state=canonicalState(lotAt('Floración'))
 assert.throws(()=>advanceProductionLot(state,{lotId:'lot-a',phase:'Cosecha',quantity:51,outputWeight:1000,eventId:'evt-inflate'}),/cantidad|superar|disponible|activa/i)
})

test('M4.2 F004: Finalizado is terminal and cannot append another transition',()=>{
 const state=canonicalState(lotAt('Finalizado',{Empaque:{inputGrams:600,outputGrams:500,lossGrams:100,yieldPct:83.3}}))
 assert.throws(()=>advanceProductionLot(state,{lotId:'lot-a',phase:'Finalizado',quantity:50,outputWeight:500,eventId:'evt-terminal'}),/final|terminal|avanzar/i)
 assert.equal(state.lotEvents.length,0)
})

test('M4.2 F004: replay of the same transition event is stable and contradictory reuse fails closed',()=>{
 const state=canonicalState(lotAt('Cosecha',{Cosecha:{inputGrams:1000,outputGrams:900,lossGrams:100,yieldPct:90}}))
 const command={lotId:'lot-a',phase:'Secado',quantity:50,outputWeight:700,eventId:'evt-replay',date:'2026-08-19',createdAt:'2026-08-19T12:00:00.000Z'}
 const once=advanceProductionLot(state,command)
 const replay=advanceProductionLot(once,command)
 assert.equal(replay.lotEvents.filter(event=>event.id==='evt-replay').length,1)
 assert.deepEqual(replay.propagationBatches,once.propagationBatches)
 assert.throws(()=>advanceProductionLot(once,{...command,outputWeight:650}),/contrad|replay|idempot|evento|identidad/i)
})

test('M4.2 F004: every postharvest weight transition conserves mass',()=>{
 let state=canonicalState(lotAt('Floración'))
 state=advanceProductionLot(state,{lotId:'lot-a',phase:'Cosecha',quantity:50,inputWeight:1200,outputWeight:1000,eventId:'evt-harvest'})
 state=advanceProductionLot(state,{lotId:'lot-a',phase:'Secado',quantity:50,outputWeight:700,eventId:'evt-dry'})
 state=advanceProductionLot(state,{lotId:'lot-a',phase:'Manicura',quantity:50,outputWeight:600,eventId:'evt-trim'})
 state=advanceProductionLot(state,{lotId:'lot-a',phase:'Selección',quantity:50,outputWeight:550,eventId:'evt-select'})
 state=advanceProductionLot(state,{lotId:'lot-a',phase:'Empaque',quantity:50,outputWeight:500,eventId:'evt-pack'})
 const ledger=state.propagationBatches[0].productionLedger
 assert.deepEqual(['Cosecha','Secado','Manicura','Selección','Empaque'].map(phase=>ledger[phase].outputGrams),[1000,700,600,550,500])
 assert.equal(ledger.Cosecha.inputGrams,1200)
 assert.equal(ledger.Cosecha.lossGrams,200)
})

test('M4.2 F004: legacy integrated flow rejects impossible mass and terminal re-advance',()=>{
 const state={
  currentContext:{companyId:'org-a'},companies:[{id:'org-a'}],sites:[{id:'site-a',organizationId:'org-a'}],
  productionFlows:[{id:'flow-a',organizationId:'org-a',siteId:'site-a',stage:'Secado',wetWeight:100,history:[{stage:'Secado',output:80}]}]
 }
 assert.throws(()=>advanceProductionFlow(state,{flowId:'flow-a',organizationId:'org-a',siteId:'site-a',output:81}),/peso|salida|entrada|superar|masa/i)
 const terminal={...state,productionFlows:[{id:'flow-a',organizationId:'org-a',siteId:'site-a',stage:'Finalizado',wetWeight:100,history:[{stage:'Finalizado',output:60}]}]}
 assert.throws(()=>advanceProductionFlow(terminal,{flowId:'flow-a',organizationId:'org-a',siteId:'site-a',output:50}),/final|terminal|avanzar/i)
})

test('M4.2 F004: operational postharvest pages use the canonical production-lot authority, not legacy write arrays',()=>{
 for(const page of ['ProductionPage.jsx','DryingPage.jsx','TrimmingPage.jsx','SelectionPage.jsx','PackingPage.jsx']){
  const source=readFileSync(new URL(`../src/pages/${page}`,import.meta.url),'utf8')
  assert.match(source,/advanceProductionLot|CanonicalPostharvestStage/)
  assert.doesNotMatch(source,/appendPostharvestRecord/)
 }
 const flow=readFileSync(new URL('../src/pages/ProductionFlowPage.jsx',import.meta.url),'utf8')
 assert.match(flow,/advanceProductionLot/)
 assert.doesNotMatch(flow,/advanceProductionFlow|appendPostharvestRecord/)
})
