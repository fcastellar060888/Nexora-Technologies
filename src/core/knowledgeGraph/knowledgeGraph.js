import{createGraphNode,createGraphEdge}from'./graphContract.js'
import{createKnowledgeGraphRepository}from'./graphRepository.js'

const LEGACY_RELATION_TYPE_PATTERN=/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/
const TYPE_PATTERN=/^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/

function requiredString(value,label){const normalized=String(value??'').trim();if(!normalized)throw new Error(`${label} es obligatorio`);return normalized}
function clone(value){try{return structuredClone(value??{})}catch{throw new Error('Los atributos deben ser serializables')}}
function deepFreeze(value){if(!value||typeof value!=='object'||Object.isFrozen(value))return value;for(const nested of Object.values(value))deepFreeze(nested);return Object.freeze(value)}
function nodeKey(ref){return`${ref.organizationId}:${ref.objectType}:${ref.objectId}`}
function validDate(value,label){const date=new Date(value);if(Number.isNaN(date.getTime()))throw new Error(`${label} no es válida`);return date.toISOString()}
function canonicalRelationType(value){return value.replaceAll('.','_')}

export function objectRef({objectType,objectId,organizationId,siteId=null}={}){
 const normalizedType=requiredString(objectType,'El tipo de objeto')
 if(!TYPE_PATTERN.test(normalizedType))throw new Error('El tipo de objeto debe usar nomenclatura canónica')
 return deepFreeze({objectType:normalizedType,objectId:requiredString(objectId,'El identificador del objeto'),organizationId:requiredString(organizationId,'La empresa'),siteId:String(siteId??'').trim()||null})
}

export function graphNode({ref,label='',status='active',attributes={},createdAt=new Date().toISOString(),updatedAt=createdAt}={}){
 const normalizedRef=objectRef(ref),created=validDate(createdAt,'La fecha de creación'),updated=validDate(updatedAt,'La fecha de actualización')
 if(Date.parse(updated)<Date.parse(created))throw new Error('La fecha de actualización no puede ser anterior a la creación')
 return deepFreeze({id:nodeKey(normalizedRef),ref:normalizedRef,label:String(label||normalizedRef.objectId),status:String(status||'active'),attributes:clone(attributes),createdAt:created,updatedAt:updated})
}

export function graphRelation({relationType,from,to,directed=true,attributes={},createdAt=new Date().toISOString(),relationId=crypto.randomUUID()}={}){
 const normalizedType=requiredString(relationType,'El tipo de relación')
 if(!LEGACY_RELATION_TYPE_PATTERN.test(normalizedType))throw new Error('La relación debe usar una nomenclatura estable en minúsculas')
 const source=objectRef(from),target=objectRef(to)
 if(source.organizationId!==target.organizationId)throw new Error('No se permiten relaciones entre empresas diferentes')
 if(nodeKey(source)===nodeKey(target))throw new Error('La relación no puede conectar un objeto consigo mismo')
 return deepFreeze({id:requiredString(relationId,'El identificador de la relación'),relationType:normalizedType,from:source,to:target,directed:Boolean(directed),attributes:clone(attributes),createdAt:validDate(createdAt,'La fecha de la relación')})
}

function canonicalNode(node){return createGraphNode({nodeId:node.id,nodeType:node.ref.objectType,organizationId:node.ref.organizationId,siteId:node.ref.siteId,label:node.label,status:node.status,createdAt:node.createdAt,updatedAt:node.updatedAt,metadata:{legacyRef:node.ref,attributes:node.attributes}})}
function canonicalEdge(relation){return createGraphEdge({edgeId:relation.id,relationType:canonicalRelationType(relation.relationType),sourceNodeId:nodeKey(relation.from),targetNodeId:nodeKey(relation.to),organizationId:relation.from.organizationId,source:'legacy-api',confidence:1,validFrom:relation.createdAt,createdAt:relation.createdAt,metadata:{legacyRelationType:relation.relationType,directed:relation.directed,attributes:relation.attributes,from:relation.from,to:relation.to}})}
function legacyNode(node){if(!node)return null;const ref=node.metadata?.legacyRef||legacyNodeRef(node.nodeId,node.organizationId);return graphNode({ref,label:node.label,status:node.status,attributes:node.metadata?.attributes||{},createdAt:node.createdAt,updatedAt:node.updatedAt})}
function legacyRelation(edge){if(!edge)return null;const metadata=edge.metadata||{},from=metadata.from||legacyNodeRef(edge.sourceNodeId,edge.organizationId),to=metadata.to||legacyNodeRef(edge.targetNodeId,edge.organizationId);return graphRelation({relationId:edge.edgeId,relationType:metadata.legacyRelationType||edge.relationType,from,to,directed:metadata.directed!==false,attributes:metadata.attributes||{},createdAt:edge.createdAt})}
function legacyNodeRef(nodeId,organizationId){const prefix=`${organizationId}:`,body=nodeId.startsWith(prefix)?nodeId.slice(prefix.length):nodeId,index=body.lastIndexOf(':');if(index<1)throw new Error(`No se puede reconstruir la referencia del nodo ${nodeId}`);return objectRef({organizationId,objectType:body.slice(0,index),objectId:body.slice(index+1)})}

