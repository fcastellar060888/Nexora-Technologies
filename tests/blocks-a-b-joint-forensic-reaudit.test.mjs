import test from'node:test'
import assert from'node:assert/strict'
import{readFile}from'node:fs/promises'
import{
 createDomainEvent,createEventBus,getEventBusForScope,releaseEventBusScope
}from'../src/core/events/index.js'
import{
 createLedgerEntry,createMemoryLedgerRepository,getOperationalLedgerForScope,releaseOperationalLedgerScope
}from'../src/core/ledger/index.js'
import{
 createIntelligentObject,createPassport,createPassportBuilder
}from'../src/core/passport/index.js'
import{hydrateAuthoritativeState}from'../src/services/remoteBootstrap.js'
import{compactCompanyState}from'../src/services/lightweightCache.js'

const domainEvent=({eventId='event-1',organizationId='company-a',actorId='user-1',payload={value:1}}={})=>createDomainEvent({
 eventId,
 name:'cultivation.plant.inspected',
 aggregateType:'cultivation.plant',
 aggregateId:'plant-1',
 organizationId,
 actorId,
 occurredAt:'2026-08-03T13:00:00.000Z',
 payload
})

const baseState=overrides=>({
 currentContext:{companyId:'company-a'},
 products:[],sites:[],houses:[],
 syncQueue:[],syncConflicts:[],syncHealthEvents:[],syncDeviceHealth:[],
 companies:[],users:[],roles:[],memberships:[],userSessions:[],auditLog:[],
 syncMeta:{},
 ...overrides
})

test('reauditoría A+B: reintento parcial, deduplicación e identidad siguen siendo coherentes',async()=>{
 const bus=createEventBus()
 let stableCalls=0,flakyCalls=0
 bus.subscribe('*',()=>{stableCalls+=1})
 bus.subscribe('*',()=>{flakyCalls+=1;if(flakyCalls===1)throw new Error('fallo transitorio')})
 const event=domainEvent()
 const first=await bus.publish(event)
 assert.equal(first.pending,true)
 assert.equal(first.failed,1)
 const retry=await bus.publish(event)
 assert.equal(retry.retry,true)
 assert.equal(retry.pending,false)
 assert.equal(stableCalls,1)
 assert.equal(flakyCalls,2)
 const duplicate=await bus.publish(event)
 assert.equal(duplicate.duplicate,true)
 await assert.rejects(bus.publish(domainEvent({payload:{value:2}})),/contenido diferente/)
})

test('reauditoría A+B: un lote inválido no modifica Ledger ni secuencia',()=>{
 const ledger=createMemoryLedgerRepository()
 ledger.append(domainEvent({eventId:'safe'}),{sequence:4})
 const valid=createLedgerEntry(domainEvent({eventId:'valid'}),{sequence:8})
 const collision=createLedgerEntry(domainEvent({eventId:'collision'}),{sequence:4})
 assert.throws(()=>ledger.appendMany([valid,collision]),/secuencia 4/)
 assert.deepEqual(ledger.find({order:'asc'}).map(item=>item.id),['safe'])
 assert.equal(ledger.append(domainEvent({eventId:'next'})).sequence,5)
})

test('reauditoría A+B: runtimes de dos workspaces no comparten entrega, historia ni Ledger',async()=>{
 const scopeA={organizationId:'company-a',actorId:'user-1'}
 const scopeB={organizationId:'company-b',actorId:'user-2'}
 const busA=getEventBusForScope(scopeA),busB=getEventBusForScope(scopeB)
 const ledgerA=getOperationalLedgerForScope(scopeA),ledgerB=getOperationalLedgerForScope(scopeB)
 ledgerA.clear();ledgerB.clear()
 let deliveriesB=0
 busB.subscribe('*',()=>{deliveriesB+=1})
 const eventA=domainEvent({eventId:'shared-id',organizationId:'company-a',actorId:'user-1'})
 await busA.publish(eventA)
 ledgerA.append(eventA)
 const eventB=domainEvent({eventId:'shared-id',organizationId:'company-b',actorId:'user-2',payload:{value:2}})
 await busB.publish(eventB)
 ledgerB.append(eventB)
 assert.equal(deliveriesB,1)
 assert.equal(busA.getHistory().length,1)
 assert.equal(busB.getHistory().length,1)
 assert.equal(ledgerA.find({organizationId:'company-b'}).length,0)
 assert.equal(ledgerB.find({organizationId:'company-a'}).length,0)
 assert.equal(ledgerA.getBySequence(1).event.context.organizationId,'company-a')
 assert.equal(ledgerB.getBySequence(1).event.context.organizationId,'company-b')
 releaseEventBusScope(scopeA);releaseEventBusScope(scopeB)
 releaseOperationalLedgerScope(scopeA);releaseOperationalLedgerScope(scopeB)
})

