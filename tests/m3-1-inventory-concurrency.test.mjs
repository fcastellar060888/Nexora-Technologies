import test from'node:test'
import assert from'node:assert/strict'
import{readFile}from'node:fs/promises'
import{DomainEvents}from'../src/core/events/eventCatalog.js'
import{IRRIGATION_MIRFE_OPERATIONS,executeIrrigationMirfeCommand}from'../src/services/irrigationMirfeCommand.js'
import{commitMirfeInventoryTransaction}from'../src/services/mirfeInventoryTransaction.js'

const fixture=()=>({
 companies:[{id:'org-a'},{id:'org-b'}],currentContext:{companyId:'org-a',siteId:'site-1'},
 users:[{id:'user-1',name:'Ana',activeSession:true,active:true,remote:true}],
 roles:[{id:'agronomist',permissions:['manage_irrigation','approve_formulas','record_irrigation']}],
 memberships:[{id:'membership-1',userId:'user-1',companyId:'org-a',roleId:'agronomist',siteIds:['site-1'],status:'active'}],
 sites:[{id:'site-b',organizationId:'org-b'},{id:'site-1',organizationId:'org-a'}],
 genetics:[],houses:[],beds:[],plantPositions:[],propagationBanks:[],propagationUnits:[],
 products:[{id:'inventory-1',organizationId:'org-b',unit:'kg',cost:9000},{id:'inventory-1',organizationId:'org-a',unit:'kg',cost:3000}],
 nutrientProducts:[{id:'nutrient-1',organizationId:'org-b',inventoryProductId:'inventory-1'},{id:'nutrient-1',organizationId:'org-a',inventoryProductId:'inventory-1'}],
 formulations:[{id:'formula-1',organizationId:'org-b',siteId:'site-b',status:'Aprobada',items:[]},{id:'formula-1',organizationId:'org-a',siteId:'site-1',status:'Aprobada',volumeL:1000,stage:'Vegetativo',items:[{productId:'nutrient-1',tank:'A',grams:500}]}],
 tankPreparations:[
  {id:'prep-1',organizationId:'org-b',siteId:'site-b',formulationId:'formula-1',status:'Pendiente',items:[],_syncVersion:8},
  {id:'prep-1',organizationId:'org-a',siteId:'site-1',formulationId:'formula-1',volumeL:1000,stage:'Vegetativo',status:'Pendiente',items:[{id:'item-1',nutrientProductId:'nutrient-1',inventoryProductId:'inventory-1',requiredQuantity:500,requiredUnit:'g',tank:'A',lotId:'',consumedQuantity:0,cost:0}],_syncVersion:3}
 ],
 inventoryLots:[{id:'lot-1',organizationId:'org-b',productId:'inventory-1',siteId:'site-b',quantity:8,_syncVersion:9},{id:'lot-1',organizationId:'org-a',productId:'inventory-1',siteId:'site-1',quantity:0.8,_syncVersion:4}],
 inventoryMovements:[],waterAnalyses:[],nutrientObjectives:[],irrigationPlans:[],irrigationEmitters:[],irrigationSectors:[],irrigationAssignments:[],irrigationPulses:[],irrigationMeasurements:[],drainageMeasurements:[],
 irrigationApplications:[],workOrders:[],costEntries:[],mirfePrograms:[],mirfeMonitoring:[],mirfeReinforcements:[],irrigationCorrections:[],irrigationHistory:[]
})

const command=commandId=>({operation:IRRIGATION_MIRFE_OPERATIONS.EXECUTE_PREPARATION,commandId,occurredAt:'2026-08-16T15:00:00.000Z',input:{preparationId:'prep-1',siteId:'site-1',allocations:{'item-1':'lot-1'},responsible:'Ana'}})

const confirmation=transaction=>({remote:true,duplicate:false,records:transaction.mutations.map(mutation=>({companyId:transaction.organizationId,collection:mutation.collection,recordId:mutation.recordId,payload:mutation.payload,version:mutation.baseVersion+1,updatedAt:'2026-08-16T15:00:01.000Z',deletedAt:null}))})

