const TYPE_PATTERN=/^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/
const RELATION_PATTERN=/^[a-z][a-z0-9_]*$/

function text(value){return String(value??'').trim()}
function iso(value,field,{nullable=false}={}){
 if((value===null||value===undefined||value==='')&&nullable)return null
 const date=new Date(value)
 if(Number.isNaN(date.getTime()))throw new Error(`${field} debe ser una fecha válida`)
 return date.toISOString()
}
function serializable(value,field){
 try{return structuredClone(value??{})}catch{throw new Error(`${field} debe ser serializable`)}
}
function deepFreeze(value){
 if(!value||typeof value!=='object'||Object.isFrozen(value))return value
 for(const nested of Object.values(value))deepFreeze(nested)
 return Object.freeze(value)
}
function canonicalType(value,field,pattern=TYPE_PATTERN){
 const normalized=text(value)
 if(!pattern.test(normalized))throw new Error(`${field} debe usar nomenclatura canónica`)
 return normalized
}

export function createGraphNode({nodeId,nodeType,organizationId,siteId=null,label,status='active',createdAt=new Date().toISOString(),updatedAt=createdAt,metadata={}}={}){
 const id=text(nodeId),organization=text(organizationId),normalizedLabel=text(label)
 if(!id)throw new Error('El nodo requiere nodeId')
 if(!organization)throw new Error('El nodo requiere organizationId')
 if(!normalizedLabel)throw new Error('El nodo requiere label')
 const created=iso(createdAt,'createdAt'),updated=iso(updatedAt,'updatedAt')
 if(Date.parse(updated)<Date.parse(created))throw new Error('updatedAt no puede ser anterior a createdAt')
 return deepFreeze({nodeId:id,nodeType:canonicalType(nodeType,'nodeType'),organizationId:organization,siteId:text(siteId)||null,label:normalizedLabel,status:text(status)||'active',createdAt:created,updatedAt:updated,metadata:serializable(metadata,'metadata')})
}

export function isGraphNode(value){
 try{
  if(!value||typeof value!=='object'||Array.isArray(value))return false
  const required=['nodeId','nodeType','organizationId','label','status','createdAt','updatedAt','metadata']
  if(required.some(key=>!Object.hasOwn(value,key)))return false
  createGraphNode(value)
  return true
 }catch{return false}
}

export function createGraphEdge({edgeId,relationType,sourceNodeId,targetNodeId,organizationId,source='system',confidence=1,validFrom=new Date().toISOString(),validTo=null,createdAt=validFrom,metadata={}}={}){
 const id=text(edgeId),sourceId=text(sourceNodeId),targetId=text(targetNodeId),organization=text(organizationId)
 if(!id)throw new Error('La arista requiere edgeId')
 if(!sourceId||!targetId)throw new Error('La arista requiere nodos de origen y destino')
 if(sourceId===targetId)throw new Error('La arista no puede relacionar un nodo consigo mismo')
 if(!organization)throw new Error('La arista requiere organizationId')
 const normalizedConfidence=Number(confidence)
 if(!Number.isFinite(normalizedConfidence)||normalizedConfidence<0||normalizedConfidence>1)throw new Error('confidence debe estar entre 0 y 1')
 const from=iso(validFrom,'validFrom'),to=iso(validTo,'validTo',{nullable:true}),created=iso(createdAt,'createdAt')
 if(to&&Date.parse(to)<Date.parse(from))throw new Error('validTo no puede ser anterior a validFrom')
 return deepFreeze({edgeId:id,relationType:canonicalType(relationType,'relationType',RELATION_PATTERN),sourceNodeId:sourceId,targetNodeId:targetId,organizationId:organization,source:text(source)||'system',confidence:normalizedConfidence,validFrom:from,validTo:to,createdAt:created,metadata:serializable(metadata,'metadata')})
}

export function isGraphEdge(value){
 try{
  if(!value||typeof value!=='object'||Array.isArray(value))return false
  const required=['edgeId','relationType','sourceNodeId','targetNodeId','organizationId','source','confidence','validFrom','validTo','createdAt','metadata']
  if(required.some(key=>!Object.hasOwn(value,key)))return false
  createGraphEdge(value)
  return true
 }catch{return false}
}
