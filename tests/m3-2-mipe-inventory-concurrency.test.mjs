import test from'node:test'
import assert from'node:assert/strict'
import{readFile}from'node:fs/promises'
import{executeMipeCommand,MIPE_OPERATIONS}from'../src/services/mipeCommand.js'
import{applyMipeTreatmentConfirmation,buildMipeTreatmentTransaction,commitMipeTreatmentTransaction,MIPE_TREATMENT_TRANSACTION_COLLECTIONS}from'../src/services/mipeTreatmentTransaction.js'

function baseState(){return{
 companies:[{id:'org-a'},{id:'org-b'}],currentContext:{companyId:'org-a',siteId:'site-a'},
 users:[{id:'user-a',name:'Aplicador',role:'Encargado MIPE',activeSession:true,active:true,remote:false}],memberships:[],roles:[],
 sites:[{id:'site-a',organizationId:'org-a',companyId:'org-a'},{id:'site-b',organizationId:'org-b',companyId:'org-b'}],houses:[],beds:[],plantPositions:[],grandmotherPlants:[],motherPlants:[],materialPlantUnits:[],plantEvents:[],genetics:[],
 incidents:[{id:'incident-a',organizationId:'org-a',name:'Ácaro A'},{id:'incident-b',organizationId:'org-b',name:'Ácaro B'}],
 products:[{id:'product-shared',organizationId:'org-a',siteId:'site-a',name:'Producto A',category:'MIPE',unit:'mL',cost:2,reentryHours:12,withdrawalDays:3},{id:'product-shared',organizationId:'org-b',siteId:'site-b',name:'Producto B',category:'MIPE',unit:'mL',cost:9,reentryHours:24,withdrawalDays:7}],
 findings:[{id:'finding-shared',organizationId:'org-a',siteId:'site-a',incidentId:'incident-a',status:'Tratamiento aprobado',severity:2,_syncVersion:5},{id:'finding-shared',organizationId:'org-b',siteId:'site-b',incidentId:'incident-b',status:'Tratamiento aprobado',severity:4,_syncVersion:11}],
 treatments:[{id:'treatment-shared',organizationId:'org-a',siteId:'site-a',findingId:'finding-shared',productId:'product-shared',dose:2,doseUnit:'mL/L',mixVolume:100,totalQuantity:200,inventoryUnit:'mL',date:'2026-08-17',responsible:'Aplicador',notes:'',status:'Programado',createdAt:'2026-08-17T01:00:00.000Z',_syncVersion:3},{id:'treatment-shared',organizationId:'org-b',siteId:'site-b',findingId:'finding-shared',productId:'product-shared',dose:2,doseUnit:'mL/L',mixVolume:100,totalQuantity:200,inventoryUnit:'mL',date:'2026-08-17',responsible:'Otro',notes:'',status:'Programado',createdAt:'2026-08-17T01:00:00.000Z',_syncVersion:8}],
 inventoryLots:[{id:'lot-shared',organizationId:'org-a',siteId:'site-a',productId:'product-shared',lotNumber:'LOT-A',quantity:1000,_syncVersion:7},{id:'lot-shared',organizationId:'org-b',siteId:'site-b',productId:'product-shared',lotNumber:'LOT-B',quantity:5000,_syncVersion:13}],
 inventoryMovements:[],costEntries:[],mipeInterventions:[],mipeCommandReceipts:[]
}}

function confirmationFor(transaction,{duplicate=false}={}){
 const updatedAt='2026-08-17T02:00:01.000Z'
 return{remote:true,duplicate,records:transaction.mutations.map(item=>({companyId:transaction.organizationId,collection:item.collection,recordId:item.recordId,payload:{...item.payload,_syncVersion:item.baseVersion+1,_updatedAt:updatedAt},version:item.baseVersion+1,updatedAt,deletedAt:null}))}
}