test('M31-F006: transacción remota ocurre antes del commit y confirma todas las consecuencias como una unidad',async()=>{
 let state=fixture(),captured,commitMeta;const order=[],events=[]
 await executeIrrigationMirfeCommand(state,command('device-a-command'),{
  publishEvent:async event=>{events.push(event);order.push(event.name)},
  commitInventoryTransaction:async transaction=>{captured=transaction;order.push('remote');return confirmation(transaction)},
  commit:(recipe,meta)=>{commitMeta=meta;order.push('commit');state=recipe(state)}
 })
 assert.deepEqual(order,[DomainEvents.CORE_OPERATION_REQUESTED,'remote','commit',DomainEvents.MIRFE_PREPARATION_COMPLETED])
 assert.deepEqual([...new Set(captured.mutations.map(item=>item.collection))],['inventoryLots','inventoryMovements','tankPreparations','costEntries','workOrders'])
 assert.equal(captured.mutations.find(item=>item.collection==='inventoryLots').baseVersion,4)
 assert.equal(captured.mutations.find(item=>item.collection==='tankPreparations').baseVersion,3)
 assert.equal(captured.mutations.find(item=>item.collection==='inventoryMovements'&&item.payload.sourceType==='MirfePreparation').recordId,'device-a-command:movement:0')
 assert.deepEqual(commitMeta,{sync:false,audit:false})
 assert.equal(state.inventoryLots.find(item=>item.organizationId==='org-a').quantity,0.30000000000000004)
 assert.equal(state.inventoryLots.find(item=>item.organizationId==='org-a')._syncVersion,5)
 assert.equal(state.inventoryLots.find(item=>item.organizationId==='org-b').quantity,8)
 assert.equal(state.inventoryMovements.length,2)
 assert.equal(state.costEntries.length,1)
 assert.equal(state.workOrders.length,1)
 assert.equal(state.tankPreparations.find(item=>item.organizationId==='org-a').status,'Preparada')
 assert.equal(events.at(-1).name,DomainEvents.MIRFE_PREPARATION_COMPLETED)
})

test('M31-F006: dos dispositivos parten de la misma versión; el perdedor no hace commit ni publica completion',async()=>{
 let firstState=fixture(),firstTransaction
 await executeIrrigationMirfeCommand(firstState,command('device-a-command'),{
  publishEvent:async()=>{},
  commitInventoryTransaction:async transaction=>{firstTransaction=transaction;return confirmation(transaction)},
  commit:recipe=>{firstState=recipe(firstState)}
 })
 let secondState=fixture(),secondTransaction,secondCommits=0;const secondEvents=[]
 await assert.rejects(()=>executeIrrigationMirfeCommand(secondState,command('device-b-command'),{
  publishEvent:async event=>secondEvents.push(event),
  commitInventoryTransaction:async transaction=>{secondTransaction=transaction;throw new Error('MIRFE_INVENTORY_VERSION_CONFLICT:inventoryLots:lot-1:5')},
  commit:()=>{secondCommits+=1}
 }),/VERSION_CONFLICT/)
 assert.equal(firstTransaction.mutations.find(item=>item.collection==='inventoryLots').baseVersion,4)
 assert.equal(secondTransaction.mutations.find(item=>item.collection==='inventoryLots').baseVersion,4)
 assert.equal(secondCommits,0)
 assert.equal(secondState.inventoryLots.find(item=>item.organizationId==='org-a').quantity,0.8)
 assert.equal(secondState.inventoryMovements.length,0)
 assert.equal(secondState.costEntries.length,0)
 assert.equal(secondState.workOrders.length,0)
 assert.deepEqual(secondEvents.map(event=>event.name),[DomainEvents.CORE_OPERATION_REQUESTED])
})

test('M31-F006: cambio de tenant durante el RPC no aplica confirmación ni publica completion',async()=>{
 const state=fixture(),events=[];let remoteCalls=0,commitCalls=0
 await assert.rejects(()=>executeIrrigationMirfeCommand(state,command('tenant-switch-command'),{
  publishEvent:async event=>events.push(event),
  commitInventoryTransaction:async transaction=>{remoteCalls+=1;return confirmation(transaction)},
  commit:recipe=>{
   commitCalls+=1
   const switched={...state,currentContext:{companyId:'org-b',siteId:'site-b'}}
   recipe(switched)
  }
 }),/empresa activa cambió/)
 assert.equal(remoteCalls,1)
 assert.equal(commitCalls,1)
 assert.deepEqual(events.map(event=>event.name),[DomainEvents.CORE_OPERATION_REQUESTED])
 assert.equal(state.inventoryLots.find(item=>item.organizationId==='org-a').quantity,0.8)
})

