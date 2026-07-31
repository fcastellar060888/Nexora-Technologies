import {createContext,useContext,useMemo,useState} from'react'
import{loadState,saveState}from'./storage'
const StoreContext=createContext(null)

function changedCollections(prev,next){
 const keys=Object.keys(next).filter(k=>Array.isArray(next[k]))
 return keys.filter(k=>(prev[k]?.length||0)!==(next[k]?.length||0))
}

export function StoreProvider({children}){
 const[state,setState]=useState(loadState)
 function update(recipe,meta={}){
  setState(prev=>{
   const next=typeof recipe==='function'?recipe(prev):recipe
   const changed=changedCollections(prev,next)
   const actor=next.users.find(u=>u.activeSession)?.name||'Usuario local'
   const shouldAudit=meta.audit!==false && changed.some(k=>k!=='auditLog')
   const audited=shouldAudit?{
    ...next,
    auditLog:[...(next.auditLog||[]),{
      id:crypto.randomUUID(),createdAt:new Date().toISOString(),actor,
      action:meta.action||'Actualización de datos',
      module:meta.module||changed.join(', ')||'Sistema',
      detail:meta.detail||''
    }]
   }:next
   saveState(audited);return audited
  })
 }
 const value=useMemo(()=>({state,update}),[state])
 return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}
export function useStore(){const ctx=useContext(StoreContext);if(!ctx)throw new Error('useStore requiere StoreProvider');return ctx}
