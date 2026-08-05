import{createKnowledgeGraphRepository}from'./graphRepository.js'

export const MAX_KNOWLEDGE_GRAPH_SCOPES=256
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

function entryFor(scope,{create=true}={}){
 const key=knowledgeGraphRuntimeKey(scope)
 let entry=repositories.get(key)
 if(!entry&&create){
  if(repositories.size>=MAX_KNOWLEDGE_GRAPH_SCOPES)throw new Error(`Capacidad del runtime de Knowledge Graph agotada (${MAX_KNOWLEDGE_GRAPH_SCOPES} scopes)`)
  entry={repository:createKnowledgeGraphRepository(),retainers:0,releaseToken:null}
  repositories.set(key,entry)
 }
 return{key,entry}
}

export function getKnowledgeGraphForScope(scope){return entryFor(scope).entry.repository}

export function retainKnowledgeGraphScope(scope){
 const{entry}=entryFor(scope)
 entry.retainers+=1
 entry.releaseToken=null
 return entry.repository
}

export function releaseRetainedKnowledgeGraphScope(scope){
 const{key,entry}=entryFor(scope,{create:false})
 if(!entry)return false
 if(entry.retainers>0)entry.retainers-=1
 if(entry.retainers>0)return false
 const token={};entry.releaseToken=token
 queueMicrotask(()=>{
  const current=repositories.get(key)
  if(current!==entry||current.releaseToken!==token||current.retainers>0)return
  current.repository.clear();repositories.delete(key)
 })
 return true
}

export function releaseKnowledgeGraphScope(scope){
 const{key,entry}=entryFor(scope,{create:false})
 if(!entry)return false
 entry.releaseToken=null
 entry.repository.clear()
 repositories.delete(key)
 return true
}

export function knowledgeGraphScopeCount(){return repositories.size}

export function knowledgeGraphRuntimeHealth(){
 const activeScopes=repositories.size
 return Object.freeze({activeScopes,capacity:MAX_KNOWLEDGE_GRAPH_SCOPES,saturated:activeScopes>=MAX_KNOWLEDGE_GRAPH_SCOPES})
}

export function clearKnowledgeGraphRuntimes(){
 for(const entry of repositories.values()){entry.releaseToken=null;entry.repository.clear()}
 repositories.clear()
}
