import test from'node:test'
import assert from'node:assert/strict'
import{createCultivationPlantPassportFromState}from'../src/core/passport/cultivationPlantPassport.js'
import{createKnowledgeGraphRepository,projectPassportToGraph}from'../src/core/knowledgeGraph/index.js'

const baseState=()=>({
 companies:[{id:'org-a',name:'Org A'},{id:'org-b',name:'Org B'}],
 currentContext:{companyId:'org-a',siteId:'site-a'},
 sites:[{id:'site-a',companyId:'org-a',organizationId:'org-a',name:'Sede A'},{id:'site-b',companyId:'org-b',organizationId:'org-b',name:'Sede B'}],
 houses:[{id:'house-a',organizationId:'org-a',siteId:'site-a',name:'Nave A'},{id:'house-b',organizationId:'org-b',siteId:'site-b',name:'Nave B'}],
 beds:[{id:'bed-shared',organizationId:'org-a',siteId:'site-a',houseId:'house-a',name:'Cama A',growingMediumAssignmentId:'assignment-shared'},{id:'bed-shared',organizationId:'org-b',siteId:'site-b',houseId:'house-b',name:'Cama B',growingMediumAssignmentId:'assignment-shared'}],
 plantPositions:[{id:'plant-shared',organizationId:'org-a',siteId:'site-a',houseId:'house-a',bedId:'bed-shared',row:1,position:1,status:'Activa',active:true,createdAt:'2026-08-01T00:00:00.000Z'},{id:'plant-shared',organizationId:'org-b',siteId:'site-b',houseId:'house-b',bedId:'bed-shared',row:1,position:1,status:'Activa',active:true,createdAt:'2026-08-01T00:00:00.000Z'}],
 genetics:[],propagationUnits:[],propagationBatches:[],motherPlants:[],grandmotherPlants:[],attachments:[],findings:[],incidents:[],products:[],treatments:[],plantEvents:[],timelineEntries:[],
 growingMediumAssignments:[{id:'assignment-shared',organizationId:'org-a',siteId:'site-a',targetType:'BED',targetId:'bed-shared',batchId:'batch-shared',volumeLiters:100,reusePolicyId:'policy-shared',currentUse:2,supplierId:'supplier-a',supplierLot:'LOT-A',inventoryLotId:'inv-a',unitCostPerLiter:1000,currency:'COP',totalCost:100000,active:true},{id:'assignment-shared',organizationId:'org-b',siteId:'site-b',targetType:'BED',targetId:'bed-shared',batchId:'batch-shared',volumeLiters:999,reusePolicyId:'policy-shared',currentUse:1,supplierId:'supplier-b',supplierLot:'LOT-B',inventoryLotId:'inv-b',unitCostPerLiter:9999,currency:'USD',totalCost:9989001,active:true}],
 growingMediumBatches:[{id:'batch-shared',organizationId:'org-a',productId:'product-shared',supplierId:'supplier-a',supplierLot:'LOT-A',inventoryLotId:'inv-a',receivedVolumeLiters:500,availableVolumeLiters:400,unitCostPerLiter:1000,currency:'COP',active:true},{id:'batch-shared',organizationId:'org-b',productId:'product-shared',supplierId:'supplier-b',supplierLot:'LOT-B',inventoryLotId:'inv-b',receivedVolumeLiters:500,availableVolumeLiters:400,unitCostPerLiter:9999,currency:'USD',active:true}],
 growingMediumProducts:[{id:'product-shared',organizationId:'org-a',name:'Coco A',kind:'COCO',active:true},{id:'product-shared',organizationId:'org-b',name:'Coco B',kind:'COCO',active:true}],
 growingMediumFormulas:[],
 growingMediumReusePolicies:[{id:'policy-shared',organizationId:'org-a',name:'30/70 A',replacementPercent:30,maxUses:3,active:true},{id:'policy-shared',organizationId:'org-b',name:'50/50 B',replacementPercent:50,maxUses:2,active:true}],
 growingMediumReuseCycles:[{id:'cycle-shared',organizationId:'org-a',assignmentId:'assignment-shared',action:'REPLENISH',freshVolumeLiters:30,reusedVolumeLiters:70,recordedAt:'2026-08-10T00:00:00.000Z'},{id:'cycle-shared',organizationId:'org-b',assignmentId:'assignment-shared',action:'REPLENISH',freshVolumeLiters:500,reusedVolumeLiters:499,recordedAt:'2026-08-10T00:00:00.000Z'}]
})

test('M22-F009: Passport resolves growing medium evidence only inside active tenant when ids repeat',()=>{
 const passport=createCultivationPlantPassportFromState(baseState(),{plantId:'plant-shared'})
 assert.equal(passport.object.organizationId,'org-a')
 assert.equal(passport.object.attributes.growingMediumAssignmentId,'assignment-shared')
 assert.equal(passport.object.attributes.growingMediumProductId,'product-shared')
 assert.equal(passport.object.metadata.growingMedium.supplierLot,'LOT-A')
 assert.equal(passport.object.metadata.growingMedium.totalCost,100000)
 assert.equal(passport.object.metadata.growingMedium.reuseCycles,1)
 const medium=passport.relationships.find(item=>item.type==='grown_in_medium')
 assert.equal(medium.targetOrganizationId,'org-a')
 assert.equal(medium.supplierLot,'LOT-A')
 assert.equal(medium.totalCost,100000)
 assert.ok(passport.relationships.some(item=>item.type==='uses_medium_product'&&item.label==='Coco A'))
 assert.ok(passport.relationships.some(item=>item.type==='has_medium_reuse_cycle'&&item.freshVolumeLiters===30))
 assert.equal(passport.relationships.some(item=>item.label==='Coco B'||item.supplierLot==='LOT-B'),false)
})

test('M22-F009: Knowledge Graph preserves canonical medium relationships and evidence',()=>{
 const passport=createCultivationPlantPassportFromState(baseState(),{plantId:'plant-shared'}),repository=createKnowledgeGraphRepository()
 const projected=projectPassportToGraph(repository,passport)
 assert.ok(projected.edges.some(edge=>edge.relationType==='grown_in_medium'&&edge.organizationId==='org-a'))
 assert.ok(projected.edges.some(edge=>edge.relationType==='medium_from_batch'))
 assert.ok(projected.edges.some(edge=>edge.relationType==='uses_medium_product'))
 assert.ok(projected.edges.some(edge=>edge.relationType==='governed_by_reuse_policy'))
 assert.ok(projected.edges.some(edge=>edge.relationType==='has_medium_reuse_cycle'))
 const source=repository.snapshot().nodes.find(node=>node.nodeType==='cultivation.plant'&&node.organizationId==='org-a')
 assert.equal(source.metadata.intelligentObject.attributes.growingMediumAssignmentId,'assignment-shared')
 assert.equal(source.metadata.intelligentObject.metadata.growingMedium.supplierLot,'LOT-A')
 assert.equal(repository.snapshot().nodes.some(node=>node.organizationId==='org-b'),false)
})

test('M22-F009: a bed reference to foreign-only assignment fails closed instead of leaking medium evidence',()=>{
 const state=baseState()
 state.growingMediumAssignments=state.growingMediumAssignments.filter(item=>item.organizationId==='org-b')
 assert.throws(()=>createCultivationPlantPassportFromState(state,{plantId:'plant-shared'}),/asignación de medio no existe en la empresa de la planta/)
})
