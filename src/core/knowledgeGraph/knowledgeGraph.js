const RELATION_TYPE_PATTERN=/^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)*$/

function requiredString(value,label){
 const normalized=String(value||'').trim()
 if(!normalized)throw new Error(`${label} es obligatorio`)
 return normalized
}

function clone(value){return structuredClone(value)}
function freeze(value){return Object.freeze(value)}

export function objectRef({objectType,objectId,organizationId,siteId=null}){
 return freeze({
  objectType:requiredString(objectType,'El tipo de objeto'),
  objectId:requiredString(objectId,'El identificador del objeto'),
  organizationId:requiredString(organizationId,'La empresa'),
  siteId:siteId?String(siteId):null
 })
}

export function graphNode({ref,label='',status='active',attributes={},createdAt=new Date().toISOString(),updatedAt=createdAt}){
 const normalizedRef=objectRef(ref)
 if(Number.isNaN(Date.parse(createdAt))||Number.isNaN(Date.parse(updatedAt)))throw new Error('Las fechas del nodo no son válidas')
 return freeze({
  id:`${normalizedRef.organizationId}:${normalizedRef.objectType}:${normalizedRef.objectId}`,
  ref:normalizedRef,
  label:String(label||normalizedRef.objectId),
  status:String(status||'active'),
  attributes:freeze(clone(attributes||{})),
  createdAt:new Date(createdAt).toISOString(),
  updatedAt:new Date(updatedAt).toISOString()
 })
}

export function graphRelation({relationType,from,to,directed=true,attributes={},createdAt=new Date().toISOString(),relationId=crypto.randomUUID()}){
 const normalizedType=requiredString(relationType,'El tipo de relación')
 if(!RELATION_TYPE_PATTERN.test(normalizedType))throw new Error('La relación debe usar una nomenclatura estable en minúsculas')
 const source=objectRef(from),target=objectRef(to)
 if(source.organizationId!==target.organizationId)throw new Error('No se permiten relaciones entre empresas diferentes')
 if(Number.isNaN(Date.parse(createdAt)))throw new Error('La fecha de la relación no es válida')
 return freeze({
  id:requiredString(relationId,'El identificador de la relación'),
  relationType:normalizedType,
  from:source,
  to:target,
  directed:Boolean(directed),
  attributes:freeze(clone(attributes||{})),
  createdAt:new Date(createdAt).toISOString()
 })
}

const refKey=ref=>`${ref.organizationId}:${ref.objectType}:${ref.objectId}`

export function createKnowledgeGraph({maxRelations=50000}={}){
 const nodes=new Map(),relations=new Map()

 function upsertNode(nodeInput){
  const node=nodeInput?.ref?graphNode(nodeInput):graphNode({ref:nodeInput,label:nodeInput?.label,status:nodeInput?.status,attributes:nodeInput?.attributes})
  nodes.set(node.id,node)
  return node
 }

 function connect(relationInput){
  const relation=graphRelation(relationInput)
  const fromKey=refKey(relation.from),toKey=refKey(relation.to)
  if(!nodes.has(fromKey))upsertNode({ref:relation.from})
  if(!nodes.has(toKey))upsertNode({ref:relation.to})
  const duplicate=[...relations.values()].find(item=>item.relationType===relation.relationType&&refKey(item.from)===fromKey&&refKey(item.to)===toKey)
  if(duplicate)return duplicate
  relations.set(relation.id,relation)
  while(relations.size>maxRelations)relations.delete(relations.keys().next().value)
  return relation
 }

 function disconnect(relationId){return relations.delete(String(relationId))}
 function getNode(ref){return nodes.get(refKey(ref))||null}

 function neighbors(ref,{relationType=null,direction='both'}={}){
  const key=refKey(ref),out=[]
  for(const relation of relations.values()){
   const from=refKey(relation.from),to=refKey(relation.to)
   if(relationType&&relation.relationType!==relationType)continue
   if((direction==='out'||direction==='both')&&from===key)out.push({relation,node:getNode(relation.to),direction:'out'})
   if((direction==='in'||direction==='both')&&to===key)out.push({relation,node:getNode(relation.from),direction:'in'})
   if(!relation.directed&&direction==='both'){
    if(to===key)out.push({relation,node:getNode(relation.from),direction:'out'})
    else if(from===key)out.push({relation,node:getNode(relation.to),direction:'out'})
   }
  }
  return out
 }

 function traverse(start,{maxDepth=3,relationTypes=[]}={}){
  const startKey=refKey(start),visited=new Set([startKey]),queue=[{ref:objectRef(start),depth:0}],result=[]
  while(queue.length){
   const current=queue.shift()
   if(current.depth>=maxDepth)continue
   for(const item of neighbors(current.ref)){
    if(relationTypes.length&&!relationTypes.includes(item.relation.relationType))continue
    const key=refKey(item.node.ref)
    result.push({...item,depth:current.depth+1})
    if(!visited.has(key)){visited.add(key);queue.push({ref:item.node.ref,depth:current.depth+1})}
   }
  }
  return result
 }

 function findPath(from,to,{maxDepth=6,relationTypes=[]}={}){
  const targetKey=refKey(to),queue=[{ref:objectRef(from),path:[]}],visited=new Set([refKey(from)])
  while(queue.length){
   const current=queue.shift()
   if(current.path.length>=maxDepth)continue
   for(const item of neighbors(current.ref)){
    if(relationTypes.length&&!relationTypes.includes(item.relation.relationType))continue
    const nextPath=[...current.path,item]
    const key=refKey(item.node.ref)
    if(key===targetKey)return nextPath
    if(!visited.has(key)){visited.add(key);queue.push({ref:item.node.ref,path:nextPath})}
   }
  }
  return[]
 }

 function snapshot({organizationId=null}={}){
  const nodeList=[...nodes.values()].filter(node=>!organizationId||node.ref.organizationId===organizationId)
  const allowed=new Set(nodeList.map(node=>node.id))
  return freeze({
   generatedAt:new Date().toISOString(),
   nodes:freeze(nodeList),
   relations:freeze([...relations.values()].filter(relation=>allowed.has(refKey(relation.from))&&allowed.has(refKey(relation.to))))
  })
 }

 function clear(){nodes.clear();relations.clear()}
 return freeze({upsertNode,connect,disconnect,getNode,neighbors,traverse,findPath,snapshot,clear})
}

export function passportRelationships(graph,passport,{maxDepth=1,relationTypes=[]}={}){
 if(!passport?.object)throw new Error('Se requiere un Passport válido')
 const ref=objectRef(passport.object)
 return graph.traverse(ref,{maxDepth,relationTypes}).map(item=>freeze({
  relationId:item.relation.id,
  relationType:item.relation.relationType,
  direction:item.direction,
  depth:item.depth,
  object:item.node?.ref||null,
  label:item.node?.label||''
 }))
}
