import test from 'node:test'
import assert from 'node:assert/strict'

import {advanceProductionLot} from '../src/domain/production.js'

const stateFor=propagationBatches=>({
 currentContext:{companyId:'org-a'},
 companies:[{id:'org-a'},{id:'org-b'}],
 sites:[
  {id:'site-a',organizationId:'org-a'},
  {id:'site-b',organizationId:'org-b'}
 ],
 propagationBatches,
 lotEvents:[]
})

const harvestLedger=grams=>({Cosecha:{inputGrams:grams,outputGrams:grams,lossGrams:0,yieldPct:100,date:'2026-08-18'}})

test('M4.2 F001: advancing a homonymous production lot mutates only the active tenant candidate',()=>{
 const state=stateFor([
  {id:'lot-shared',organizationId:'org-b',siteId:'site-b',phase:'Cosecha',activeQuantity:80,productionLedger:harvestLedger(900)},
  {id:'lot-shared',organizationId:'org-a',siteId:'site-a',phase:'Cosecha',activeQuantity:50,productionLedger:harvestLedger(700)}
 ])

 const next=advanceProductionLot(state,{
  lotId:'lot-shared',
  phase:'Secado',
  quantity:50,
  outputWeight:600,
  date:'2026-08-19',
  eventId:'evt-a',
  createdAt:'2026-08-19T12:00:00.000Z'
 })

 assert.equal(next.propagationBatches[0].organizationId,'org-b')
 assert.equal(next.propagationBatches[0].phase,'Cosecha')
 assert.equal(next.propagationBatches[0].productionLedger.Secado,undefined)
 assert.equal(next.propagationBatches[1].organizationId,'org-a')
 assert.equal(next.propagationBatches[1].phase,'Secado')
 assert.equal(next.propagationBatches[1].productionLedger.Secado.outputGrams,600)
 assert.deepEqual(next.lotEvents.map(({organizationId,siteId,lotId})=>({organizationId,siteId,lotId})),[
  {organizationId:'org-a',siteId:'site-a',lotId:'lot-shared'}
 ])
})

test('M4.2 F001: a production lot belonging only to another organization is rejected',()=>{
 const state=stateFor([
  {id:'foreign-lot',organizationId:'org-b',siteId:'site-b',phase:'Cosecha',activeQuantity:30,productionLedger:harvestLedger(500)}
 ])
 assert.throws(()=>advanceProductionLot(state,{
  lotId:'foreign-lot',phase:'Secado',quantity:30,outputWeight:450,date:'2026-08-19'
 }),/empresa|organización|ownership|lote/i)
})

test('M4.2 F001: duplicate production lot identity inside the active tenant fails closed',()=>{
 const state=stateFor([
  {id:'dup-lot',organizationId:'org-a',siteId:'site-a',phase:'Cosecha',activeQuantity:30,productionLedger:harvestLedger(500)},
  {id:'dup-lot',organizationId:'org-a',siteId:'site-a',phase:'Cosecha',activeQuantity:20,productionLedger:harvestLedger(400)}
 ])
 assert.throws(()=>advanceProductionLot(state,{
  lotId:'dup-lot',phase:'Secado',quantity:20,outputWeight:350,date:'2026-08-19'
 }),/duplicad|ambigu/i)
})