function remoteServer(){
 const versions=new Map([['inventoryLots\u0000lot-shared',7],['treatments\u0000treatment-shared',3],['findings\u0000finding-shared',5]]),receipts=new Map()
 return{
  calls:[],
  async commit(transaction){
   this.calls.push(transaction)
   const existing=receipts.get(transaction.commandId)
   if(existing){if(existing.signature!==transaction.signature)throw new Error('remote command collision');return{...existing.confirmation,duplicate:true}}
   for(const mutation of transaction.mutations){
    const key=`${mutation.collection}\u0000${mutation.recordId}`,current=versions.get(key)
    if(current===undefined){if(mutation.baseVersion!==0)throw new Error(`remote version conflict ${key}`)}
    else if(current!==mutation.baseVersion)throw new Error(`remote version conflict ${key}`)
   }
   const confirmation=confirmationFor(transaction)
   for(const record of confirmation.records)versions.set(`${record.collection}\u0000${record.recordId}`,record.version)
   receipts.set(transaction.commandId,{signature:transaction.signature,confirmation})
   return confirmation
  },
  receipt(commandId){return receipts.get(commandId)}
 }
}

function harness(initial,server,{loseFirstResponse=false,switchTenantBeforeCommit=false}={}){
 let state=structuredClone(initial),lost=false;const events=[],commitMeta=[]
 return{
  events,commitMeta,
  get state(){return state},
  set state(value){state=value},
  deps:{
   publishEvent:async spec=>{events.push(structuredClone(spec))},
   commitTreatmentTransaction:async transaction=>{
    const confirmation=await server.commit(transaction)
    if(loseFirstResponse&&!lost){lost=true;throw new Error('network response lost')}
    return confirmation
   },
   commit:(recipe,meta)=>{
    if(switchTenantBeforeCommit)state={...state,currentContext:{...state.currentContext,companyId:'org-b',siteId:'site-b'}}
    state=recipe(state);commitMeta.push(meta)
   }
  }
 }
}

const execution=(commandId='cmd-execute')=>({operation:MIPE_OPERATIONS.EXECUTE_TREATMENT,entityId:'treatment-shared',input:{lotId:'lot-shared',responsible:'Aplicador'},commandId,occurredAt:'2026-08-17T02:00:00.000Z'})

test('M32-F004: remote execution contains exactly the five canonical consequences with base versions',async()=>{
 const server=remoteServer(),h=harness(baseState(),server)
 await executeMipeCommand(h.state,execution(),h.deps)
 assert.equal(server.calls.length,1)
 const transaction=server.calls[0]
 assert.deepEqual([...new Set(transaction.mutations.map(item=>item.collection))].sort(),[...MIPE_TREATMENT_TRANSACTION_COLLECTIONS].sort())
 assert.equal(transaction.mutations.length,5)
 assert.equal(transaction.organizationId,'org-a')
 assert.equal(transaction.siteId,'site-a')
 assert.equal(transaction.treatmentId,'treatment-shared')
 assert.equal(transaction.mutations.find(item=>item.collection==='inventoryLots').baseVersion,7)
 assert.equal(transaction.mutations.find(item=>item.collection==='treatments').baseVersion,3)
 assert.equal(transaction.mutations.find(item=>item.collection==='findings').baseVersion,5)
 assert.equal(transaction.mutations.find(item=>item.collection==='inventoryMovements').baseVersion,0)
 assert.equal(transaction.mutations.find(item=>item.collection==='costEntries').baseVersion,0)
 const movement=transaction.mutations.find(item=>item.collection==='inventoryMovements').payload
 assert.equal(movement.id,'treatment-shared:cmd-execute:movement')
 assert.equal(movement.balanceBefore,1000)
 assert.equal(movement.balanceAfter,800)
 assert.equal(transaction.mutations.find(item=>item.collection==='costEntries').payload.id,'treatment-shared:cmd-execute:cost')
 assert.equal(transaction.mutations.every(item=>item.payload.organizationId==='org-a'&&item.payload.siteId==='site-a'),true)
 assert.equal(h.state.inventoryLots.find(item=>item.organizationId==='org-a').quantity,800)
 assert.equal(h.state.inventoryLots.find(item=>item.organizationId==='org-b').quantity,5000)
 assert.equal(h.state.treatments.find(item=>item.organizationId==='org-a').status,'Ejecutado')
 assert.equal(h.state.findings.find(item=>item.organizationId==='org-a').status,'Seguimiento')
 assert.equal(h.state.inventoryMovements.length,1)
 assert.equal(h.state.costEntries.length,1)
 assert.equal(h.commitMeta[0].sync,false)
 assert.equal(h.events.at(-1).name,'mipe.treatment.executed')
})

