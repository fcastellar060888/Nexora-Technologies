import test from'node:test'
import assert from'node:assert/strict'
import{GROWING_MEDIUM_KINDS}from'../src/domain/growingMedium.js'
import{GROWING_MEDIUM_OPERATIONS,executeGrowingMediumCommand}from'../src/services/growingMediumCommand.js'

const fixture=()=>({
 companies:[{id:'org-a'}],sites:[{id:'site-a',companyId:'org-a'}],currentContext:{companyId:'org-a',siteId:'site-a'},
 users:[{id:'u1',activeSession:true,active:true,remote:true}],roles:[{id:'grower',permissions:['manage_cultivation']}],memberships:[{id:'m1',userId:'u1',companyId:'org-a',roleId:'grower',siteIds:['site-a'],status:'active'}],
 growingMediumProducts:[],growingMediumFormulas:[],growingMediumBatches:[],growingMediumAssignments:[],growingMediumReusePolicies:[],growingMediumReuseCycles:[]
})

async function run(state,command){
 let current=state;const events=[]
 const result=await executeGrowingMediumCommand(current,command,{publishEvent:async event=>events.push(event),commit:recipe=>{current=recipe(current)}})
 return{state:current,events,result}
}

test('M22-F001/F008: product creation publishes durable intent then canonical event',async()=>{
 const{state,events}=await run(fixture(),{operation:GROWING_MEDIUM_OPERATIONS.CREATE_PRODUCT,entityId:'gm-1',commandId:'cmd-1',input:{name:'Coco',kind:GROWING_MEDIUM_KINDS.COCO}})
 assert.equal(state.growingMediumProducts.length,1)
 assert.equal(state.growingMediumProducts[0].organizationId,'org-a')
 assert.deepEqual(events.map(event=>event.name),['core.operation.requested','growing_medium.product.created'])
 assert.deepEqual(events.map(event=>event.eventId),['cmd-1:requested','cmd-1:completed'])
})

test('M22-F002/F007: assignment consumes batch volume exactly once and retry is idempotent',async()=>{
 let state=fixture(),events=[]
 ;({state}=await run(state,{operation:GROWING_MEDIUM_OPERATIONS.CREATE_PRODUCT,entityId:'gm-1',commandId:'c1',input:{name:'Coco',kind:GROWING_MEDIUM_KINDS.COCO}}))
 ;({state}=await run(state,{operation:GROWING_MEDIUM_OPERATIONS.REGISTER_BATCH,entityId:'batch-1',commandId:'c2',input:{productId:'gm-1',supplierLot:'LOT-1',receivedVolumeLiters:100,availableVolumeLiters:100,unitCostPerLiter:1000}}))
 const deps={publishEvent:async event=>events.push(event),commit:recipe=>{state=recipe(state)}}
 const command={operation:GROWING_MEDIUM_OPERATIONS.CREATE_ASSIGNMENT,entityId:'assign-1',commandId:'assign-cmd',input:{siteId:'site-a',targetType:'BED',targetId:'bed-1',batchId:'batch-1',volumeLiters:40}}
 await executeGrowingMediumCommand(state,command,deps)
 await executeGrowingMediumCommand(state,command,deps)
 assert.equal(state.growingMediumAssignments.length,1)
 assert.equal(state.growingMediumBatches[0].availableVolumeLiters,60)
})

test('M22-F002: assignment fails closed on insufficient or foreign batch',async()=>{
 let state=fixture()
 state.growingMediumBatches=[{id:'batch-x',organizationId:'org-b',productId:'gm-x',supplierLot:'X',receivedVolumeLiters:100,availableVolumeLiters:100,unitCostPerLiter:0,currency:'COP',active:true}]
 await assert.rejects(()=>executeGrowingMediumCommand(state,{operation:GROWING_MEDIUM_OPERATIONS.CREATE_ASSIGNMENT,entityId:'a1',input:{siteId:'site-a',targetType:'BED',targetId:'bed-1',batchId:'batch-x',volumeLiters:10}},{publishEvent:async()=>{},commit:()=>{}}),/no existe en la organización activa/)
})

test('M22-F005/F008: reuse policy and cycle are recorded through canonical events',async()=>{
 let state=fixture(),events=[]
 const deps={publishEvent:async event=>events.push(event),commit:recipe=>{state=recipe(state)}}
 await executeGrowingMediumCommand(state,{operation:GROWING_MEDIUM_OPERATIONS.CREATE_PRODUCT,entityId:'gm-1',commandId:'p',input:{name:'Coco',kind:GROWING_MEDIUM_KINDS.COCO}},deps)
 await executeGrowingMediumCommand(state,{operation:GROWING_MEDIUM_OPERATIONS.REGISTER_BATCH,entityId:'b1',commandId:'b',input:{productId:'gm-1',supplierLot:'L1',receivedVolumeLiters:100}},deps)
 await executeGrowingMediumCommand(state,{operation:GROWING_MEDIUM_OPERATIONS.CREATE_REUSE_POLICY,entityId:'rp1',commandId:'rp',input:{name:'3 usos 30/70',replacementPercent:30,maxUses:3}},deps)
 await executeGrowingMediumCommand(state,{operation:GROWING_MEDIUM_OPERATIONS.CREATE_ASSIGNMENT,entityId:'a1',commandId:'a',input:{siteId:'site-a',targetType:'BED',targetId:'bed-1',batchId:'b1',volumeLiters:50,reusePolicyId:'rp1'}},deps)
 await executeGrowingMediumCommand(state,{operation:GROWING_MEDIUM_OPERATIONS.RECORD_REUSE,entityId:'rc1',commandId:'r',input:{assignmentId:'a1',completedUses:1,responsibleId:'u1'}},deps)
 assert.equal(state.growingMediumReuseCycles.length,1)
 assert.equal(state.growingMediumReuseCycles[0].freshVolumeLiters,15)
 assert.equal(state.growingMediumAssignments[0].currentUse,2)
 assert.ok(events.some(event=>event.name==='growing_medium.reuse_policy.created'))
 assert.ok(events.some(event=>event.name==='growing_medium.reuse.recorded'))
})
