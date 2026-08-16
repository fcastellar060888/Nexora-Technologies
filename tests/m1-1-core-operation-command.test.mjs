import test from'node:test'
import assert from'node:assert/strict'
import{executeCoreOperationCommand}from'../src/services/coreOperationCommand.js'
import{DomainEvents}from'../src/core/events/eventCatalog.js'

const baseSpec=apply=>({commandId:'cmd-1',organizationId:'org-1',siteId:'site-1',aggregateType:'facility.house',aggregateId:'house-1',completedEventName:DomainEvents.FACILITY_HOUSE_UPDATED,occurredAt:'2026-08-14T12:00:00.000Z',payload:{label:'Nave 1'},metadata:{collections:['houses']},apply})

test('M11-F012: intent is durable before core mutation and completion is causally linked',async()=>{
 const order=[],events=[]
 let state={houses:[{id:'house-1',name:'Antes'}]}
 await executeCoreOperationCommand(baseSpec(current=>({...current,houses:current.houses.map(item=>item.id==='house-1'?{...item,name:'Después'}:item)})),{
  publishEvent:async event=>{order.push(event.name);events.push(event)},
  commit:recipe=>{order.push('commit');state=recipe(state)}
 })
 assert.deepEqual(order,[DomainEvents.CORE_OPERATION_REQUESTED,'commit',DomainEvents.FACILITY_HOUSE_UPDATED])
 assert.equal(state.houses[0].name,'Después')
 assert.equal(events[0].eventId,'cmd-1:requested')
 assert.equal(events[1].eventId,'cmd-1:completed')
 assert.equal(events[1].correlationId,'cmd-1')
 assert.equal(events[1].causationId,'cmd-1:requested')
})

test('M11-F012: failure to persist intent prevents mutation',async()=>{
 let commits=0
 await assert.rejects(()=>executeCoreOperationCommand(baseSpec(state=>state),{publishEvent:async()=>{throw new Error('ledger unavailable')},commit:()=>{commits+=1}}),/ledger unavailable/)
 assert.equal(commits,0)
})

test('M11-F012: executor rejects unknown completion events before any side effect',async()=>{
 let publishes=0,commits=0
 await assert.rejects(()=>executeCoreOperationCommand({...baseSpec(state=>state),completedEventName:'facility.house.unknown'},{publishEvent:async()=>{publishes+=1},commit:()=>{commits+=1}}),/catálogo/)
 assert.equal(publishes,0)
 assert.equal(commits,0)
})

test('M31-F006: precondición remota ocurre entre intención y commit y controla la metadata de persistencia',async()=>{
 const order=[],events=[];let state={value:0},commitMeta
 await executeCoreOperationCommand({...baseSpec((current,confirmation)=>({...current,value:confirmation.value})),prepareCommit:async()=>{order.push('remote');return{value:7}},commitMeta:{sync:false}},{
  publishEvent:async event=>{order.push(event.name);events.push(event)},
  commit:(recipe,meta)=>{order.push('commit');commitMeta=meta;state=recipe(state)}
 })
 assert.deepEqual(order,[DomainEvents.CORE_OPERATION_REQUESTED,'remote','commit',DomainEvents.FACILITY_HOUSE_UPDATED])
 assert.equal(state.value,7)
 assert.deepEqual(commitMeta,{sync:false,audit:false})
 assert.equal(events.length,2)
})

test('M31-F006: fallo de precondición remota no produce commit ni evento final',async()=>{
 const events=[];let commits=0
 await assert.rejects(()=>executeCoreOperationCommand({...baseSpec(state=>state),prepareCommit:async()=>{throw new Error('MIRFE_INVENTORY_VERSION_CONFLICT')}},{
  publishEvent:async event=>events.push(event),
  commit:()=>{commits+=1}
 }),/VERSION_CONFLICT/)
 assert.equal(commits,0)
 assert.deepEqual(events.map(event=>event.name),[DomainEvents.CORE_OPERATION_REQUESTED])
})
