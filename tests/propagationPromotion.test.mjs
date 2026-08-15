import test from'node:test'
import assert from'node:assert/strict'
import{PROMOTION_TARGETS,promotablePropagationUnits,promotionTargetForBatch,promotePropagationUnits}from'../src/domain/propagationPromotion.js'
import{PROPAGATION_PURPOSES}from'../src/domain/propagationPurpose.js'

const baseState=purpose=>({
 propagationBatches:[{id:'b1',code:'LP-001',purpose,siteId:'s1',geneticId:'g1',sourcePlantId:'M-001',sourceLotId:'gm1',grandmotherPlantId:'gm1',activeQuantity:2,productionLotId:'b1'}],
 propagationUnits:[{id:'u1',batchId:'b1',code:'E1',status:'Enraizado'},{id:'u2',batchId:'b1',code:'E2',status:'Enraizado'}],
 motherPlants:[],grandmotherPlants:[],plantPositions:[],lotEvents:[],houses:[{id:'h1',siteId:'s1'}],beds:[{id:'bed1',houseId:'h1',plantsPerRow:10}]
})

test('solo permite promover esquejes enraizados y disponibles',()=>{
 const state=baseState(PROPAGATION_PURPOSES.MOTHER_RENEWAL)
 assert.deepEqual(promotablePropagationUnits(state,'b1').map(unit=>unit.id),['u1','u2'])
 state.propagationUnits[1].status='Cortado'
 assert.deepEqual(promotablePropagationUnits(state,'b1').map(unit=>unit.id),['u1'])
})

test('renovación de madres crea lote trazable y bloquea doble promoción',()=>{
 const state=baseState(PROPAGATION_PURPOSES.MOTHER_RENEWAL)
 const next=promotePropagationUnits(state,{batchId:'b1',unitIds:['u1','u2'],effectiveDate:'2026-08-01',responsible:'Fer'})
 assert.equal(next.motherPlants.length,1)
 assert.equal(next.motherPlants[0].quantity,2)
 assert.deepEqual(next.motherPlants[0].sourcePropagationUnitIds,['u1','u2'])
 assert.equal(next.propagationUnits[0].status,'Promovido')
 assert.equal(next.propagationBatches[0].promotionStatus,'Completada')
 assert.throws(()=>promotePropagationUnits(next,{batchId:'b1',unitIds:['u1']}),/no disponibles/)
})

test('renovación de abuelas crea lote separado de producción',()=>{
 const state=baseState(PROPAGATION_PURPOSES.GRANDMOTHER_RENEWAL)
 assert.equal(promotionTargetForBatch(state.propagationBatches[0]),PROMOTION_TARGETS.GRANDMOTHER)
 const next=promotePropagationUnits(state,{batchId:'b1',unitIds:['u1'],effectiveDate:'2026-08-01'})
 assert.equal(next.grandmotherPlants.length,1)
 assert.equal(next.plantPositions.length,0)
 assert.equal(next.propagationUnits[0].promotionTarget,PROMOTION_TARGETS.GRANDMOTHER)
})

test('producción ubica cada esqueje en nave y cama conservando genealogía',()=>{
 const state=baseState(PROPAGATION_PURPOSES.PRODUCTION)
 const next=promotePropagationUnits(state,{batchId:'b1',unitIds:['u1','u2'],effectiveDate:'2026-08-01',houseId:'h1',bedId:'bed1'})
 assert.equal(next.plantPositions.length,2)
 assert.equal(next.plantPositions[0].sourcePropagationUnitId,'u1')
 assert.equal(next.plantPositions[0].directParentPlantId,'M-001')
 assert.equal(next.propagationUnits[1].bedId,'bed1')
})

test('rechaza una cama que no corresponde a la nave',()=>{
 const state=baseState(PROPAGATION_PURPOSES.PRODUCTION)
 assert.throws(()=>promotePropagationUnits(state,{batchId:'b1',unitIds:['u1'],houseId:'otra',bedId:'bed1'}),/cama válida/)
})
