import test from'node:test'
import assert from'node:assert/strict'
import{GROWING_MEDIUM_KINDS,REUSE_ACTIONS,createGrowingMediumProduct,createGrowingMediumFormula,nextGrowingMediumFormulaVersion,createGrowingMediumBatch,createReusePolicy,createGrowingMediumAssignment,assignmentFromBatch,planReuseCycle,calculatePurchaseRequirement,createPurchaseRequirement}from'../src/domain/growingMedium.js'

const org='org-a',site='site-a'

test('M22-F001: product/formula/batch/assignment preserve tenant ownership and stable references',()=>{
 const product=createGrowingMediumProduct({id:'gm-coco',organizationId:org,name:'Coco premium',kind:GROWING_MEDIUM_KINDS.COCO,supplierId:'supplier-a'})
 const peat=createGrowingMediumProduct({id:'gm-peat',organizationId:org,name:'Turba',kind:GROWING_MEDIUM_KINDS.PEAT})
 const formula=createGrowingMediumFormula({id:'formula-70-30',organizationId:org,name:'Coco/Turba 70/30',version:1,components:[{productId:product.id,percentage:70},{productId:peat.id,percentage:30}]})
 const batch=createGrowingMediumBatch({id:'batch-1',organizationId:org,formulaId:formula.id,supplierLot:'LOT-2026-08',receivedVolumeLiters:1000,unitCostPerLiter:850})
 const assignment=createGrowingMediumAssignment({id:'assignment-1',organizationId:org,siteId:site,targetType:'BED',targetId:'bed-1',batchId:batch.id,volumeLiters:500,reusePolicyId:'reuse-1'})
 assert.equal(product.organizationId,org)
 assert.equal(formula.components.reduce((sum,item)=>sum+item.percentage,0),100)
 assert.equal(batch.formulaId,formula.id)
 assert.equal(assignment.batchId,batch.id)
 assert.equal(assignment.targetId,'bed-1')
})

test('M22-F004: formulas are deterministic and reject invalid composition',()=>{
 assert.throws(()=>createGrowingMediumFormula({id:'f1',organizationId:org,name:'Bad',components:[{productId:'a',percentage:80},{productId:'b',percentage:10}]}),/sumar 100/)
 assert.throws(()=>createGrowingMediumFormula({id:'f1',organizationId:org,name:'Bad',components:[{productId:'a',percentage:50},{productId:'a',percentage:50}]}),/repetir/)
})

test('M22-F004: a new formula version preserves immutable history and lineage',()=>{
 const previous=createGrowingMediumFormula({id:'formula-v1',organizationId:org,formulaKey:'mix-a',name:'Mezcla A',version:1,components:[{productId:'coco',percentage:70},{productId:'peat',percentage:30}],createdAt:'2026-01-01T00:00:00.000Z'})
 const snapshot=JSON.stringify(previous)
 const next=nextGrowingMediumFormulaVersion(previous,{id:'formula-v2',components:[{productId:'coco',percentage:60},{productId:'peat',percentage:40}],createdAt:'2026-02-01T00:00:00.000Z'})
 assert.equal(JSON.stringify(previous),snapshot)
 assert.equal(next.id,'formula-v2')
 assert.equal(next.formulaKey,'mix-a')
 assert.equal(next.version,2)
 assert.equal(next.supersedesFormulaId,'formula-v1')
 assert.deepEqual(next.components,[{productId:'coco',percentage:60},{productId:'peat',percentage:40}])
})

test('M22-F005: configurable 30/70 reuse replenishes until max uses then requires total replacement',()=>{
 const policy=createReusePolicy({id:'reuse-1',organizationId:org,name:'3 usos 30/70',replacementPercent:30,maxUses:3})
 const assignment=createGrowingMediumAssignment({id:'a1',organizationId:org,siteId:site,targetType:'BED',targetId:'bed-1',batchId:'batch-1',volumeLiters:100,reusePolicyId:policy.id,currentUse:1})
 const second=planReuseCycle({assignment,policy,completedUses:1})
 assert.deepEqual(second,{action:REUSE_ACTIONS.REPLENISH,nextUse:2,reusedVolumeLiters:70,freshVolumeLiters:30,replacementPercent:30})
 const third=planReuseCycle({assignment,policy,completedUses:2})
 assert.equal(third.freshVolumeLiters,30)
 assert.equal(third.nextUse,3)
 const renewal=planReuseCycle({assignment,policy,completedUses:3})
 assert.deepEqual(renewal,{action:REUSE_ACTIONS.FULL_REPLACEMENT,nextUse:1,reusedVolumeLiters:0,freshVolumeLiters:100,replacementPercent:100})
})

