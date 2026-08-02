import{createGraphNode,createGraphEdge}from'./graphContract.js'

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
  metadata:{source:'passport',passportId:passport.passportId,objectVersion:object.version}
 })
}

function targetNode(passport,relationship,resolveTarget){
 const object=passport.object
 const targetOrganizationId=text(relationship.targetOrganizationId??relationship.organizationId??object.organizationId)
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
 return createGraphEdge({
  edgeId:edgeIdFor(passport,relationship),
  relationType:type,
  sourceNodeId,
  targetNodeId,
  organizationId:passport.object.organizationId,
  source:text(relationship.source)||'passport',
  confidence:relationship.confidence??1,
  validFrom:timestamp,
  validTo:relationship.validTo??null,
  createdAt:relationship.createdAt??timestamp,
  metadata:{passportId:passport.passportId,relationship:{...relationship}}
 })
}

export function projectPassportToGraph(repository,passport,{resolveTarget=null}={}){
 assertRepository(repository)
 assertPassport(passport)
 const current=repository.snapshot(),nodes=new Map(current.nodes.map(node=>[node.nodeId,node])),edges=new Map(current.edges.map(edge=>[edge.edgeId,edge]))
 const source=objectNode(passport)
 const existingSource=nodes.get(source.nodeId)
 if(existingSource&&existingSource.organizationId!==source.organizationId)throw new Error('El nodo del Passport ya pertenece a otra empresa')
 nodes.set(source.nodeId,source)
 const projectedEdges=[]
 for(const relationship of list(passport.relationships)){
  const target=targetNode(passport,relationship,resolveTarget)
  const existingTarget=nodes.get(target.nodeId)
  if(existingTarget&&existingTarget.organizationId!==target.organizationId)throw new Error('El nodo destino ya pertenece a otra empresa')
  if(!existingTarget)nodes.set(target.nodeId,target)
  const edge=projectedEdge(passport,relationship,source.nodeId,target.nodeId)
  edges.set(edge.edgeId,edge)
  projectedEdges.push(edge)
 }
 repository.replaceAll({nodes:[...nodes.values()],edges:[...edges.values()]})
 return Object.freeze({node:repository.getNode?.(source.nodeId)??source,edges:Object.freeze(projectedEdges),version:repository.getVersion?.()??repository.snapshot().version})
}
