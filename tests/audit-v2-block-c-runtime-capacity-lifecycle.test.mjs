import test from'node:test'
import assert from'node:assert/strict'
import fs from'node:fs'
import{
 clearKnowledgeGraphRuntimes,
 getKnowledgeGraphForScope,
 knowledgeGraphRuntimeHealth,
 knowledgeGraphScopeCount,
 MAX_KNOWLEDGE_GRAPH_SCOPES,
 retainKnowledgeGraphScope,
 releaseRetainedKnowledgeGraphScope
}from'../src/core/knowledgeGraph/index.js'

const tick=()=>new Promise(resolve=>queueMicrotask(resolve))
test.beforeEach(()=>clearKnowledgeGraphRuntimes())

test('Auditoría V2 Graph runtime: el provider retiene y libera el workspace anterior al cambiar o desmontarse',()=>{
 const source=fs.readFileSync(new URL('../src/core/knowledgeGraph/KnowledgeGraphRuntimeProvider.jsx',import.meta.url),'utf8')
 assert.match(source,/useEffect/)
 assert.match(source,/retainKnowledgeGraphScope/)
 assert.match(source,/releaseRetainedKnowledgeGraphScope/)
 assert.match(source,/return\(\)=>releaseRetainedKnowledgeGraphScope\(scope\)/)
})

test('Auditoría V2 Graph runtime: el cleanup diferido tolera el montaje doble de StrictMode',async()=>{
 const scope={organizationId:'org-a',actorId:'actor-a'}
 const first=retainKnowledgeGraphScope(scope)
 assert.equal(releaseRetainedKnowledgeGraphScope(scope),true)
 const second=retainKnowledgeGraphScope(scope)
 await tick()
 assert.equal(second,first)
 assert.equal(knowledgeGraphScopeCount(),1)
 releaseRetainedKnowledgeGraphScope(scope)
 await tick()
 assert.equal(knowledgeGraphScopeCount(),0)
})

test('Auditoría V2 Graph runtime: el registro bloquea crecimiento antes de exceder su capacidad',()=>{
 assert.ok(Number.isInteger(MAX_KNOWLEDGE_GRAPH_SCOPES)&&MAX_KNOWLEDGE_GRAPH_SCOPES>0)
 for(let index=0;index<MAX_KNOWLEDGE_GRAPH_SCOPES;index++)getKnowledgeGraphForScope({organizationId:`org-${index}`,actorId:'actor'})
 assert.equal(knowledgeGraphScopeCount(),MAX_KNOWLEDGE_GRAPH_SCOPES)
 assert.throws(()=>getKnowledgeGraphForScope({organizationId:'overflow',actorId:'actor'}),/capacidad.*Knowledge Graph/i)
 assert.equal(knowledgeGraphScopeCount(),MAX_KNOWLEDGE_GRAPH_SCOPES)
})

test('Auditoría V2 Graph runtime: resolver un scope existente continúa permitido al estar saturado',()=>{
 const first=getKnowledgeGraphForScope({organizationId:'org-0',actorId:'actor'})
 for(let index=1;index<MAX_KNOWLEDGE_GRAPH_SCOPES;index++)getKnowledgeGraphForScope({organizationId:`org-${index}`,actorId:'actor'})
 assert.equal(getKnowledgeGraphForScope({organizationId:'org-0',actorId:'actor'}),first)
})

test('Auditoría V2 Graph runtime: la salud expone capacidad sin filtrar repositorios mutables',()=>{
 getKnowledgeGraphForScope({organizationId:'org-a',actorId:'actor-a'})
 const health=knowledgeGraphRuntimeHealth()
 assert.deepEqual(health,{activeScopes:1,capacity:MAX_KNOWLEDGE_GRAPH_SCOPES,saturated:false})
 assert.ok(Object.isFrozen(health))
 assert.equal('repositories'in health,false)
})
