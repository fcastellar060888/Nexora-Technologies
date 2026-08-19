import {createContext,useCallback,useContext,useEffect,useMemo,useReducer,useRef,useState} from'react'
import{loadState,saveState}from'./safeStorage'
import{collectionChanges,enqueueChanges}from'./syncEngine'
import{runIncrementalSync}from'./syncTransport.js'
import{commitIncrementalSyncResult}from'./syncCommit.js'
import{AUTO_SYNC_INTERVAL_MS,runtimeState,shouldAutoSync}from'./autoSyncRuntime.js'
import{createTabSyncCoordinator}from'./tabSyncCoordinator.js'
import{appendHealthEvent}from'./syncHealth.js'
import{loadOrganizationDeviceHealth,normalizeRemoteDeviceHealth,reportDeviceHealth}from'./syncDeviceHealth.js'
import{bootstrapOrganization}from'./remoteBootstrap.js'

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
 if(action.type==='HYDRATE')return action.state
 if(action.type!=='UPDATE')return prev
 const candidate=typeof action.recipe==='function'?action.recipe(prev):action.recipe
 if(!candidate||typeof candidate!=='object')throw new Error('La actualización del store debe devolver un estado válido')

 const changed=changedCollections(prev,candidate)
 const actorUser=(candidate.users||[]).find(u=>u.activeSession)
 const companyId=candidate.currentContext?.companyId||''
 const siteId=candidate.currentContext?.siteId||''
 const auditableCollections=changed.filter(k=>!['auditLog','syncQueue','syncConflicts','syncHealthEvents','syncDeviceHealth'].includes(k))
 const shouldAudit=action.meta.audit!==false&&auditableCollections.length>0
 if(shouldAudit&&!companyId)throw new Error('No se puede registrar auditoría sin empresa activa inequívoca')

 const auditEntry=shouldAudit?{
  id:action.audit.id,
  organizationId:companyId,
  siteId:siteId||null,
  createdAt:action.audit.createdAt,
  actor:actorUser?.name||'Usuario local',
  actorId:actorUser?.remoteId||actorUser?.id||'',
  action:action.meta.action||'Actualización de datos',
  module:action.meta.module||auditableCollections.join(', ')||'Sistema',
  detail:action.meta.detail||'',
  collections:auditableCollections
 }:null
 const auditedCandidate=auditEntry?{...candidate,auditLog:[...(candidate.auditLog||[]),auditEntry]}:candidate
 const domainChanges=action.meta.sync===false?[]:collectionChanges(prev,candidate)
 const auditChanges=auditEntry?collectionChanges(prev,auditedCandidate,['auditLog']):[]
 const changes=[...domainChanges,...auditChanges]
 return enqueueChanges(auditedCandidate,changes,{companyId,userId:actorUser?.remoteId||actorUser?.id||'',deviceId:deviceId()})
}

