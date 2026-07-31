import {createContext,useCallback,useContext,useEffect,useMemo,useReducer,useRef,useState} from'react'
import{loadState,saveState}from'./safeStorage'
import{collectionChanges,enqueueChanges}from'./syncEngine'
import{runIncrementalSync}from'./syncTransport.js'
import{AUTO_SYNC_INTERVAL_MS,runtimeState,shouldAutoSync}from'./autoSyncRuntime.js'
import{createTabSyncCoordinator}from'./tabSyncCoordinator.js'
import{appendHealthEvent}from'./syncHealth.js'
import{loadOrganizationDeviceHealth,normalizeRemoteDeviceHealth,reportDeviceHealth}from'./syncDeviceHealth.js'

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

 const shouldAudit=action.meta.audit!==false&&changed.some(k=>!['auditLog','syncQueue','syncConflicts','syncHealthEvents','syncDeviceHealth'].includes(k))
 if(!shouldAudit)return next

 return{
  ...next,
  auditLog:[...(next.auditLog||[]),{
   id:action.audit.id,
   createdAt:action.audit.createdAt,
   actor:actorUser?.name||'Usuario local',
   action:action.meta.action||'Actualización de datos',
   module:action.meta.module||changed.filter(k=>!['auditLog','syncQueue','syncConflicts','syncHealthEvents','syncDeviceHealth'].includes(k)).join(', ')||'Sistema',
   detail:action.meta.detail||'',
   collections:changed.filter(k=>!['auditLog','syncQueue','syncConflicts','syncHealthEvents','syncDeviceHealth'].includes(k))
  }]
 }
}

export function StoreProvider({children}){
 const[state,dispatch]=useReducer(reducer,undefined,loadState)
 const stateRef=useRef(state)
 const lockRef=useRef(false)
 const coordinatorRef=useRef(null)
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

 useEffect(()=>{
  const coordinator=createTabSyncCoordinator({onMessage:message=>{
   if(message.type==='sync-started')setRuntime(value=>({...value,running:true,status:'syncing',reason:'other-tab'}))
   if(message.type==='sync-result'){
    setRuntime(value=>({...value,running:false,status:message.error?'error':'success',lastSuccessAt:message.error?value.lastSuccessAt:message.completedAt,lastError:message.error||''}))
    if(message.shared)update(prev=>({...prev,...message.shared}),{sync:false,audit:false})
   }
  }})
  coordinatorRef.current=coordinator
  return()=>{coordinator.destroy();coordinatorRef.current=null}
 },[update])

 const synchronize=useCallback(async(reason='manual',{force=false}={})=>{
  if(lockRef.current)return{skipped:true,reason:'already-running'}
  const current=stateRef.current
  const online=typeof navigator==='undefined'||navigator.onLine!==false
  const visible=typeof document==='undefined'||document.visibilityState==='visible'
  if(!force&&!shouldAutoSync({state:current,online,visible,running:false,lastAttemptAt:runtimeRef.current.lastAttemptAt}))return{skipped:true,reason:'not-eligible'}
  if(!online){setRuntime(value=>({...value,online:false,status:'offline',reason,lastError:''}));return{skipped:true,reason:'offline'}}
  if(coordinatorRef.current&&!coordinatorRef.current.acquire())return{skipped:true,reason:'other-tab-leader'}

  lockRef.current=true
  const started=Date.now()
  const attemptedAt=new Date(started).toISOString()
  const companyId=current.currentContext?.companyId||''
  const currentDeviceId=deviceId()
  setRuntime(value=>({...value,online:true,running:true,status:'syncing',reason,lastAttemptAt:attemptedAt,lastError:''}))
  coordinatorRef.current?.broadcast('sync-started',{reason})
  try{
   const result=await runIncrementalSync(current)
   const completedAt=new Date().toISOString()
   let next=result.state
   if(!result.skipped){
    const healthPayload={companyId,deviceId:currentDeviceId,status:'success',reason,durationMs:Date.now()-started,pushed:result.pushed||0,pulled:result.pulled||0}
    next=appendHealthEvent(next,healthPayload)
    try{
     await reportDeviceHealth(healthPayload)
     next={...next,syncDeviceHealth:normalizeRemoteDeviceHealth(await loadOrganizationDeviceHealth(companyId))}
    }catch{/* La sincronización operativa no falla por telemetría. */}
    update(next,{sync:false,audit:false})
   }
   setRuntime(value=>({...value,running:false,status:result.skipped?'idle':'success',lastSuccessAt:result.skipped?value.lastSuccessAt:completedAt,lastError:''}))
   coordinatorRef.current?.broadcast('sync-result',{completedAt,shared:{syncQueue:next.syncQueue,syncConflicts:next.syncConflicts,syncMeta:next.syncMeta,syncHealthEvents:next.syncHealthEvents,syncDeviceHealth:next.syncDeviceHealth}})
   return{...result,state:next}
  }catch(error){
   const message=error instanceof Error?error.message:'Error de sincronización'
   const healthPayload={companyId,deviceId:currentDeviceId,status:'error',reason,durationMs:Date.now()-started,error:message}
   let failed=appendHealthEvent(stateRef.current,healthPayload)
   try{
    await reportDeviceHealth(healthPayload)
    failed={...failed,syncDeviceHealth:normalizeRemoteDeviceHealth(await loadOrganizationDeviceHealth(companyId))}
   }catch{/* Conserva el error operativo original. */}
   update(failed,{sync:false,audit:false})
   setRuntime(value=>({...value,running:false,status:'error',lastError:message}))
   coordinatorRef.current?.broadcast('sync-result',{completedAt:new Date().toISOString(),error:message,shared:{syncHealthEvents:failed.syncHealthEvents,syncDeviceHealth:failed.syncDeviceHealth}})
   return{skipped:false,error}
  }finally{
   lockRef.current=false
   coordinatorRef.current?.release()
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
