import test from'node:test'
import assert from'node:assert/strict'
import fs from'node:fs'
import{createGraphNode,getKnowledgeGraphForScope,knowledgeGraphRuntimeKey,releaseKnowledgeGraphScope,knowledgeGraphScopeCount,clearKnowledgeGraphRuntimes}from'../src/core/knowledgeGraph/index.js'

const at='2026-08-03T12:00:00.000Z'
const scopeA={organizationId:'org-a',actorId:'user-1'}
const scopeB={organizationId:'org-b',actorId:'user-1'}
const scopeA2={organizationId:'org-a',actorId:'user-2'}

function node(id,organizationId){return createGraphNode({nodeId:`${organizationId}:cultivation.plant:${id}`,nodeType:'cultivation.plant',organizationId,label:id,createdAt:at,updatedAt:at})}

test.beforeEach(()=>clearKnowledgeGraphRuntimes())

test('AUD-F052: el mismo workspace resuelve una única instancia canónica',()=>{
 const first=getKnowledgeGraphForScope(scopeA)
 const second=getKnowledgeGraphForScope({...scopeA})
 assert.equal(first,second)
 assert.equal(knowledgeGraphScopeCount(),1)
 first.addNode(node('plant-1','org-a'))
 assert.equal(second.snapshot().nodes.length,1)
})

test('AUD-F052: empresa y actor forman particiones independientes',()=>{
 const a=getKnowledgeGraphForScope(scopeA)
 const b=getKnowledgeGraphForScope(scopeB)
 const a2=getKnowledgeGraphForScope(scopeA2)
 a.addNode(node('plant-a','org-a'))
 b.addNode(node('plant-b','org-b'))
 assert.equal(a.snapshot().nodes.length,1)
 assert.equal(b.snapshot().nodes.length,1)
 assert.equal(a2.snapshot().nodes.length,0)
 assert.equal(knowledgeGraphScopeCount(),3)
})

test('AUD-F052: liberar un scope no altera los demás y crea una instancia limpia al volver',()=>{
 const original=getKnowledgeGraphForScope(scopeA)
 const foreign=getKnowledgeGraphForScope(scopeB)
 original.addNode(node('plant-a','org-a'))
 foreign.addNode(node('plant-b','org-b'))
 assert.equal(releaseKnowledgeGraphScope(scopeA),true)
 assert.equal(releaseKnowledgeGraphScope(scopeA),false)
 assert.equal(foreign.snapshot().nodes.length,1)
 const restored=getKnowledgeGraphForScope(scopeA)
 assert.notEqual(restored,original)
 assert.equal(restored.snapshot().nodes.length,0)
})

test('AUD-F052: el scope exige identidad explícita y determinista',()=>{
 assert.equal(knowledgeGraphRuntimeKey(scopeA),'org-a::user-1')
 assert.throws(()=>knowledgeGraphRuntimeKey({actorId:'user-1'}),/empresa.*obligatorio/i)
 assert.throws(()=>knowledgeGraphRuntimeKey({organizationId:'org-a',actorId:''}),/actor.*obligatorio/i)
})

test('AUD-F052: main monta un único provider dentro del StoreProvider',()=>{
 const source=fs.readFileSync(new URL('../src/main.jsx',import.meta.url),'utf8')
 assert.match(source,/StoreProvider><KnowledgeGraphRuntimeProvider>/)
 assert.equal((source.match(/<KnowledgeGraphRuntimeProvider>/g)||[]).length,1)
 assert.match(source,/<\/KnowledgeGraphRuntimeProvider><\/StoreProvider>/)
})

test('AUD-F052: el provider resuelve el repositorio por el scope activo del Store',()=>{
 const source=fs.readFileSync(new URL('../src/core/knowledgeGraph/KnowledgeGraphRuntimeProvider.jsx',import.meta.url),'utf8')
 assert.match(source,/state\.currentContext\?\.companyId/)
 assert.match(source,/user\?\.remoteId\|\|user\?\.id/)
 assert.match(source,/getKnowledgeGraphForScope\(scope\)/)
 assert.doesNotMatch(source,/createKnowledgeGraphRepository/)
})
