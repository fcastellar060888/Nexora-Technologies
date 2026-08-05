import{createContext,useContext,useEffect,useMemo}from'react'
import{useStore}from'../../services/store.jsx'
import{getKnowledgeGraphForScope,knowledgeGraphRuntimeKey,retainKnowledgeGraphScope,releaseRetainedKnowledgeGraphScope}from'./graphRuntime.js'

const KnowledgeGraphRuntimeContext=createContext(null)

function activeScope(state){
 const user=(state.users||[]).find(item=>item.activeSession)
 return{
  organizationId:state.currentContext?.companyId||'local-installation',
  actorId:user?.remoteId||user?.id||'system'
 }
}

export default function KnowledgeGraphRuntimeProvider({children}){
 const{state}=useStore()
 const scope=activeScope(state)
 const key=knowledgeGraphRuntimeKey(scope)
 const value=useMemo(()=>Object.freeze({scope:Object.freeze({...scope}),key,repository:getKnowledgeGraphForScope(scope)}),[key])
 useEffect(()=>{
  retainKnowledgeGraphScope(scope)
  return()=>releaseRetainedKnowledgeGraphScope(scope)
 },[key])
 return <KnowledgeGraphRuntimeContext.Provider value={value}>{children}</KnowledgeGraphRuntimeContext.Provider>
}

export function useKnowledgeGraphRuntime(){
 const value=useContext(KnowledgeGraphRuntimeContext)
 if(!value)throw new Error('useKnowledgeGraphRuntime requiere KnowledgeGraphRuntimeProvider')
 return value
}
