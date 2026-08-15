import test from'node:test'
import assert from'node:assert/strict'
import{createGraphNode,createGraphEdge,isGraphNode,isGraphEdge}from'../src/core/knowledgeGraph/graphContract.js'

const nodeInput={nodeId:'plant-1',nodeType:'cultivation.plant',organizationId:'company-1',siteId:'site-1',label:'VIL-N1-C1-F1-P1',createdAt:'2026-01-01T00:00:00Z',metadata:{identity:{row:1}}}

test('crea nodos canónicos profundamente inmutables',()=>{
 const node=createGraphNode(nodeInput)
 assert.equal(isGraphNode(node),true)
 assert.equal(node.createdAt,'2026-01-01T00:00:00.000Z')
 assert.equal(Object.isFrozen(node.metadata.identity),true)
 assert.throws(()=>{node.metadata.identity.row=2},TypeError)
})

test('rechaza nodos incompletos y tipos no canónicos',()=>{
 assert.equal(isGraphNode({...nodeInput,nodeId:undefined}),false)
 assert.throws(()=>createGraphNode({...nodeInput,nodeType:'Plant'}),/nomenclatura canónica/)
 assert.throws(()=>createGraphNode({...nodeInput,updatedAt:'2025-12-31'}),/anterior/)
})

test('crea aristas temporales con fuente y confianza',()=>{
 const edge=createGraphEdge({edgeId:'edge-1',relationType:'descends_from',sourceNodeId:'plant-1',targetNodeId:'mother-1',organizationId:'company-1',source:'propagation',confidence:1,validFrom:'2026-01-01T00:00:00Z',metadata:{generation:2}})
 assert.equal(isGraphEdge(edge),true)
 assert.equal(edge.validTo,null)
 assert.equal(edge.metadata.generation,2)
 assert.equal(Object.isFrozen(edge.metadata),true)
})

test('rechaza aristas ambiguas o temporalmente inválidas',()=>{
 assert.throws(()=>createGraphEdge({edgeId:'edge-1',relationType:'descends_from',sourceNodeId:'plant-1',targetNodeId:'plant-1',organizationId:'company-1'}),/consigo mismo/)
 assert.throws(()=>createGraphEdge({edgeId:'edge-1',relationType:'DescendsFrom',sourceNodeId:'plant-1',targetNodeId:'mother-1',organizationId:'company-1'}),/nomenclatura canónica/)
 assert.throws(()=>createGraphEdge({edgeId:'edge-1',relationType:'descends_from',sourceNodeId:'plant-1',targetNodeId:'mother-1',organizationId:'company-1',confidence:1.1}),/entre 0 y 1/)
 assert.throws(()=>createGraphEdge({edgeId:'edge-1',relationType:'descends_from',sourceNodeId:'plant-1',targetNodeId:'mother-1',organizationId:'company-1',validFrom:'2026-02-01',validTo:'2026-01-01'}),/anterior/)
})

test('los validadores no completan campos faltantes',()=>{
 const edge=createGraphEdge({edgeId:'edge-1',relationType:'located_in',sourceNodeId:'plant-1',targetNodeId:'bed-1',organizationId:'company-1'})
 const incomplete={...edge};delete incomplete.confidence
 assert.equal(isGraphEdge(incomplete),false)
 const node=createGraphNode(nodeInput)
 const incompleteNode={...node};delete incompleteNode.status
 assert.equal(isGraphNode(incompleteNode),false)
})