test('M32-F004: two devices from the same remote versions cannot both consume the lot',async()=>{
 const initial=baseState(),server=remoteServer(),first=harness(initial,server),second=harness(initial,server)
 await executeMipeCommand(first.state,execution('cmd-device-a'),first.deps)
 await assert.rejects(()=>executeMipeCommand(second.state,execution('cmd-device-b'),second.deps),/remote version conflict/)
 assert.equal(first.state.inventoryLots.find(item=>item.organizationId==='org-a').quantity,800)
 assert.equal(second.state.inventoryLots.find(item=>item.organizationId==='org-a').quantity,1000)
 assert.equal(second.state.inventoryMovements.length,0)
 assert.equal(second.state.costEntries.length,0)
 assert.equal(second.events.filter(item=>item.name==='mipe.treatment.executed').length,0)
 assert.equal(server.calls.length,2)
})

test('M32-F004: lost response is recovered by the same command without repeating effects',async()=>{
 const initial=baseState(),server=remoteServer(),h=harness(initial,server,{loseFirstResponse:true}),request=execution('cmd-lost')
 await assert.rejects(()=>executeMipeCommand(h.state,request,h.deps),/response lost/)
 assert.equal(h.state.inventoryLots.find(item=>item.organizationId==='org-a').quantity,1000)
 assert.equal(h.state.inventoryMovements.length,0)
 assert.equal(server.receipt('cmd-lost')?.confirmation.records.length,5)
 await executeMipeCommand(h.state,request,h.deps)
 assert.equal(server.calls.length,2)
 assert.equal(h.state.inventoryLots.find(item=>item.organizationId==='org-a').quantity,800)
 assert.equal(h.state.inventoryMovements.length,1)
 assert.equal(h.state.costEntries.length,1)
 assert.equal(h.state.mipeCommandReceipts.filter(item=>item.commandId==='cmd-lost').length,1)
 assert.equal(h.events.filter(item=>item.name==='mipe.treatment.executed').length,1)
})

test('M32-F004: a tenant switch after remote apply does not hydrate or publish completion in the wrong company',async()=>{
 const server=remoteServer(),h=harness(baseState(),server,{switchTenantBeforeCommit:true})
 await assert.rejects(()=>executeMipeCommand(h.state,execution('cmd-switch-remote'),h.deps),/empresa activa cambió/)
 assert.equal(server.receipt('cmd-switch-remote')?.confirmation.records.length,5)
 assert.equal(h.state.inventoryLots.find(item=>item.organizationId==='org-a').quantity,1000)
 assert.equal(h.state.inventoryLots.find(item=>item.organizationId==='org-b').quantity,5000)
 assert.equal(h.state.inventoryMovements.length,0)
 assert.equal(h.events.filter(item=>item.name==='mipe.treatment.executed').length,0)
})

test('M32-F004: transaction adapter rejects partial, foreign and duplicate remote confirmations',async()=>{
 const server=remoteServer(),h=harness(baseState(),server)
 await executeMipeCommand(h.state,execution('cmd-capture'),h.deps)
 const transaction=server.calls[0]
 await assert.rejects(()=>commitMipeTreatmentTransaction(transaction,{request:async()=>[{status:'applied',records:confirmationFor(transaction).records.slice(0,4),duplicate:false}]}),/conjunto canónico completo/)
 const foreign=confirmationFor(transaction).records.map((item,index)=>index?item:{...item,companyId:'org-b'})
 await assert.rejects(()=>commitMipeTreatmentTransaction(transaction,{request:async()=>[{status:'applied',records:foreign,duplicate:false}]}),/otra empresa/)
 const duplicate=confirmationFor(transaction).records;duplicate[4]={...duplicate[0]}
 await assert.rejects(()=>commitMipeTreatmentTransaction(transaction,{request:async()=>[{status:'applied',records:duplicate,duplicate:false}]}),/inesperada o duplicada/)
})