export function StoreProvider({children}){
 const[state,dispatch]=useReducer(reducer,undefined,loadState)
 const stateRef=useRef(state)
 const lockRef=useRef(false)
 const bootstrapLockRef=useRef(false)
 const hydratedCompanyRef=useRef('')
 const coordinatorRef=useRef(null)
 const[runtime,setRuntime]=useState(()=>runtimeState())
 const[dataRuntime,setDataRuntime]=useState(()=>({status:'cache',source:'local-cache',companyId:'',loadedAt:'',recordCount:0,lastError:''}))
 const runtimeRef=useRef(runtime)

 useEffect(()=>{
  stateRef.current=state
  saveState(state)
 },[state])
 useEffect(()=>{runtimeRef.current=runtime},[runtime])

 const update=useCallback((recipe,meta={})=>{
  dispatch({type:'UPDATE',recipe,meta,audit:{id:crypto.randomUUID(),createdAt:new Date().toISOString()}})
 },[])

 const hydrateFromPostgres=useCallback(async(companyId=stateRef.current.currentContext?.companyId,{force=false}={})=>{
  if(!companyId)return{skipped:true,reason:'missing-company'}
  if(bootstrapLockRef.current)return{skipped:true,reason:'already-loading'}
  if(!force&&hydratedCompanyRef.current===companyId)return{skipped:true,reason:'already-hydrated'}
  if(typeof navigator!=='undefined'&&navigator.onLine===false){
   setDataRuntime(value=>({...value,status:'offline',source:'local-cache',companyId,lastError:''}))
   return{skipped:true,reason:'offline'}
  }
  const hasRemoteIdentity=(stateRef.current.users||[]).some(user=>user.activeSession&&(user.remoteId||user.authUserId))
  if(!hasRemoteIdentity)return{skipped:true,reason:'missing-remote-session'}

  bootstrapLockRef.current=true
  setDataRuntime(value=>({...value,status:'loading',companyId,lastError:''}))
  try{
   const initialState=stateRef.current
   const result=await bootstrapOrganization(initialState,companyId,{getCurrentState:()=>stateRef.current})
   if(result.skipped){
    setDataRuntime(value=>({...value,status:'cache',source:'local-cache',companyId}))
    return result
   }
   hydratedCompanyRef.current=companyId
   stateRef.current=result.state
   dispatch({type:'HYDRATE',state:result.state})
   setDataRuntime({status:'ready',source:'postgres',companyId,loadedAt:new Date().toISOString(),recordCount:result.count,lastError:''})
   return result
  }catch(error){
   const message=error instanceof Error?error.message:'No fue posible cargar PostgreSQL'
   setDataRuntime(value=>({...value,status:'error',source:'local-cache',companyId,lastError:message}))
   return{skipped:false,error}
  }finally{
   bootstrapLockRef.current=false
  }
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
  coordinatorRef.current?.broadcast('sync-started',{companyId,reason})
  try{
   const result=await runIncrementalSync(current)
   if(stateRef.current.currentContext?.companyId!==companyId){
    setRuntime(value=>({...value,running:false,status:'idle',reason:'stale-company-context',lastError:''}))
    return{...result,state:stateRef.current,skipped:true,reason:'stale-company-context'}
   }
   const completedAt=new Date().toISOString()
   let next=result.state
   if(!result.skipped){
    next=commitIncrementalSyncResult(current,stateRef.current,next)
    const healthPayload={companyId,deviceId:currentDeviceId,status:'success',reason,durationMs:Date.now()-started,pushed:result.pushed||0,pulled:result.pulled||0}
    next=appendHealthEvent(next,healthPayload)
    try{
     await reportDeviceHealth(healthPayload)
     next={...next,syncDeviceHealth:normalizeRemoteDeviceHealth(await loadOrganizationDeviceHealth(companyId))}
    }catch{/* La sincronización operativa no falla por telemetría. */}
    if(stateRef.current.currentContext?.companyId!==companyId){
     setRuntime(value=>({...value,running:false,status:'idle',reason:'stale-company-context',lastError:''}))
     return{...result,state:stateRef.current,skipped:true,reason:'stale-company-context'}
    }
    const committed=next
    update(prev=>commitIncrementalSyncResult(current,prev,committed),{sync:false,audit:false})
   }
   setRuntime(value=>({...value,running:false,status:result.skipped?'idle':'success',lastSuccessAt:result.skipped?value.lastSuccessAt:completedAt,lastError:''}))
   coordinatorRef.current?.broadcast('sync-result',{companyId,completedAt,shared:{syncQueue:next.syncQueue,syncConflicts:next.syncConflicts,syncMeta:next.syncMeta,syncHealthEvents:next.syncHealthEvents,syncDeviceHealth:next.syncDeviceHealth}})
   return{...result,state:next}
  }catch(error){
   if(stateRef.current.currentContext?.companyId!==companyId){
    setRuntime(value=>({...value,running:false,status:'idle',reason:'stale-company-context',lastError:''}))
    return{skipped:true,reason:'stale-company-context',error}
   }
   const message=error instanceof Error?error.message:'Error de sincronización'
   const healthPayload={companyId,deviceId:currentDeviceId,status:'error',reason,durationMs:Date.now()-started,error:message}
   let failed=appendHealthEvent(stateRef.current,healthPayload)
   try{
    await reportDeviceHealth(healthPayload)
    failed={...failed,syncDeviceHealth:normalizeRemoteDeviceHealth(await loadOrganizationDeviceHealth(companyId))}
   }catch{/* Conserva el error operativo original. */}
   if(stateRef.current.currentContext?.companyId!==companyId){
    setRuntime(value=>({...value,running:false,status:'idle',reason:'stale-company-context',lastError:''}))
    return{skipped:true,reason:'stale-company-context',error}
   }
   update(failed,{sync:false,audit:false})
   setRuntime(value=>({...value,running:false,status:'error',lastError:message}))
   coordinatorRef.current?.broadcast('sync-result',{companyId,completedAt:new Date().toISOString(),error:message,shared:{syncHealthEvents:failed.syncHealthEvents,syncDeviceHealth:failed.syncDeviceHealth}})
   return{skipped:false,error}
  }finally{
   lockRef.current=false
   coordinatorRef.current?.release()
  }
 },[update])

 const selectedCompanyId=state.currentContext?.companyId||''
 useEffect(()=>{
  if(!selectedCompanyId)return
  const timer=window.setTimeout(()=>hydrateFromPostgres(selectedCompanyId),350)
  return()=>window.clearTimeout(timer)
 },[selectedCompanyId,hydrateFromPostgres])

 useEffect(()=>{
  const online=async()=>{
   setRuntime(value=>({...value,online:true,lastError:''}))
   await hydrateFromPostgres(stateRef.current.currentContext?.companyId,{force:true})
   synchronize('connection-restored')
  }
  const offline=()=>{
   setRuntime(value=>({...value,online:false,status:'offline',running:false}))
   setDataRuntime(value=>({...value,status:'offline',source:'local-cache'}))
  }
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
 },[synchronize,hydrateFromPostgres])

 const value=useMemo(()=>({state,update,synchronize,syncRuntime:runtime,dataRuntime,hydrateFromPostgres}),[state,update,synchronize,runtime,dataRuntime,hydrateFromPostgres])
 return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(){
 const ctx=useContext(StoreContext)
 if(!ctx)throw new Error('useStore requiere StoreProvider')
 return ctx
}
