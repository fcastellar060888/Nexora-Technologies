import test from'node:test'
import assert from'node:assert/strict'
import*as canonical from'../src/core/knowledgeGraph/index.js'
import*as legacy from'../src/core/knowledgeGraph/legacy.js'

test('AUD-F030: el índice público expone únicamente el contrato canónico',()=>{
 assert.equal(typeof canonical.createKnowledgeGraphRepository,'function')
 assert.equal(typeof canonical.createGraphNode,'function')
 assert.equal(typeof canonical.projectPassportToGraph,'function')
 assert.equal(typeof canonical.getKnowledgeGraphForScope,'function')
 for(const name of['createKnowledgeGraph','graphNode','graphRelation','objectRef','passportRelationships'])assert.equal(name in canonical,false)
 assert.deepEqual(canonical.KNOWLEDGE_GRAPH_PUBLIC_API,{authority:'knowledge-graph-repository',runtime:'workspace-scoped',scope:'organizationId+actorId',compatibilityFacade:'./legacy.js'})
 assert.equal(Object.isFrozen(canonical.KNOWLEDGE_GRAPH_PUBLIC_API),true)
})

test('AUD-F030: la compatibilidad heredada es explícita y delega al repositorio canónico',()=>{
 assert.equal(typeof legacy.createKnowledgeGraph,'function')
 assert.equal(legacy.LEGACY_KNOWLEDGE_GRAPH_API.status,'deprecated')
 assert.equal(legacy.LEGACY_KNOWLEDGE_GRAPH_API.authority,'knowledge-graph-repository')
 assert.equal(Object.isFrozen(legacy.LEGACY_KNOWLEDGE_GRAPH_API),true)
 const graph=legacy.createKnowledgeGraph()
 assert.equal(typeof graph.repository.replaceAll,'function')
 assert.equal(graph.repository.getVersion(),0)
})