export function createKnowledgeGraph({maxRelations=50000}={}){
 if(!Number.isInteger(maxRelations)||maxRelations<1)throw new Error('maxRelations debe ser un entero positivo')
 const repository=createKnowledgeGraphRepository()

 function upsertNode(nodeInput){const node=nodeInput?.ref?graphNode(nodeInput):graphNode({ref:nodeInput,label:nodeInput?.label,status:nodeInput?.status,attributes:nodeInput?.attributes});const existing=repository.getNode(node.id);if(existing)return legacyNode(existing);repository.addNode(canonicalNode(node));return node}
 function connect(relationInput){const relation=graphRelation(relationInput),fromId=nodeKey(relation.from),toId=nodeKey(relation.to);if(!repository.getNode(fromId))upsertNode({ref:relation.from});if(!repository.getNode(toId))upsertNode({ref:relation.to});const result=repository.addEdge(canonicalEdge(relation));trimRelations();return legacyRelation(result.edge)}
 function trimRelations(){const snapshot=repository.snapshot();if(snapshot.edges.length<=maxRelations)return;const keep=snapshot.edges.slice(snapshot.edges.length-maxRelations);repository.replaceAll({nodes:snapshot.nodes,edges:keep})}
 function disconnect(relationId){const id=String(relationId??'').trim(),snapshot=repository.snapshot();if(!repository.getEdge(id))return false;repository.replaceAll({nodes:snapshot.nodes,edges:snapshot.edges.filter(edge=>edge.edgeId!==id)});return true}
 function getNode(ref){return legacyNode(repository.getNode(nodeKey(objectRef(ref))))}
 function neighbors(ref,{relationType=null,direction='both'}={}){const canonicalType=relationType?canonicalRelationType(relationType):null;return repository.neighbors(nodeKey(objectRef(ref)),{relationType:canonicalType,direction}).map(item=>deepFreeze({relation:legacyRelation(item.edge),node:legacyNode(item.node),direction:item.direction}))}
 function traverse(start,{maxDepth=3,relationTypes=[]}={}){const startRef=objectRef(start),visited=new Set([nodeKey(startRef)]),queue=[{ref:startRef,depth:0}],result=[];while(queue.length){const current=queue.shift();if(current.depth>=maxDepth)continue;for(const item of neighbors(current.ref)){if(relationTypes.length&&!relationTypes.includes(item.relation.relationType))continue;const key=item.node.id;if(visited.has(key))continue;visited.add(key);const next=deepFreeze({...item,depth:current.depth+1});result.push(next);queue.push({ref:item.node.ref,depth:next.depth})}}return Object.freeze(result)}
 function findPath(from,to,{maxDepth=6,relationTypes=[]}={}){const target=nodeKey(objectRef(to)),queue=[{ref:objectRef(from),path:[]}],visited=new Set([nodeKey(objectRef(from))]);while(queue.length){const current=queue.shift();if(current.path.length>=maxDepth)continue;for(const item of neighbors(current.ref)){if(relationTypes.length&&!relationTypes.includes(item.relation.relationType))continue;const path=[...current.path,item],key=item.node.id;if(key===target)return Object.freeze(path);if(!visited.has(key)){visited.add(key);queue.push({ref:item.node.ref,path})}}}return Object.freeze([])}
 function snapshot({organizationId=null}={}){const current=repository.snapshot(),nodes=current.nodes.map(legacyNode).filter(node=>!organizationId||node.ref.organizationId===organizationId),allowed=new Set(nodes.map(node=>node.id)),relations=current.edges.map(legacyRelation).filter(relation=>allowed.has(nodeKey(relation.from))&&allowed.has(nodeKey(relation.to)));return deepFreeze({generatedAt:new Date().toISOString(),nodes,relations})}
 function clear(){repository.clear()}
 return Object.freeze({upsertNode,connect,disconnect,getNode,neighbors,traverse,findPath,snapshot,clear,repository})
}

export function passportRelationships(graph,passport,{maxDepth=1,relationTypes=[]}={}){
 if(!passport?.object)throw new Error('Se requiere un Passport válido')
 const ref=objectRef({objectType:passport.object.objectType,objectId:passport.object.objectId,organizationId:passport.object.organizationId,siteId:passport.object.siteId})
 return Object.freeze(graph.traverse(ref,{maxDepth,relationTypes}).map(item=>deepFreeze({relationId:item.relation.id,relationType:item.relation.relationType,direction:item.direction,depth:item.depth,object:item.node?.ref||null,label:item.node?.label||''})))
}