test('reauditoría A+B: bootstrap sustituye solo el tenant activo y soporta IDs iguales',()=>{
 const local=baseState({products:[
  {id:'same',name:'A local',_organizationId:'company-a'},
  {id:'same',name:'B intacto',_organizationId:'company-b'}
 ]})
 const rows=[{
  organization_id:'company-a',collection:'products',record_id:'same',
  payload:{id:'same',name:'A remoto'},version:3,
  updated_at:'2026-08-03T13:01:00.000Z',deleted_at:null
 }]
 const hydrated=hydrateAuthoritativeState(local,rows,{companyId:'company-a',initialState:local,hydratedAt:'2026-08-03T13:02:00.000Z'})
 assert.equal(hydrated.products.find(item=>item._organizationId==='company-a').name,'A remoto')
 assert.equal(hydrated.products.find(item=>item._organizationId==='company-b').name,'B intacto')
 assert.equal(hydrated.products.length,2)
})

test('reauditoría A+B: persistencia segmentada nunca copia registros extranjeros',()=>{
 const compacted=compactCompanyState(baseState({products:[
  {id:'a',name:'A',_organizationId:'company-a'},
  {id:'b',name:'B',organizationId:'company-b'},
  {id:'legacy',name:'Sin tenant explícito'}
 ]}),'company-a')
 assert.deepEqual(compacted.collections.products.map(item=>item.id).sort(),['a','legacy'])
})

test('reauditoría A+B: Passport converge duplicados idénticos y rechaza contradicciones',()=>{
 const object=createIntelligentObject({
  objectType:'cultivation.plant',objectId:'plant-1',organizationId:'company-a',label:'P-1',
  createdAt:'2026-08-03T12:00:00.000Z',updatedAt:'2026-08-03T12:00:00.000Z'
 })
 const identical=createPassport({object,indicators:[{key:'health',value:90},{value:90,key:'health'}]})
 assert.equal(identical.indicators.length,1)
 assert.throws(()=>createPassport({object,indicators:[{key:'health',value:90},{key:'health',value:40}]}),/contradictorias/)
})

test('reauditoría A+B: plugin hostil no puede contaminar evidencia ni plugins posteriores',()=>{
 const object=createIntelligentObject({objectType:'cultivation.plant',objectId:'plant-2',organizationId:'company-a',label:'P-2'})
 const state={nested:{status:'clean'}}
 const builder=createPassportBuilder({plugins:[
  {id:'hostile',project:({state})=>{assert.throws(()=>{state.nested.status='corrupt'},TypeError);return{}}},
  {id:'observer',project:({state})=>{assert.equal(state.nested.status,'clean');return{indicators:[{key:'status',value:state.nested.status}]}}}
 ]})
 const passport=builder.build({object,state})
 assert.equal(passport.indicators[0].value,'clean')
 assert.equal(state.nested.status,'clean')
})

test('reauditoría A+B: bridges productivos no importan singletons de workspace',async()=>{
 const checks=[
  ['../src/core/ledger/OperationalLedgerBridge.jsx',/getOperationalLedgerForScope\(scope\)/,/getEventBusForScope\(scope\)/],
  ['../src/core/timeline/DomainEventTimelineBridge.jsx',/getOperationalLedgerForScope\(scope\)/,/getTimelineEngineForScope\(scope\)/],
  ['../src/core/audit/DomainEventAuditBridge.jsx',/getOperationalLedgerForScope\(scope\)/,/ledger\.subscribe/]
 ]
 for(const[path,...patterns]of checks){
  const source=await readFile(new URL(path,import.meta.url),'utf8')
  patterns.forEach(pattern=>assert.match(source,pattern))
  assert.doesNotMatch(source,/import\{[^}]*\b(?:eventBus|operationalLedger|timelineEngine)\b[^}]*\}/)
 }
 const publisher=await readFile(new URL('../src/core/events/publishDomainEvent.js',import.meta.url),'utf8')
 assert.match(publisher,/getEventBusForScope/)
 assert.doesNotMatch(publisher,/import\{eventBus\}/)
})
