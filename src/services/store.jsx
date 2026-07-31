import {createContext,useContext,useEffect,useMemo,useReducer} from'react'
import{loadState,saveState}from'./safeStorage'

const StoreContext=createContext(null)

function serialize(value){
 try{return JSON.stringify(value)}catch{return String(value)}
}

function changedCollections(prev,next){
 const keys=new Set([
  ...Object.keys(prev||{}).filter(k=>Array.isArray(prev?.[k])),
  ...Object.keys(next||{}).filter(k=>Array.isArray(next?.[k]))
 ])
 return[...keys].filter(k=>serialize(prev?.[k]||[])!==serialize(next?.[k]||[]))
}

function reducer(prev,action){
 if(action.type!=='UPDATE')return prev
 const next=typeof action.recipe==='function'?action.recipe(prev):action.recipe
 if(!next||typeof next!=='object')throw new Error('La actualización del store debe devolver un estado válido')

 const changed=changedCollections(prev,next)
 const shouldAudit=action.meta.audit!==false&&changed.some(k=>k!=='auditLog')
 if(!shouldAudit)return next

 const actor=(next.users||[]).find(u=>u.activeSession)?.name||'Usuario local'
 return{
  ...next,
  auditLog:[...(next.auditLog||[]),{
   id:action.audit.id,
   createdAt:action.audit.createdAt,
   actor,
   action:action.meta.action||'Actualización de datos',
   module:action.meta.module||changed.filter(k=>k!=='auditLog').join(', ')||'Sistema',
   detail:action.meta.detail||'',
   collections:changed.filter(k=>k!=='auditLog')
  }]
 }
}

export function StoreProvider({children}){
 const[state,dispatch]=useReducer(reducer,undefined,loadState)

 useEffect(()=>{
  saveState(state)
 },[state])

 function update(recipe,meta={}){
  dispatch({
   type:'UPDATE',
   recipe,
   meta,
   audit:{id:crypto.randomUUID(),createdAt:new Date().toISOString()}
  })
 }

 const value=useMemo(()=>({state,update}),[state])
 return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(){
 const ctx=useContext(StoreContext)
 if(!ctx)throw new Error('useStore requiere StoreProvider')
 return ctx
}
