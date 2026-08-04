import{createKnowledgeGraphRepository}from'./graphRepository.js'

const repositories=new Map()

function scopePart(value,label){
 if(value===null||value===undefined||value==='')throw new Error(`${label} es obligatorio para resolver el Knowledge Graph`)
 if(typeof value!=='string')throw new Error(`${label} debe ser texto para resolver el Knowledge Graph`)
 const normalized=value.trim()
 if(!normalized)throw new Error(`${label} es obligatorio para resolver el Knowledge Graph`)
 return normalized
}

export function knowledgeGraphRuntimeKey({organizationId,actorId='system'}={}){
 const organization=scopePart(organizationId,'La empresa')
 const actor=scopePart(actorId,'El actor')
 return JSON.stringify([organization,actor])
}

export function getKnowledgeGraphForScope(scope){
 const key=knowledgeGraphRuntimeKey(scope)
 if(!repositories.has(key))repositories.set(key,createKnowledgeGraphRepository())
 return repositories.get(key)
}

export function releaseKnowledgeGraphScope(scope){
 const key=knowledgeGraphRuntimeKey(scope),repository=repositories.get(key)
 if(!repository)return false
 repository.clear()
 repositories.delete(key)
 return true
}

export function knowledgeGraphScopeCount(){return repositories.size}

export function clearKnowledgeGraphRuntimes(){
 for(const repository of repositories.values())repository.clear()
 repositories.clear()
}
