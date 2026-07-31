import test from'node:test'
import assert from'node:assert/strict'
import{advanceProductionLot,packedAvailableGrams,receiveFinishedGoods}from'../src/domain/production.js'

test('mantiene balance de masa entre cosecha, secado y manicura',()=>{
 let state={propagationBatches:[{id:'l1',phase:'Floración',activeQuantity:100}],lotEvents:[],finishedGoods:[],finishedGoodsMovements:[]}
 state=advanceProductionLot(state,{lotId:'l1',phase:'Cosecha',date:'2026-07-30',quantity:100,discarded:0,outputWeight:100000,eventId:'e1'})
 state=advanceProductionLot(state,{lotId:'l1',phase:'Secado',date:'2026-08-10',quantity:100,discarded:0,outputWeight:25000,eventId:'e2'})
 state=advanceProductionLot(state,{lotId:'l1',phase:'Manicura',date:'2026-08-12',quantity:100,discarded:0,outputWeight:22000,eventId:'e3'})
 assert.equal(state.propagationBatches[0].productionLedger.Secado.lossGrams,75000)
 assert.equal(state.propagationBatches[0].productionLedger.Secado.yieldPct,25)
 assert.equal(state.propagationBatches[0].productionLedger.Manicura.outputGrams,22000)
})

test('bloquea saltos de fase y aumentos de peso',()=>{
 const state={propagationBatches:[{id:'l1',phase:'Cosecha',productionLedger:{Cosecha:{outputGrams:1000}}}],lotEvents:[]}
 assert.throws(()=>advanceProductionLot(state,{lotId:'l1',phase:'Manicura',outputWeight:800}),/debe avanzar/)
 assert.throws(()=>advanceProductionLot(state,{lotId:'l1',phase:'Secado',outputWeight:1200}),/no puede superar/)
})

test('producto terminado no puede superar el empaque disponible',()=>{
 const state={propagationBatches:[{id:'l1',phase:'Empaque',geneticId:'g1',productionLedger:{Empaque:{outputGrams:1000}}}],finishedGoods:[],finishedGoodsMovements:[]}
 const first=receiveFinishedGoods(state,{id:'fg1',movementId:'m1',lotId:'l1',classification:'Premium',packedGrams:600,packedAt:'2026-08-15'})
 assert.equal(packedAvailableGrams(first,'l1'),400)
 assert.throws(()=>receiveFinishedGoods(first,{lotId:'l1',classification:'Estándar',packedGrams:500}),/Solo quedan 400 g/)
})
