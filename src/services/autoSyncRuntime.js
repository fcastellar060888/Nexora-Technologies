export const AUTO_SYNC_INTERVAL_MS=60000
export const MIN_SYNC_GAP_MS=15000

const list=value=>Array.isArray(value)?value:[]

export function hasPendingWork(state){
 return list(state?.syncQueue).some(item=>item.status==='pending'||item.status==='failed')
}

export function hasRemoteSessionIdentity(state){
 return list(state?.users).some(user=>user.activeSession&&(user.remoteId||user.authUserId))
}

export function shouldAutoSync({state,online=true,visible=true,running=false,lastAttemptAt='',now=Date.now()}={}){
 if(!online||!visible||running)return false
 if(!state?.currentContext?.companyId||!hasRemoteSessionIdentity(state))return false
 if(!hasPendingWork(state)&&state?.syncMeta?.lastSyncedAt)return false
 const previous=Date.parse(lastAttemptAt||0)||0
 return now-previous>=MIN_SYNC_GAP_MS
}

export function runtimeState(overrides={}){
 return{
  status:'idle',
  online:typeof navigator==='undefined'?true:navigator.onLine!==false,
  running:false,
  reason:'',
  lastAttemptAt:'',
  lastSuccessAt:'',
  lastError:'',
  ...overrides
 }
}

export function statusLabel(runtime,state){
 if(runtime?.running)return'Sincronizando'
 if(runtime?.online===false)return'Sin conexión'
 if(runtime?.lastError)return'Error de sincronización'
 const pending=list(state?.syncQueue).filter(item=>item.status==='pending'||item.status==='failed').length
 const conflicts=list(state?.syncConflicts).filter(item=>item.status!=='resolved').length
 if(conflicts)return`${conflicts} conflicto${conflicts===1?'':'s'}`
 if(pending)return`${pending} pendiente${pending===1?'':'s'}`
 if(runtime?.lastSuccessAt||state?.syncMeta?.lastSyncedAt)return'Al día'
 return'Sin sincronizar'
}
