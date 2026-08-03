import test from'node:test'
import assert from'node:assert/strict'
import{readFile,readdir}from'node:fs/promises'
import{join,relative}from'node:path'
import{fileURLToPath}from'node:url'
import{createDomainEvent,getEventBusForScope,releaseEventBusScope}from'../src/core/events/index.js'
import{getOperationalLedgerForScope,releaseOperationalLedgerScope}from'../src/core/ledger/index.js'
import{getTimelineEngineForScope,releaseTimelineScope}from'../src/core/timeline/timelineEngine.js'
import{getKnowledgeGraphForScope,releaseKnowledgeGraphScope,clearKnowledgeGraphRuntimes}from'../src/core/knowledgeGraph/index.js'
import{createGraphNode}from'../src/core/knowledgeGraph/graphContract.js'

const root=fileURLToPath(new URL('../src',import.meta.url))
async function files(dir){
 const out=[]
 for(const item of await readdir(dir,{withFileTypes:true})){
  const path=join(dir,item.name)
  if(item.isDirectory())out.push(...await files(path))
  else if(/\.(js|jsx|mjs)$/.test(item.name))out.push(path)
 }
 return out
}
const source=async()=>Promise.all((await files(root)).map(async path=>({path:relative(root,path),text:await readFile(path,'utf8')})))
const scope=(organizationId,actorId)=>({organizationId,actorId})

function event(organizationId,actorId,id){return createDomainEvent({eventId:id,name:'cultivation.plant.inspected',version:1,aggregateType:'cultivation.plant',aggregateId:`plant-${id}`,organizationId,actorId,occurredAt:'2026-08-03T12:00:00.000Z',payload:{id}})}

test('reauditoría C: ninguna ruta productiva crea repositorios Graph fuera del runtime canónico',async()=>{
 const matches=(await source()).filter(({path,text})=>text.includes('createKnowledgeGraphRepository(')&&!['core/knowledgeGraph/graphRepository.js','core/knowledgeGraph/graphRuntime.js','core/knowledgeGraph/knowledgeGraph.js'].includes(path))
 assert.deepEqual(matches.map(item=>item.path),[])
})

test('reauditoría C: el montaje productivo contiene un único provider del Knowledge Graph',async()=>{
 const main=await readFile(join(root,'main.jsx'),'utf8')
 assert.equal((main.match(/<KnowledgeGraphRuntimeProvider>/g)||[]).length,1)
 assert.equal((main.match(/<StoreProvider>/g)||[]).length,1)
 assert.ok(main.indexOf('<StoreProvider>')<main.indexOf('<KnowledgeGraphRuntimeProvider>'))
})

test('reauditoría C: no reaparecen exports heredados en el índice canónico',async()=>{
 const api=await import('../src/core/knowledgeGraph/index.js')
 for(const name of['createKnowledgeGraph','graphNode','graphRelation','objectRef','passportRelationships'])assert.equal(name in api,false)
 assert.equal(api.KNOWLEDGE_GRAPH_PUBLIC_API.authority,'knowledge-graph-repository')
 assert.equal(api.KNOWLEDGE_GRAPH_PUBLIC_API.runtime,'workspace-scoped')
})

test('reauditoría C: los cuatro motores comparten scope lógico pero no estado entre workspaces',async()=>{
 const a=scope('company-a','user-1'),b=scope('company-b','user-1')
 const busA=getEventBusForScope(a),busB=getEventBusForScope(b)
 const ledgerA=getOperationalLedgerForScope(a),ledgerB=getOperationalLedgerForScope(b)
 const timelineA=getTimelineEngineForScope(a),timelineB=getTimelineEngineForScope(b)
 const graphA=getKnowledgeGraphForScope(a),graphB=getKnowledgeGraphForScope(b)
 assert.notEqual(busA,busB);assert.notEqual(ledgerA,ledgerB);assert.notEqual(timelineA,timelineB);assert.notEqual(graphA,graphB)
 const domainEvent=event('company-a','user-1','event-c-1')
 await busA.publish(domainEvent)
 ledgerA.append(domainEvent)
 timelineA.record({id:domainEvent.eventId,eventName:domainEvent.name,organizationId:'company-a',aggregateType:domainEvent.aggregate.type,aggregateId:domainEvent.aggregate.id,occurredAt:domainEvent.occurredAt,recordedAt:domainEvent.occurredAt,source:'operational-ledger',sequence:1,title:'Inspección',summary:'Prueba',payload:{},metadata:{}})
 graphA.addNode(createGraphNode({nodeId:'company-a:cultivation.plant:plant-1',nodeType:'cultivation.plant',organizationId:'company-a',label:'Plant A',createdAt:domainEvent.occurredAt,updatedAt:domainEvent.occurredAt,metadata:{source:'ledger'}}))
 assert.equal(busB.getHistory().length,0)
 assert.equal(ledgerB.count(),0)
 assert.equal(timelineB.query({organizationId:'company-b'}).length,0)
 assert.equal(graphB.snapshot().nodes.length,0)
 releaseEventBusScope(a);releaseEventBusScope(b);releaseOperationalLedgerScope(a);releaseOperationalLedgerScope(b);releaseTimelineScope(a);releaseTimelineScope(b);releaseKnowledgeGraphScope(a);releaseKnowledgeGraphScope(b)
})

test('reauditoría C: liberar un Graph scope no contamina otro y recrea limpio',()=>{
 clearKnowledgeGraphRuntimes()
 const a=scope('company-a','user-1'),b=scope('company-a','user-2')
 const graphA=getKnowledgeGraphForScope(a),graphB=getKnowledgeGraphForScope(b)
 graphA.addNode(createGraphNode({nodeId:'company-a:cultivation.plant:plant-1',nodeType:'cultivation.plant',organizationId:'company-a',label:'Plant A',createdAt:'2026-08-03T12:00:00.000Z',updatedAt:'2026-08-03T12:00:00.000Z',metadata:{source:'ledger'}}))
 assert.equal(releaseKnowledgeGraphScope(a),true)
 assert.equal(graphB.snapshot().nodes.length,0)
 const recreated=getKnowledgeGraphForScope(a)
 assert.notEqual(recreated,graphA)
 assert.equal(recreated.snapshot().nodes.length,0)
 clearKnowledgeGraphRuntimes()
})

test('reauditoría C: toda llamada productiva a replaceAll declara expectedVersion',async()=>{
 const offenders=[]
 for(const{path,text}of await source()){
  if(path==='core/knowledgeGraph/graphRepository.js')continue
  const calls=[...text.matchAll(/\.replaceAll\(\{([\s\S]*?)\}\)/g)]
  if(calls.some(match=>!match[1].includes('expectedVersion')))offenders.push(path)
 }
 assert.deepEqual(offenders,[])
})
