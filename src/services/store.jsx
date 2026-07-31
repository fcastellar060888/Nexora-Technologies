import {createContext,useCallback,useContext,useEffect,useMemo,useReducer,useRef,useState} from'react'
import{loadState,saveState}from'./safeStorage'
import{collectionChanges,enqueueChanges}from'./syncEngine'
import{runIncrementalSync}from'./syncTransport.js'
import{AUTO_SYNC_INTERVAL_MS,runtimeState,shouldAutoSync}from'./autoSyncRuntime.js'

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
 const stateRef=useRef(state)
 const lockRef=useRef(false)
 const[runtime,setRuntime]=useState(()=>runtimeState())
 const runtimeRef=useRef(runtime)

 useEffect(()=>{
  stateRef.current=state
  saveState(state)
 },[state])

 useEffect(()=>{runtimeRef.current=runtime},[runtime])

 const update=useCallback((recipe,meta={})=>{
  dispatch({type:'UPDATE',recipe,meta,audit:{id:crypto.randomUUID(),createdAt:new Date().toISOString()}})
 },[])

 const synchronize=useCallback(async(reason='manual',{force=false}={})=>{
  if(lockRef.current)return{skipped:true,reason:'already-running'}
  const current=stateRef.current
  const online=typeof navigator==='undefined'||navigator.onLine!==false
  const visible=typeof document==='undefined'||document.visibilityState==='visible'
  if(!force&&!shouldAutoSync({state:current,online,visible,running:false,lastAttemptAt:runtimeRef.current.lastAttemptAt}))return{skipped:true,reason:'not-eligible'}
  if(!online){setRuntime(value=>({...value,online:false,status:'offline',reason,lastError:''}));return{skipped:true,reason:'offline'}}

  lockRef.current=true
  const attemptedAt=new Date().toISOString()
  setRuntime(value=>({...value,online:true,running:true,status:'syncing',reason,lastAttemptAt:attemptedAt,lastError:''}))
  try{
   const result=await runIncrementalSync(current)
   if(!result.skipped)update(result.state,{sync:false,audit:false})
   const completedAt=new Date().toISOString()
   setRuntime(value=>({...value,running:false,status:result.skipped?'idle':'success',lastSuccessAt:result.skipped?value.lastSuccessAt:completedAt,lastError:''}))
   return result
  }catch(error){
   const message=error instanceof Error?error.message:'Error de sincronización'
   setRuntime(value=>({...value,running:false,status:'error',lastError:message}))
   return{skipped:false,error}
  }finally{
   lockRef.current=false
  }
 },[update])

 useEffect(()=>{
  const online=()=>{setRuntime(value=>({...value,online:true,lastError:''}));synchronize('connection-restored')}
  const offline=()=>setRuntime(value=>({...value,online:false,status:'offline',running:false}))
  const visibility=()=>{if(document.visibilityState==='visible')synchronize('app-visible')}
  window.addEventListener('online',online)
  window.addEventListener('offline',offline)
  document.addEventListener('visibilitychange',visibility)
  const timer=window.setInterval(()=>synchronize('interval'),AUTO_SYNC_INTERVAL_MS)
  const initial=window.setTimeout(()=>synchronize('startup'),1500)
  return()=>{
   window.removeEventListener('online',online)
   window.removeEventListener('offline',offline)
   document.removeEventListener('visibilitychange',visibility)
   window.clearInterval(timer)
   window.clearTimeout(initial)
  }
 },[synchronize])

 const value=useMemo(()=>({state,update,synchronize,syncRuntime:runtime}),[state,update,synchronize,runtime])
 return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(){
 const ctx=useContext(StoreContext)
 if(!ctx)throw new Error('useStore requiere StoreProvider')
 return ctx
}