test('M31-F006: respuesta remota perdida se recupera por commandId sin duplicar efectos',async()=>{
 const transaction={commandId:'cmd-1',organizationId:'org-a',signature:'signature',preparationId:'prep-1',mutations:[{collection:'inventoryLots',recordId:'lot-1'}]}
 let calls=0
 const result=await commitMirfeInventoryTransaction(transaction,{request:async(path,options)=>{
  calls+=1
  assert.equal(path,'/rest/v1/rpc/commit_mirfe_inventory_execution')
  assert.equal(options.body.p_command_id,'cmd-1')
  return[{status:'applied',duplicate:true,records:[{companyId:'org-a',collection:'inventoryLots',recordId:'lot-1',payload:{id:'lot-1'},version:5,updatedAt:'2026-08-16T15:00:01.000Z'}]}]
 }})
 assert.equal(calls,1)
 assert.equal(result.duplicate,true)
 assert.equal(result.records[0].version,5)
})

test('M31-F006: una confirmación remota parcial o con identidad ajena falla cerrada',async()=>{
 const transaction={commandId:'cmd-2',organizationId:'org-a',signature:'signature',preparationId:'prep-1',mutations:[{collection:'inventoryLots',recordId:'lot-1'},{collection:'tankPreparations',recordId:'prep-1'}]}
 await assert.rejects(()=>commitMirfeInventoryTransaction(transaction,{request:async()=>[{status:'applied',duplicate:false,records:[{companyId:'org-a',collection:'inventoryLots',recordId:'lot-1',payload:{id:'lot-1'},version:5,updatedAt:'2026-08-16T15:00:01.000Z'}]}]}),/conjunto canónico completo/)
})

test('M31-F006: contrato SQL bloquea, preflighta todas las versiones y persiste idempotencia antes de completion',async()=>{
 const source=await readFile(new URL('../supabase/migrations/20260816130000_mirfe_inventory_execution.sql',import.meta.url),'utf8')
 assert.match(source,/mirfe_inventory_executions/)
 assert.match(source,/pg_advisory_xact_lock/)
 assert.match(source,/for update/gi)
 assert.match(source,/MIRFE_INVENTORY_VERSION_CONFLICT/)
 assert.match(source,/collection is outside MIRFE inventory transaction boundary/)
 assert.match(source,/MIRFE inventory movement chain is discontinuous/)
 assert.match(source,/remote MIRFE inventory lot balance mismatch/)
 assert.match(source,/remote MIRFE preparation is not pending or was altered/)
 assert.match(source,/duplicate MIRFE inventory mutation identity/)
 assert.match(source,/MIRFE inventory mutation site mismatch/)
 assert.match(source,/site_id text not null/)
 assert.match(source,/v_site_id:=v_existing\.site_id/)
 assert.match(source,/insert into public\.mirfe_inventory_executions/)
 assert.match(source,/commandId already belongs to different MIRFE inventory content/)
 assert.match(source,/revoke all on public\.mirfe_inventory_executions from public, anon, authenticated/)
 const preflight=source.indexOf("MIRFE_INVENTORY_VERSION_CONFLICT"),write=source.indexOf("insert into public.erp_records")
 assert.ok(preflight>0&&write>preflight)
 const access=source.indexOf('MIRFE inventory execution access denied'),duplicateReturn=source.indexOf("return query select 'applied'::text,v_existing.result,true")
 assert.ok(access>0&&duplicateReturn>access)
})

test('M31-F006: la superficie productiva activa la transacción remota solo cuando Supabase está configurado',async()=>{
 const source=await readFile(new URL('../src/services/irrigationMirfeCommandStore.js',import.meta.url),'utf8')
 assert.match(source,/supabaseEnabled/)
 assert.match(source,/commitInventoryTransaction:commitMirfeInventoryTransaction/)
 const commandSource=await readFile(new URL('../src/services/irrigationMirfeCommand.js',import.meta.url),'utf8')
 assert.match(commandSource,/EXECUTE_PREPARATION&&!existing&&typeof deps\.commitInventoryTransaction==='function'/)
 assert.match(commandSource,/commitMeta:remoteInventory\?\{sync:false\}:\{\}/)
})