test('M32-F004: confirmation hydration preserves foreign homonyms and applies only server versions',()=>{
 const initial=baseState(),transaction={organizationId:'org-a',mutations:[
  {collection:'inventoryLots',recordId:'lot-shared',baseVersion:7,payload:{...initial.inventoryLots[0],organizationId:'org-a',siteId:'site-a',quantity:800}},
  {collection:'inventoryMovements',recordId:'move-1',baseVersion:0,payload:{id:'move-1',organizationId:'org-a',siteId:'site-a'}},
  {collection:'treatments',recordId:'treatment-shared',baseVersion:3,payload:{...initial.treatments[0],organizationId:'org-a',siteId:'site-a',status:'Ejecutado'}},
  {collection:'findings',recordId:'finding-shared',baseVersion:5,payload:{...initial.findings[0],organizationId:'org-a',siteId:'site-a',status:'Seguimiento'}},
  {collection:'costEntries',recordId:'cost-1',baseVersion:0,payload:{id:'cost-1',organizationId:'org-a',siteId:'site-a'}}
 ]},confirmation=confirmationFor(transaction)
 const next=applyMipeTreatmentConfirmation(initial,confirmation,'org-a')
 assert.equal(next.inventoryLots.find(item=>item.organizationId==='org-a'||item._organizationId==='org-a').quantity,800)
 assert.equal(next.inventoryLots.find(item=>item.organizationId==='org-b').quantity,5000)
 assert.equal(next.inventoryLots.find(item=>item.organizationId==='org-a'||item._organizationId==='org-a')._syncVersion,8)
})

test('M32-F004: SQL authority locks command, checks permission and versions before first write',async()=>{
 const sql=await readFile('supabase/migrations/20260817010000_mipe_treatment_execution.sql','utf8')
 assert.match(sql,/pg_advisory_xact_lock/)
 assert.match(sql,/execute_treatments/)
 assert.match(sql,/membership_sites/)
 assert.match(sql,/for update/)
 assert.match(sql,/MIPE_TREATMENT_VERSION_CONFLICT/)
 assert.match(sql,/current_treatment\.payload->>'status' is distinct from 'Programado'/)
 assert.match(sql,/remote MIPE inventory lot balance mismatch/)
 const preflight=sql.indexOf("MIPE_TREATMENT_VERSION_CONFLICT"),write=sql.indexOf('insert into public.erp_records')
 assert.ok(preflight>=0&&write>preflight,'el preflight debe ocurrir antes del primer write')
 assert.match(sql,/primary key \(organization_id, command_id\)/)
 assert.match(sql,/grant execute on function public\.commit_mipe_treatment_execution/)
})

test('M32-F004: production command store activates the RPC only when Supabase is enabled',async()=>{
 const source=await readFile('src/services/mipeCommandStore.js','utf8')
 assert.match(source,/commitMipeTreatmentTransaction/)
 assert.match(source,/supabaseEnabled/)
 assert.match(source,/commitTreatmentTransaction:commitMipeTreatmentTransaction/)
 const command=await readFile('src/services/mipeCommand.js','utf8')
 assert.match(command,/prepareCommit/)
 assert.match(command,/buildMipeTreatmentTransaction/)
 assert.match(command,/applyMipeTreatmentConfirmation/)
 assert.match(command,/sync:false/)
})

test('M32-F004: builder fails closed if the atomic consequence set is contaminated',()=>{
 const before=baseState(),after=structuredClone(before)
 after.inventoryLots[0]={...after.inventoryLots[0],quantity:800,updatedAt:'2026-08-17T02:00:00.000Z'}
 after.inventoryMovements.push({id:'move',organizationId:'org-a',siteId:'site-a',lotId:'lot-shared',productId:'product-shared',type:'Consumo',quantity:200,signedQuantity:-200,balanceBefore:1000,balanceAfter:800,sourceType:'MipeTreatment',sourceId:'treatment-shared'})
 after.treatments[0]={...after.treatments[0],status:'Ejecutado',lotId:'lot-shared'}
 after.findings[0]={...after.findings[0],status:'Seguimiento'}
 after.costEntries.push({id:'cost',organizationId:'org-a',siteId:'site-a',amount:400,quantity:200,productId:'product-shared',inventoryLotId:'lot-shared',findingId:'finding-shared',treatmentId:'treatment-shared'})
 after.costEntries.push({id:'foreign-cost',organizationId:'org-b',siteId:'site-b',amount:1,quantity:1,productId:'product-shared',inventoryLotId:'lot-shared',findingId:'finding-shared',treatmentId:'treatment-shared'})
 assert.throws(()=>buildMipeTreatmentTransaction(before,after,{commandId:'c',signature:'s',organizationId:'org-a',treatmentId:'treatment-shared',siteId:'site-a'}),/otra empresa|exactamente un costo|fuera de la unidad/)
})
