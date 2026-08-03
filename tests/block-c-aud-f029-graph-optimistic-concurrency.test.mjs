import test from'node:test'
import assert from'node:assert/strict'
import{createGraphNode,createKnowledgeGraphRepository}from'../src/core/knowledgeGraph/index.js'

const timestamp='2026-08-03T18:00:00.000Z'
const node=(id,label=id)=>createGraphNode({nodeId:`org-1:test.object:${id}`,nodeType:'test.object',organizationId:'org-1',label,status:'active',createdAt:timestamp,updatedAt:timestamp,metadata:{source:'test'}})

test('AUD-F029: replaceAll exige una versión esperada explícita',()=>{
 const repository=createKnowledgeGraphRepository(),before=repository.snapshot()
 assert.throws(()=>repository.replaceAll({nodes:[node('a')],edges:[]}),/expectedVersion/)
 assert.deepEqual(repository.snapshot(),before)
})

test('AUD-F029: una escritura basada en snapshot vencido no puede borrar un cambio concurrente',()=>{
 const repository=createKnowledgeGraphRepository()
 repository.addNode(node('base'))
 const stale=repository.snapshot()
 repository.addNode(node('concurrent'))
 const beforeConflict=repository.snapshot()
 assert.throws(()=>repository.replaceAll({nodes:[...stale.nodes,node('stale-writer')],edges:[],expectedVersion:stale.version}),/Conflicto de versión/)
 assert.deepEqual(repository.snapshot(),beforeConflict)
 assert.equal(repository.getNode('org-1:test.object:concurrent').label,'concurrent')
 assert.equal(repository.getNode('org-1:test.object:stale-writer'),null)
})

test('AUD-F029: una escritura con la versión vigente se confirma y avanza exactamente una revisión',()=>{
 const repository=createKnowledgeGraphRepository()
 repository.addNode(node('base'))
 const current=repository.snapshot()
 const result=repository.replaceAll({nodes:[...current.nodes,node('next')],edges:current.edges,expectedVersion:current.version})
 assert.equal(result.version,current.version+1)
 assert.equal(repository.getNode('org-1:test.object:next').label,'next')
})

test('AUD-F029: el conflicto se detecta antes de normalizar entradas hostiles',()=>{
 const repository=createKnowledgeGraphRepository(),stale=repository.snapshot()
 repository.addNode(node('concurrent'))
 let accessed=0
 const hostile={get nodeId(){accessed+=1;throw new Error('no debe evaluarse')}}
 assert.throws(()=>repository.replaceAll({nodes:[hostile],edges:[],expectedVersion:stale.version}),/Conflicto de versión/)
 assert.equal(accessed,0)
 assert.equal(repository.getNode('org-1:test.object:concurrent').label,'concurrent')
})
