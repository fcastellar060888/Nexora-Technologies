import{authenticatedRequest,supabaseEnabled}from'./supabase.js'
import{applyRemoteRecords}from'./syncEngine.js'

const now=()=>new Date().toISOString()
const list=value=>Array.isArray(value)?value:[]

export function retryMutation(state,mutationId){
 return{
  ...state,
  syncQueue:list(state.syncQueue).map(item=>item.id===mutationId?{
   ...item,status:'pending',attempts:0,error:'',nextAttemptAt:'',updatedAt:now()
  }:item)
 }
}

export function retryAllFailed(state,companyId=''){
 return{
  ...state,
  syncQueue:list(state.syncQueue).map(item=>
   item.status==='failed'&&(!companyId||item.companyId===companyId)
    ?{...item,status:'pending',attempts:0,error:'',nextAttemptAt:'',updatedAt:now()}
    :item
  )
 }
}

export function conflictRecord(conflict,strategy,mergedPayload){
 if(strategy==='local')return conflict.localPayload||null
 if(strategy==='merged')return mergedPayload||conflict.localPayload||conflict.remotePayload||null
 return conflict.remotePayload||null
}

export function applyConflictResolution(state,conflictId,{strategy='remote',mergedPayload=null,resolvedBy=''}={}){
 const conflict=list(state.syncConflicts).find(item=>item.id===conflictId)
 if(!conflict)throw new Error('Conflicto no encontrado')
 const companyId=conflict.companyId||state.currentContext?.companyId||''
 if(!companyId)throw new Error('El conflicto no tiene empresa asociada')
 if(state.currentContext?.companyId&&state.currentContext.companyId!==companyId)throw new Error('El conflicto pertenece a otra empresa')
 const record=conflictRecord(conflict,strategy,mergedPayload)
 let next=state
 if(record){
  next=applyRemoteRecords(state,[{
   companyId,collection:conflict.collection,recordId:conflict.recordId,payload:record,
   version:strategy==='local'?conflict.localVersion:conflict.remoteVersion,
   updatedAt:now(),deletedAt:null
  }],{companyId})
 }
 return{
  ...next,
  syncConflicts:list(next.syncConflicts).map(item=>item.id===conflictId?{
   ...item,status:'resolved',resolution:strategy,resolvedAt:now(),resolvedBy,
   mergedPayload:strategy==='merged'?record:null
  }:item),
  syncQueue:list(next.syncQueue).map(item=>item.id===conflict.mutationId?{
   ...item,status:'completed',error:'',updatedAt:now()
  }:item)
 }
}

export async function resolveConflictRemote(conflict,{strategy='remote',mergedPayload=null}={}){
 if(!supabaseEnabled)return{skipped:true}
 return authenticatedRequest('/rest/v1/rpc/resolve_sync_conflict',{
  method:'POST',
  body:{
   p_conflict_id:conflict.id,
   p_resolution:strategy,
   p_payload:strategy==='merged'?mergedPayload:null
  }
 })
}

export function deviceSummary(queue=[],companyId=''){
 const map=new Map()
 for(const item of list(queue)){
  if(companyId&&item.companyId!==companyId)continue
  const key=item.deviceId||'desconocido'
  const current=map.get(key)||{deviceId:key,pending:0,failed:0,conflicts:0,completed:0,lastActivity:''}
  if(item.status==='pending')current.pending++
  else if(item.status==='failed')current.failed++
  else if(item.status==='conflict')current.conflicts++
  else if(item.status==='completed')current.completed++
  const activity=item.updatedAt||item.createdAt||''
  if(activity>current.lastActivity)current.lastActivity=activity
  map.set(key,current)
 }
 return[...map.values()].sort((a,b)=>String(b.lastActivity).localeCompare(String(a.lastActivity)))
}
