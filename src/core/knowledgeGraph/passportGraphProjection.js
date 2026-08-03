import{createGraphNode,createGraphEdge}from'./graphContract.js'
import{preferredProjectionCandidate}from'./conflictResolutionPolicy.js'

const text=value=>String(value??'').trim()
const list=value=>Array.isArray(value)?value:[]
const relationType=value=>text(value).replaceAll('.','_')
const nodeIdFor=({organizationId,objectType,objectId})=>`${organizationId}:${objectType}:${objectId}`
const edgeIdFor=(passport,relationship)=>`${passport.passportId}:${relationType(relationship.type)}:${relationship.targetType}:${relationship.targetId}`

function assertRepository(repository){
 const required=['snapshot','replaceAll']
 if(!repository||required.some(method=>typeof repository[method]!=='function'))throw new Error('Se requiere un repositorio de Knowledge Graph válido')
}

function assertPassport(passport){
 if(!passport?.object||!text(passport.passportId)||!Array.isArray(passport.relationships))throw new Error('Se requiere un Passport válido')
 const object=passport.object
 for(const field of['objectType','objectId','organizationId','label','status','createdAt','updatedAt'])if(!text(object[field]))throw new Error(`El objeto del Passport requiere ${field}`)
 for(const field of['identity','attributes','metadata'])if(!object[field]||typeof object[field]!=='object'||Array.isArray(object[field]))throw new Error(`El objeto del Passport requiere ${field}`)
}

function intelligentObjectEvidence(object){
 return{
  objectType:object.objectType,
  objectId:object.objectId,
  organizationId:object.organizationId,
  siteId:object.siteId??null,
  version:object.version,
  identity:object.identity,
  attributes:object.attributes,
  metadata:object.metadata
 }
}

function objectNode(passport){
 const object=passport.object
 return createGraphNode({
  nodeId:nodeIdFor(object),
  nodeType:object.objectType,
  organizationId:object.organizationId,
  siteId:object.siteId,
  label:object.label,
  status:object.status,
  createdAt:object.createdAt,
  updatedAt:object.updatedAt,
  metadata:{
   source:'passport',
   passportId:passport.passportId,
   objectVersion:object.version,
   intelligentObject:intelligentObjectEvidence(object)
  }
 })
}

function targetNode(passport,relationship,resolveTarget){
 const object=passport.object
 const targetOrganizationId=text(relationship.targetOrganizationId)
 if(!targetOrganizationId)throw new Error('Cada relación del Passport requiere la empresa explícita del destino')
 if(targetOrganizationId!==object.organizationId)throw new Error('El Passport no puede proyectar relaciones hacia otra empresa')
 const ref={organizationId:targetOrganizationId,objectType:text(relationship.targetType),objectId:text(relationship.targetId),siteId:relationship.targetSiteId??object.siteId}
 if(!ref.objectType||!ref.objectId)throw new Error('Cada relación del Passport requiere destino completo')
 const resolved=typeof resolveTarget==='function'?resolveTarget(Object.freeze({...ref}),relationship,passport):null
 if(resolved)return createGraphNode({...resolved,nodeId:nodeIdFor(ref),nodeType:ref.objectType,organizationId:ref.organizationId,siteId:resolved.siteId??ref.siteId})
 const timestamp=passport.generatedAt??object.updatedAt
 return createGraphNode({nodeId:nodeIdFor(ref),nodeType:ref.objectType,organizationId:ref.organizationId,siteId:ref.siteId,label:text(relationship.targetLabel)||ref.objectId,status:text(relationship.targetStatus)||'referenced',createdAt:timestamp,updatedAt:timestamp,metadata:{source:'passport-reference'}})
}

function projectedEdge(passport,relationship,sourceNodeId,targetNodeId){
 const type=relationType(relationship.type)
 if(!type)throw new Error('Cada relación del Passport requiere type')
 const timestamp=relationship.validFrom??relationship.createdAt??passport.generatedAt
 return createGraphEdge({edgeId:edgeIdFor(passport,relationship),relationType:type,sourceNodeId,targetNodeId,organizationId:passport.object.organizationId,source:'passport',confidence:relationship.confidence??1,validFrom:timestamp,validTo:relationship.validTo??null,createdAt:relationship.createdAt??timestamp,metadata:{passportId:passport.passportId,relationshipSource:text(relationship.source)||null,relationship:{...relationship}}})
}

function ownedByPassport(edge,passportId){return edge?.source==='passport'&&edge?.metadata?.passportId===passportId}
function provisionalNode(node){return node?.metadata?.source==='passport-reference'}
function preferredSourceNode(existing,incoming){return preferredProjectionCandidate(existing,incoming,{organizationError:'El nodo del Passport ya pertenece a otra empresa'})}
function preferredTargetNode(existing,incoming){if(!existing)return incoming;if(existing.organizationId!==incoming.organizationId)throw new Error('El nodo destino ya pertenece a otra empresa');const existingProvisional=provisionalNode(existing),incomingProvisional=provisionalNode(incoming);if(!existingProvisional&&incomingProvisional)return existing;if(existingProvisional&&!incomingProvisional)return incoming;return preferredProjectionCandidate(existing,incoming,{organizationError:'El nodo destino ya pertenece a otra empresa'})}
function removeOrphanPassportReferences(nodes,edges,candidateNodeIds){
 const connected=new Set()
 for(const edge of edges.values()){connected.add(edge.sourceNodeId);connected.add(edge.targetNodeId)}
 for(const nodeId of candidateNodeIds){const node=nodes.get(nodeId);if(node&&provisionalNode(node)&&!connected.has(nodeId))nodes.delete(nodeId)}
}

export function projectPassportToGraph(repository,passport,{resolveTarget=null}={}){
 assertRepository(repository)
 assertPassport(passport)
 const current=repository.snapshot(),nodes=new Map(current.nodes.map(node=>[node.nodeId,node]))
 const removedEdges=current.edges.filter(edge=>ownedByPassport(edge,passport.passportId))
 const cleanupCandidates=new Set(removedEdges.map(edge=>edge.targetNodeId))
 const edges=new Map(current.edges.filter(edge=>!ownedByPassport(edge,passport.passportId)).map(edge=>[edge.edgeId,edge]))
 const source=objectNode(passport)
 nodes.set(source.nodeId,preferredSourceNode(nodes.get(source.nodeId),source))
 const projectedEdges=[]
 for(const relationship of list(passport.relationships)){
  const target=targetNode(passport,relationship,resolveTarget)
  nodes.set(target.nodeId,preferredTargetNode(nodes.get(target.nodeId),target))
  const edge=projectedEdge(passport,relationship,source.nodeId,target.nodeId)
  edges.set(edge.edgeId,edge)
  projectedEdges.push(edge)
 }
 removeOrphanPassportReferences(nodes,edges,cleanupCandidates)
 repository.replaceAll({nodes:[...nodes.values()],edges:[...edges.values()],expectedVersion:current.version})
 return Object.freeze({node:repository.getNode?.(source.nodeId)??source,edges:Object.freeze(projectedEdges),version:repository.getVersion?.()??repository.snapshot().version})
}