test('M22-F005: reuse cannot cross tenant boundaries',()=>{
 const assignment=createGrowingMediumAssignment({id:'a1',organizationId:'org-a',siteId:'site-a',targetType:'BED',targetId:'bed-1',batchId:'batch-1',volumeLiters:100})
 const policy=createReusePolicy({id:'p1',organizationId:'org-b',name:'Other tenant',replacementPercent:30,maxUses:3})
 assert.throws(()=>planReuseCycle({assignment,policy}),/misma organización/)
})

test('M22-F006: purchase requirement is reproducible from fresh-volume plans plus reserve',()=>{
 const result=calculatePurchaseRequirement({organizationId:org,siteId:site,plans:[{freshVolumeLiters:30},{freshVolumeLiters:100},{freshVolumeLiters:20}],reservePercent:10})
 assert.equal(result.baseVolumeLiters,150)
 assert.equal(result.requiredVolumeLiters,165)
})

test('M22-F006: persistent purchase requirement freezes scope period and source plans',()=>{
 const requirement=createPurchaseRequirement({id:'req-1',organizationId:org,siteId:site,scopeType:'BED',scopeId:'bed-1',periodStart:'2026-08-15',periodEnd:'2026-08-31',reservePercent:10,plans:[{assignmentId:'a1',targetType:'BED',targetId:'bed-1',batchId:'b1',supplierId:'s1',supplierLot:'LOT-1',action:'REPLENISH',currentUse:2,freshVolumeLiters:30,reusedVolumeLiters:70}],createdAt:'2026-08-15T12:00:00.000Z',createdBy:'u1'})
 assert.equal(requirement.baseVolumeLiters,30)
 assert.equal(requirement.requiredVolumeLiters,33)
 assert.equal(requirement.scopeType,'BED')
 assert.equal(requirement.scopeId,'bed-1')
 assert.equal(requirement.plans[0].supplierLot,'LOT-1')
 assert.equal(Object.isFrozen(requirement),true)
 assert.equal(Object.isFrozen(requirement.plans),true)
 assert.throws(()=>createPurchaseRequirement({...requirement,id:'bad',periodStart:'2026-09-01',periodEnd:'2026-08-31'}),/anterior/)
})

test('M22-F007: batch rejects impossible stock and ambiguous product/formula authority',()=>{
 assert.throws(()=>createGrowingMediumBatch({id:'b1',organizationId:org,productId:'p1',formulaId:'f1',supplierLot:'L1',receivedVolumeLiters:100}),/exactamente un producto o una fórmula/)
 assert.throws(()=>createGrowingMediumBatch({id:'b1',organizationId:org,productId:'p1',supplierLot:'L1',receivedVolumeLiters:100,availableVolumeLiters:101}),/no puede superar/)
})

test('M22-F007: assignment freezes batch supplier lot inventory linkage and cost snapshot',()=>{
 const batch=createGrowingMediumBatch({id:'batch-cost',organizationId:org,productId:'p1',supplierId:'supplier-1',supplierLot:'LOT-A',inventoryLotId:'inv-lot-1',receivedVolumeLiters:100,unitCostPerLiter:1234,currency:'COP'})
 const assignment=assignmentFromBatch({id:'assign-cost',organizationId:org,siteId:site,targetType:'BED',targetId:'bed-1',batchId:batch.id,volumeLiters:25},batch)
 const original={supplierId:assignment.supplierId,supplierLot:assignment.supplierLot,inventoryLotId:assignment.inventoryLotId,unitCostPerLiter:assignment.unitCostPerLiter,currency:assignment.currency,totalCost:assignment.totalCost}
 const editedBatch={...batch,supplierId:'supplier-2',supplierLot:'LOT-B',inventoryLotId:'inv-lot-2',unitCostPerLiter:9999,currency:'USD'}
 assert.deepEqual({supplierId:assignment.supplierId,supplierLot:assignment.supplierLot,inventoryLotId:assignment.inventoryLotId,unitCostPerLiter:assignment.unitCostPerLiter,currency:assignment.currency,totalCost:assignment.totalCost},original)
 assert.equal(assignment.totalCost,25*1234)
 assert.notEqual(editedBatch.unitCostPerLiter,assignment.unitCostPerLiter)
})
