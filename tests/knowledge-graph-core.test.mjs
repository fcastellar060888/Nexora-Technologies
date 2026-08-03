import test from'node:test'
import assert from'node:assert/strict'
import{createKnowledgeGraph,graphNode,graphRelation,passportRelationships}from'../src/core/knowledgeGraph/index.js'
import{createIntelligentObject,createPassport}from'../src/core/passport/index.js'

const organizationId='org-1'
const refs={
 site:{objectType:'organization.site',objectId:'site-1',organizationId},
 house:{objectType:'cultivation.house',objectId:'house-1',organizationId,siteId:'site-1'},
 bed:{objectType:'cultivation.bed',objectId:'bed-1',organizationId,siteId:'site-1'},
 lot:{objectType:'cultivation.lot',objectId:'lot-1',organizationId,siteId:'site-1'},
 plant:{objectType:'cultivation.plant',objectId:'plant-1',organizationId,siteId:'site-1'},
 mother:{objectType:'cultivation.mother',objectId:'mother-1',organizationId,siteId:'site-1'}
}

test('crea nodos y relaciones inmutables y aisladas por empresa',()=>{
 const node=graphNode({ref:refs.plant,label:'Planta 1'})
 const relation=graphRelation({relationType:'located.in',from:refs.plant,to:refs.bed})
 assert.equal(Object.isFrozen(node),true)
 assert.equal(Object.isFrozen(relation),true)
 assert.equal(relation.from.organizationId,organizationId)
 assert.throws(()=>graphRelation({relationType:'located.in',from:refs.plant,to:{...refs.bed,organizationId:'org-2'}}),/empresas diferentes/)
})

test('deduplica relaciones y consulta vecinos por dirección',()=>{
 const graph=createKnowledgeGraph()
 graph.upsertNode({ref:refs.plant,label:'Planta 1'})
 graph.upsertNode({ref:refs.bed,label:'Cama 1'})
 const relation={relationId:'plant-bed-location',relationType:'located.in',from:refs.plant,to:refs.bed}
 const first=graph.connect(relation)
 const duplicate=graph.connect(relation)
 assert.equal(first.id,duplicate.id)
 assert.equal(graph.neighbors(refs.plant,{direction:'out'}).length,1)
 assert.equal(graph.neighbors(refs.bed,{direction:'in'}).length,1)
})

test('recorre relaciones operativas con profundidad controlada',()=>{
 const graph=createKnowledgeGraph()
 graph.connect({relationType:'located.in',from:refs.plant,to:refs.bed})
 graph.connect({relationType:'located.in',from:refs.bed,to:refs.house})
 graph.connect({relationType:'located.in',from:refs.house,to:refs.site})
 const depthTwo=graph.traverse(refs.plant,{maxDepth:2,relationTypes:['located.in']})
 assert.equal(depthTwo.some(item=>item.node.ref.objectId==='bed-1'&&item.depth===1),true)
 assert.equal(depthTwo.some(item=>item.node.ref.objectId==='house-1'&&item.depth===2),true)
 assert.equal(depthTwo.some(item=>item.node.ref.objectId==='site-1'),false)
})

test('encuentra una ruta entre objetos conectados',()=>{
 const graph=createKnowledgeGraph()
 graph.connect({relationType:'belongs.to',from:refs.plant,to:refs.lot})
 graph.connect({relationType:'descends.from',from:refs.plant,to:refs.mother})
 graph.connect({relationType:'located.in',from:refs.lot,to:refs.house})
 const path=graph.findPath(refs.plant,refs.house)
 assert.equal(path.length,2)
 assert.equal(path[0].relation.relationType,'belongs.to')
 assert.equal(path.at(-1).node.ref.objectId,'house-1')
})

test('proyecta relaciones del Knowledge Graph dentro del Passport',()=>{
 const graph=createKnowledgeGraph()
 graph.upsertNode({ref:refs.plant,label:'Planta 1'})
 graph.upsertNode({ref:refs.mother,label:'Madre 1'})
 graph.connect({relationType:'descends.from',from:refs.plant,to:refs.mother})
 const object=createIntelligentObject({...refs.plant,label:'Planta 1'})
 const passport=createPassport({object})
 const relationships=passportRelationships(graph,passport)
 assert.equal(relationships.length,1)
 assert.equal(relationships[0].relationType,'descends.from')
 assert.equal(relationships[0].object.objectId,'mother-1')
})

test('genera snapshots filtrados por empresa',()=>{
 const graph=createKnowledgeGraph()
 graph.connect({relationType:'located.in',from:refs.plant,to:refs.bed})
 graph.connect({relationType:'located.in',from:{objectType:'asset.machine',objectId:'machine-2',organizationId:'org-2'},to:{objectType:'organization.site',objectId:'site-2',organizationId:'org-2'}})
 const snapshot=graph.snapshot({organizationId})
 assert.equal(snapshot.nodes.every(node=>node.ref.organizationId===organizationId),true)
 assert.equal(snapshot.relations.length,1)
 assert.equal(Object.isFrozen(snapshot),true)
})
