import test from'node:test'
import assert from'node:assert/strict'
import{readdir,readFile}from'node:fs/promises'
import{join}from'node:path'
import{createDomainEvent,createEventBus,DomainEvents}from'../src/core/events/index.js'
import{createMemoryLedgerRepository}from'../src/core/ledger/index.js'
import{hydrateAuthoritativeState}from'../src/services/remoteBootstrap.js'
import{commitIncrementalSyncResult}from'../src/services/syncCommit.js'
import{createPersistenceRuntime,recordPersistenceResult}from'../src/services/persistenceHealth.js'

const event=(id='event-1')=>createDomainEvent({name:DomainEvents.COMPANY_CREATED,aggregateType:'company',aggregateId:'company-1',organizationId:'company-1',actorId:'user-1',occurredAt:'2026-08-03T05:00:00.000Z',eventId:id,payload:{label:'Nexora'}})

async function sourceFiles(directory){
 const entries=await readdir(directory,{withFileTypes:true})
 const files=[]
 for(const entry of entries){
  const path=join(directory,entry.name)
  if(entry.isDirectory())files.push(...await sourceFiles(path))
  else if(/\.(js|jsx|mjs)$/.test(entry.name))files.push(path)
 }
 return files
}

test('reauditoría A: ningún consumidor productivo reemplaza destructivamente el Ledger',async()=>{
 const root=new URL('../src/',import.meta.url)
 const files=await sourceFiles(root)
 const offenders=[]
 for(const file of files){
  const source=await readFile(file,'utf8')
  if(/\.replaceMany\s*\(/.test(source))offenders.push(file)
 }
 assert.deepEqual(offenders,[])
})

test('reauditoría A: un fallo parcial del Event Bus se recupera sin duplicar efectos exitosos',async()=>{
 const bus=createEventBus({onError:()=>{}}),calls={stable:0,transient:0}
 let fail=true
 bus.subscribe('*',()=>{calls.stable+=1})
 bus.subscribe('*',()=>{calls.transient+=1;if(fail)throw new Error('temporal')})
 const item=event('event-retry-block-a')
 assert.equal((await bus.publish(item)).pending,true)
 fail=false
 assert.equal((await bus.publish(item)).pending,false)
 assert.deepEqual(calls,{stable:1,transient:2})
 assert.equal((await bus.publish(item)).duplicate,true)
})

test('reauditoría A: Ledger valida lotes y reconcilia snapshots sin pérdida ni reemisión',()=>{
 const ledger=createMemoryLedgerRepository(),received=[]
 ledger.append(event('ledger-live'),{sequence:1})
 ledger.subscribe(entry=>received.push(entry.id))
 assert.throws(()=>ledger.appendMany([event('batch-valid'),{bad:true}]))
 assert.equal(ledger.getByEventId('batch-valid'),null)
 const canonical=ledger.reconcileMany([ledger.getByEventId('ledger-live'),event('ledger-historical')])
 assert.deepEqual(canonical.map(item=>item.id),['ledger-live','ledger-historical'])
 assert.deepEqual(received,[])
})

test('reauditoría A: bootstrap remoto conserva cambios locales concurrentes',()=>{
 const initial={currentContext:{companyId:'company-1'},sites:[{id:'site-1',name:'Inicial'}],syncQueue:[],syncConflicts:[],syncHealthEvents:[],syncDeviceHealth:[],companies:[],users:[],roles:[],memberships:[],userSessions:[],auditLog:[]}
 const current={...initial,sites:[{id:'site-1',name:'Local concurrente'},{id:'site-2',name:'Nueva local'}]}
 const rows=[{organization_id:'company-1',collection:'sites',record_id:'site-1',payload:{id:'site-1',name:'Remoto'},version:2,updated_at:'2026-08-03T05:01:00.000Z',deleted_at:null}]
 const result=hydrateAuthoritativeState(current,rows,{companyId:'company-1',initialState:initial})
 assert.deepEqual(result.sites.map(item=>item.name),['Local concurrente','Nueva local'])
})

test('reauditoría A: commit de sync conserva mutaciones nacidas durante la operación',()=>{
 const initial={currentContext:{companyId:'company-1'},sites:[{id:'site-1',name:'Inicial'}],syncQueue:[{id:'old',status:'pending'}],syncConflicts:[],syncHealthEvents:[],syncDeviceHealth:[],companies:[],users:[],roles:[],memberships:[],userSessions:[],auditLog:[],syncMeta:{}}
 const current={...initial,sites:[{id:'site-1',name:'Concurrente'}],syncQueue:[...initial.syncQueue,{id:'new',status:'pending'}]}
 const processed={...initial,sites:[{id:'site-1',name:'Remoto'}],syncQueue:[{id:'old',status:'completed'}],syncMeta:{lastSyncedAt:'2026-08-03T05:02:00.000Z'}}
 const committed=commitIncrementalSyncResult(initial,current,processed)
 assert.equal(committed.sites[0].name,'Concurrente')
 assert.deepEqual(committed.syncQueue.map(item=>item.id),['old','new'])
 assert.equal(committed.syncQueue[0].status,'completed')
})

test('reauditoría A: fallo local permanece visible hasta una escritura exitosa',()=>{
 const failed=recordPersistenceResult(createPersistenceRuntime(),{ok:false,error:'quota'})
 assert.equal(failed.dirty,true)
 const recovered=recordPersistenceResult(failed,{ok:true})
 assert.equal(recovered.dirty,false)
 assert.equal(recovered.consecutiveFailures,0)
})
