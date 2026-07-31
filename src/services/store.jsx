import {createContext,useContext,useEffect,useMemo,useReducer} from'react'
import{loadState,saveState}from'./safeStorage'
import{collectionChanges,enqueueChanges}from'./syncEngine'

const StoreContext=createContext(null)
const DEVICE_KEY='cannapa_device_id'

function deviceId(){
 let id=localStorage.getItem(DEVICE_KEY)
 if(!id){id=crypto.randomUUID();localStorage.setItem(DEVICE_KEY,id)}
 return id
}

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
 const candidate=typeof action.recipe==='function'?action.recipe(prev):action.recipe
 if(!candidate||typeof candidate!=='object')throw new Error('La actualización del store debe devolver un estado válido')

 const changed=changedCollections(prev,candidate)
 const actorUser=(candidate.users||[]).find(u=>u.activeSession)
 const companyId=candidate.currentContext?.companyId||''
 const changes=action.meta.sync===false?[]:collectionChanges(prev,candidate)
 let next=enqueueChanges(candidate,changes,{companyId,userId:actorUser?.remoteId||actorUser?.id||'',deviceId:deviceId()})

 const shouldAudit=action.meta.audit!==false&&changed.some(k=>!['auditLog','syncQueue','syncConflicts'].includes(k))
 if(!shouldAudit)return next

 return{
  ...next,
  auditLog:[...(next.auditLog||[]),{
   id:action.audit.id,
   createdAt:action.audit.createdAt,
   actor:actorUser?.name||'Usuario local',
   action:action.meta.action||'Actualización de datos',
   module:action.meta.module||changed.filter(k=>!['auditLog','syncQueue','syncConflicts'].includes(k)).join(', ')||'Sistema',
   detail:action.meta.detail||'',
   collections:changed.filter(k=>!['auditLog','syncQueue','syncConflicts'].includes(k))
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
