import{createKnowledgeGraphRepository}from'./graphRepository.js'

const repositories=new Map()

function scopePart(value,label){
 const normalized=String(value??'').trim()
 if(!normalized)throw new Error(`${label} es obligatorio para resolver el Knowledge Graph`)
 return normalized
}

export function knowledgeGraphRuntimeKey({organizationId,actorId='system'}={}){
 return`${scopePart(organizationId,'La empresa')}::${scopePart(actorId,'El actor')}`
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
