import test from'node:test'
import assert from'node:assert/strict'
import{GROWING_MEDIUM_KINDS,REUSE_ACTIONS,createGrowingMediumProduct,createGrowingMediumFormula,nextGrowingMediumFormulaVersion,createGrowingMediumBatch,createReusePolicy,createGrowingMediumAssignment,assignmentFromBatch,planReuseCycle,calculatePurchaseRequirement}from'../src/domain/growingMedium.js'

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

test('M22-F004: creating a formula version preserves the previous formula byte-for-byte',()=>{
 const previous=createGrowingMediumFormula({id:'formula-v1',organizationId:org,formulaKey:'coco-peat',name:'Coco/Turba',version:1,components:[{productId:'coco',percentage:70},{productId:'peat',percentage:30}],createdAt:'2026-08-01T00:00:00.000Z'})
 const before=JSON.stringify(previous)
 const next=nextGrowingMediumFormulaVersion(previous,{id:'formula-v2',components:[{productId:'coco',percentage:60},{productId:'peat',percentage:40}],createdAt:'2026-08-15T00:00:00.000Z'})
 assert.equal(JSON.stringify(previous),before)
 assert.notEqual(next.id,previous.id)
 assert.equal(next.formulaKey,previous.formulaKey)
 assert.equal(next.version,2)
 assert.equal(next.supersedesFormulaId,previous.id)
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

test('M22-F007: batch rejects impossible stock and ambiguous product/formula authority',()=>{
 assert.throws(()=>createGrowingMediumBatch({id:'b1',organizationId:org,productId:'p1',formulaId:'f1',supplierLot:'L1',receivedVolumeLiters:100}),/exactamente un producto o una fórmula/)
 assert.throws(()=>createGrowingMediumBatch({id:'b1',organizationId:org,productId:'p1',supplierLot:'L1',receivedVolumeLiters:100,availableVolumeLiters:101}),/no puede superar/)
})

test('M22-F007: assignment freezes supplier lot, inventory lot and cost from the batch at assignment time',()=>{
 const batch=createGrowingMediumBatch({id:'batch-cost',organizationId:org,productId:'p1',supplierId:'supplier-a',supplierLot:'LOT-A',inventoryLotId:'inv-a',receivedVolumeLiters:100,unitCostPerLiter:850,currency:'COP'})
 const assignment=assignmentFromBatch({id:'assignment-cost',organizationId:org,siteId:site,targetType:'BED',targetId:'bed-1',batchId:batch.id,volumeLiters:40},batch)
 const editedBatch={...batch,supplierId:'supplier-b',supplierLot:'LOT-B',inventoryLotId:'inv-b',unitCostPerLiter:1200,currency:'USD'}
 assert.equal(editedBatch.unitCostPerLiter,1200)
 assert.equal(assignment.supplierId,'supplier-a')
 assert.equal(assignment.supplierLot,'LOT-A')
 assert.equal(assignment.inventoryLotId,'inv-a')
 assert.equal(assignment.unitCostPerLiter,850)
 assert.equal(assignment.currency,'COP')
 assert.equal(assignment.totalCost,34000)
})
