import{createGraphNode,createGraphEdge,isGraphNode,isGraphEdge}from'./graphContract.js'

const list=value=>Array.isArray(value)?value:[]
const freeze=value=>Object.freeze([...value])
function canonical(value){if(Array.isArray(value))return value.map(canonical);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])]));return value}
const identityFingerprint=value=>JSON.stringify(canonical(value))
const semanticEdgeKey=edge=>JSON.stringify(canonical({organizationId:edge.organizationId,relationType:edge.relationType,sourceNodeId:edge.sourceNodeId,targetNodeId:edge.targetNodeId,source:edge.source,confidence:edge.confidence,validFrom:edge.validFrom,validTo:edge.validTo,metadata:edge.metadata}))

export function createKnowledgeGraphRepository(){
 let nodes=new Map(),edges=new Map(),outgoing=new Map(),incoming=new Map(),byOrganization=new Map(),byRelation=new Map(),semanticEdges=new Map(),version=0

 function indexSet(map,key,value){if(!map.has(key))map.set(key,new Set());map.get(key).add(value)}
 function rebuild(nextNodes,nextEdges){
  const nextOutgoing=new Map(),nextIncoming=new Map(),nextOrganizations=new Map(),nextRelations=new Map(),nextSemantic=new Map()
  for(const node of nextNodes.values())indexSet(nextOrganizations,node.organizationId,node.nodeId)
  for(const edge of nextEdges.values()){
   indexSet(nextOutgoing,edge.sourceNodeId,edge.edgeId)
   indexSet(nextIncoming,edge.targetNodeId,edge.edgeId)
   indexSet(nextOrganizations,edge.organizationId,edge.edgeId)
   indexSet(nextRelations,edge.relationType,edge.edgeId)
   nextSemantic.set(semanticEdgeKey(edge),edge.edgeId)
  }
  nodes=nextNodes;edges=nextEdges;outgoing=nextOutgoing;incoming=nextIncoming;byOrganization=nextOrganizations;byRelation=nextRelations;semanticEdges=nextSemantic;version+=1
 }
 function normalizeNode(value){return isGraphNode(value)?value:createGraphNode(value)}
 function normalizeEdge(value){return isGraphEdge(value)?value:createGraphEdge(value)}
 function validateEdge(edge,nodeMap=nodes){
  const source=nodeMap.get(edge.sourceNodeId),target=nodeMap.get(edge.targetNodeId)
  if(!source||!target)throw new Error('La arista requiere que ambos nodos existan')
  if(source.organizationId!==edge.organizationId||target.organizationId!==edge.organizationId)throw new Error('La arista no puede cruzar organizaciones')
 }
 function addNode(value){
  const node=normalizeNode(value),existing=nodes.get(node.nodeId)
  if(existing){
   if(existing.organizationId!==node.organizationId)throw new Error('El nodeId ya pertenece a otra organización')
   if(identityFingerprint(existing)!==identityFingerprint(node))throw new Error(`El nodeId ${node.nodeId} ya pertenece a un nodo diferente`)
   return Object.freeze({inserted:false,node:existing})
  }
  const next=new Map(nodes);next.set(node.nodeId,node);rebuild(next,new Map(edges));return Object.freeze({inserted:true,node})
 }
 function addEdge(value){
  const edge=normalizeEdge(value);validateEdge(edge)
  const existingById=edges.get(edge.edgeId)
  if(existingById){
   if(identityFingerprint(existingById)!==identityFingerprint(edge))throw new Error(`El edgeId ${edge.edgeId} ya pertenece a una arista diferente`)
   return Object.freeze({inserted:false,edge:existingById,reason:'edgeId'})
  }
  const semanticId=semanticEdges.get(semanticEdgeKey(edge))
  if(semanticId)return Object.freeze({inserted:false,edge:edges.get(semanticId),reason:'semantic'})
  const next=new Map(edges);next.set(edge.edgeId,edge);rebuild(new Map(nodes),next);return Object.freeze({inserted:true,edge})
 }
 function replaceAll({nodes:nodeValues=[],edges:edgeValues=[],expectedVersion}={}){
  if(!Number.isInteger(expectedVersion)||expectedVersion<0)throw new Error('replaceAll requiere expectedVersion válido')
  if(expectedVersion!==version)throw new Error(`Conflicto de versión del Knowledge Graph: se esperaba ${expectedVersion} y la versión actual es ${version}`)
  const nextNodes=new Map(),nextEdges=new Map(),semantic=new Set()
  for(const value of list(nodeValues)){
   const node=normalizeNode(value)
   if(nextNodes.has(node.nodeId))throw new Error(`Nodo duplicado: ${node.nodeId}`)
   nextNodes.set(node.nodeId,node)
  }
  for(const value of list(edgeValues)){
   const edge=normalizeEdge(value)
   if(nextEdges.has(edge.edgeId))throw new Error(`Arista duplicada: ${edge.edgeId}`)
   validateEdge(edge,nextNodes)
   const key=semanticEdgeKey(edge)
   if(semantic.has(key))throw new Error(`Relación semántica duplicada: ${edge.relationType}`)
   semantic.add(key);nextEdges.set(edge.edgeId,edge)
  }
  rebuild(nextNodes,nextEdges)
  return snapshot()
 }
 function getNode(nodeId){return nodes.get(String(nodeId||'').trim())||null}
 function getEdge(edgeId){return edges.get(String(edgeId||'').trim())||null}
 function edgeList(ids){return freeze([...(ids||[])].map(id=>edges.get(id)).filter(Boolean))}
 function neighbors(nodeId,{direction='both',relationType=null}={}){
  const id=String(nodeId||'').trim();if(!nodes.has(id))return freeze([])
  const edgeIds=new Set()
  if(direction==='out'||direction==='both')for(const edgeId of outgoing.get(id)||[])edgeIds.add(edgeId)
  if(direction==='in'||direction==='both')for(const edgeId of incoming.get(id)||[])edgeIds.add(edgeId)
  const result=[]
  for(const edgeId of edgeIds){
   const edge=edges.get(edgeId);if(relationType&&edge.relationType!==relationType)continue
   const neighborId=edge.sourceNodeId===id?edge.targetNodeId:edge.sourceNodeId
   result.push(Object.freeze({node:nodes.get(neighborId),edge,direction:edge.sourceNodeId===id?'out':'in'}))
  }
  return freeze(result)
 }
 function descendants(nodeId,{relationType='descends_from',maxDepth=100}={}){
  const root=String(nodeId||'').trim();if(!nodes.has(root))return freeze([])
  const visited=new Set([root]),queue=[{id:root,depth:0}],result=[]
  while(queue.length){
   const current=queue.shift();if(current.depth>=maxDepth)continue
   for(const edgeId of incoming.get(current.id)||[]){
    const edge=edges.get(edgeId);if(edge.relationType!==relationType)continue
    const childId=edge.sourceNodeId;if(visited.has(childId))continue
    visited.add(childId);const item=Object.freeze({node:nodes.get(childId),edge,depth:current.depth+1});result.push(item);queue.push({id:childId,depth:current.depth+1})
   }
  }
  return freeze(result)
 }
 function nodesForOrganization(organizationId){
  const ids=byOrganization.get(String(organizationId||'').trim())||new Set()
  return freeze([...ids].map(id=>nodes.get(id)).filter(Boolean))
 }
 function edgesByRelation(relationType){return edgeList(byRelation.get(String(relationType||'').trim()))}
 function snapshot(){return Object.freeze({nodes:freeze(nodes.values()),edges:freeze(edges.values()),version})}
 function health(){return Object.freeze({nodes:nodes.size,edges:edges.size,organizations:new Set([...nodes.values()].map(item=>item.organizationId)).size,relations:byRelation.size,version})}
 function clear(){rebuild(new Map(),new Map())}
 return Object.freeze({addNode,addEdge,replaceAll,getNode,getEdge,neighbors,descendants,nodesForOrganization,edgesByRelation,snapshot,health,clear,getVersion:()=>version})
}
