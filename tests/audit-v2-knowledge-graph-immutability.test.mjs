import test from'node:test'
import assert from'node:assert/strict'
import{createGraphNode,createGraphEdge,createKnowledgeGraphRepository}from'../src/core/knowledgeGraph/index.js'

const timestamp='2026-08-04T13:00:00.000Z'
const node=(id,metadata={nested:{value:1}})=>createGraphNode({nodeId:`org-1:test.object:${id}`,nodeType:'test.object',organizationId:'org-1',label:id,createdAt:timestamp,updatedAt:timestamp,metadata})
const edge=(id,source,target,metadata={nested:{value:1}})=>createGraphEdge({edgeId:id,relationType:'contains',sourceNodeId:source,targetNodeId:target,organizationId:'org-1',validFrom:timestamp,createdAt:timestamp,metadata})

test('Auditoría V2 Graph: snapshots y consultas no permiten mutar nodos, aristas ni metadata',()=>{
 const repository=createKnowledgeGraphRepository(),a=node('a'),b=node('b'),relation=edge('edge-1',a.nodeId,b.nodeId)
 repository.addNode(a);repository.addNode(b);repository.addEdge(relation)
 const before=repository.snapshot(),neighbor=repository.neighbors(a.nodeId)[0]
 assert.throws(()=>{before.nodes.push(node('c'))},TypeError)
 assert.throws(()=>{before.nodes[0].metadata.nested.value=9},TypeError)
 assert.throws(()=>{neighbor.edge.metadata.nested.value=9},TypeError)
 assert.throws(()=>{neighbor.node.label='alterado'},TypeError)
 assert.equal(repository.getNode(a.nodeId).metadata.nested.value,1)
 assert.equal(repository.getEdge('edge-1').metadata.nested.value,1)
})

test('Auditoría V2 Graph: mutar la entrada original después del contrato no altera el repositorio',()=>{
 const metadata={nested:{value:1}},created=node('a',metadata),repository=createKnowledgeGraphRepository()
 repository.addNode(created)
 metadata.nested.value=99
 assert.equal(repository.getNode(created.nodeId).metadata.nested.value,1)
})

test('Auditoría V2 Graph: metadata no acepta Map o Set que permanezcan mutables tras Object.freeze',()=>{
 const repository=createKnowledgeGraphRepository()
 assert.throws(()=>repository.addNode(node('map',new Map([['key','value']]))),/JSON|metadata|serializable/i)
 assert.throws(()=>repository.addNode(node('set',new Set(['value']))),/JSON|metadata|serializable/i)
 assert.equal(repository.snapshot().nodes.length,0)
})

test('Auditoría V2 Graph: validación de metadata hostil no ejecuta getters',()=>{
 let accessed=0
 const metadata={}
 Object.defineProperty(metadata,'secret',{enumerable:true,get(){accessed+=1;throw new Error('getter ejecutado')}})
 assert.throws(()=>node('hostile',metadata),/getter|metadata|serializable/i)
 assert.equal(accessed,0)
})
