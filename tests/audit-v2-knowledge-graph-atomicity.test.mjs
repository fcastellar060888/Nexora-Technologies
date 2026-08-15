import test from'node:test'
import assert from'node:assert/strict'
import{createGraphNode,createGraphEdge,createKnowledgeGraphRepository}from'../src/core/knowledgeGraph/index.js'

const timestamp='2026-08-04T12:30:00.000Z'
const node=id=>createGraphNode({nodeId:`org-1:test.object:${id}`,nodeType:'test.object',organizationId:'org-1',label:id,status:'active',createdAt:timestamp,updatedAt:timestamp,metadata:{source:'audit-v2'}})
const edge=(id,from,to)=>createGraphEdge({edgeId:id,relationType:'test_links',sourceNodeId:from.nodeId,targetNodeId:to.nodeId,organizationId:'org-1',source:'audit-v2',confidence:1,validFrom:timestamp,createdAt:timestamp,metadata:{}})

test('Auditoría V2 Graph: replaceAll idéntico es un no-op y no fabrica una revisión',()=>{
 const repository=createKnowledgeGraphRepository(),a=node('a'),b=node('b')
 repository.addNode(a);repository.addNode(b);repository.addEdge(edge('a-b',a,b))
 const before=repository.snapshot()
 const result=repository.replaceAll({nodes:before.nodes,edges:before.edges,expectedVersion:before.version})
 assert.equal(result.version,before.version)
 assert.deepEqual(repository.snapshot(),before)
})

test('Auditoría V2 Graph: clear sobre repositorio vacío conserva versión cero',()=>{
 const repository=createKnowledgeGraphRepository()
 repository.clear();repository.clear()
 assert.equal(repository.getVersion(),0)
 assert.deepEqual(repository.health(),{nodes:0,edges:0,organizations:0,relations:0,version:0})
})

test('Auditoría V2 Graph: un conflicto vencido no evalúa nodos ni aristas hostiles',()=>{
 const repository=createKnowledgeGraphRepository(),stale=repository.snapshot()
 repository.addNode(node('concurrent'))
 let nodeReads=0,edgeReads=0
 const hostileNode={get nodeId(){nodeReads+=1;throw new Error('nodo evaluado')}}
 const hostileEdge={get edgeId(){edgeReads+=1;throw new Error('arista evaluada')}}
 assert.throws(()=>repository.replaceAll({nodes:[hostileNode],edges:[hostileEdge],expectedVersion:stale.version}),/Conflicto de versión/)
 assert.equal(nodeReads,0);assert.equal(edgeReads,0)
 assert.equal(repository.getNode('org-1:test.object:concurrent').label,'concurrent')
})

test('Auditoría V2 Graph: un replaceAll inválido conserva versión, nodos, aristas e índices',()=>{
 const repository=createKnowledgeGraphRepository(),a=node('a'),b=node('b')
 repository.addNode(a);repository.addNode(b);repository.addEdge(edge('a-b',a,b))
 const before=repository.snapshot(),health=repository.health()
 assert.throws(()=>repository.replaceAll({nodes:[a],edges:[...before.edges],expectedVersion:before.version}),/ambos nodos existan/)
 assert.deepEqual(repository.snapshot(),before)
 assert.deepEqual(repository.health(),health)
 assert.equal(repository.neighbors(a.nodeId).length,1)
 assert.equal(repository.edgesByRelation('test_links').length,1)
})

test('Auditoría V2 Graph: clear con contenido avanza una sola revisión y elimina todos los índices',()=>{
 const repository=createKnowledgeGraphRepository(),a=node('a'),b=node('b')
 repository.addNode(a);repository.addNode(b);repository.addEdge(edge('a-b',a,b))
 const before=repository.getVersion()
 repository.clear()
 assert.equal(repository.getVersion(),before+1)
 assert.deepEqual(repository.health(),{nodes:0,edges:0,organizations:0,relations:0,version:before+1})
 assert.equal(repository.neighbors(a.nodeId).length,0)
 assert.equal(repository.nodesForOrganization('org-1').length,0)
 assert.equal(repository.edgesByRelation('test_links').length,0)
})
