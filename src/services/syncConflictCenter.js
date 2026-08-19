import{authenticatedRequest,supabaseEnabled}from'./supabase.js'
import{applyRemoteRecords}from'./syncEngine.js'

const now=()=>new Date().toISOString()
const list=value=>Array.isArray(value)?value:[]
const text=value=>String(value??'').trim()
const payloadOrganizationId=value=>text(value?.organizationId||value?.companyId||value?._organizationId)

function requireCompany(state,companyId=''){
 const tenant=text(companyId||state?.currentContext?.companyId)
 if(!tenant)throw new Error('Selecciona una empresa antes de operar la sincronización')
 if(state?.currentContext?.companyId&&text(state.currentContext.companyId)!==tenant)throw new Error('La empresa solicitada no coincide con el contexto activo')
 return tenant
}
function scopedIndex(records,id,companyId,label){
 const identity=text(id)
 const matches=list(records).map((record,index)=>({record,index})).filter(candidate=>text(candidate.record?.id)===identity&&text(candidate.record?.companyId)===companyId)
 if(matches.length>1)throw new Error(`${label} tiene identidad duplicada o ambigua dentro de la empresa activa`)
 if(matches.length===0)throw new Error(`${label} no fue encontrada en la empresa activa`)
 return matches[0]
}
function ownedConflictRecord(conflict,strategy,mergedPayload,companyId){
 const record=conflictRecord(conflict,strategy,mergedPayload)
 if(!record)return null
 const owner=payloadOrganizationId(record)
 if(owner&&owner!==companyId)throw new Error('El payload de resolución pertenece a otra empresa')
 return{...record,organizationId:companyId}
}

export function retryMutation(state,mutationId,companyId=''){
 const tenant=requireCompany(state,companyId)
 const{index}=scopedIndex(state.syncQueue,mutationId,tenant,'La mutación')
 return{
  ...state,
  syncQueue:list(state.syncQueue).map((item,position)=>position===index?{
   ...item,status:'pending',attempts:0,error:'',nextAttemptAt:'',updatedAt:now()
  }:item)
 }
}

export function retryAllFailed(state,companyId=''){
 const tenant=requireCompany(state,companyId)
 return{
  ...state,
  syncQueue:list(state.syncQueue).map(item=>
   item.status==='failed'&&text(item.companyId)===tenant
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
 const tenant=requireCompany(state)
 const{record:conflict,index:conflictIndex}=scopedIndex(state.syncConflicts,conflictId,tenant,'El conflicto')
 const record=ownedConflictRecord(conflict,strategy,mergedPayload,tenant)
 const queueMatches=list(state.syncQueue).map((item,index)=>({item,index})).filter(candidate=>text(candidate.item?.id)===text(conflict.mutationId)&&text(candidate.item?.companyId)===tenant)
 if(queueMatches.length>1)throw new Error('La mutación asociada al conflicto tiene identidad duplicada o ambigua dentro de la empresa activa')
 let next=state
 if(record){
  next=applyRemoteRecords(state,[{
   companyId:tenant,collection:conflict.collection,recordId:conflict.recordId,payload:record,
   version:strategy==='local'?conflict.localVersion:conflict.remoteVersion,
   updatedAt:now(),deletedAt:null
  }],{companyId:tenant})
 }
 const queueIndex=queueMatches[0]?.index??-1
 return{
  ...next,
  syncConflicts:list(next.syncConflicts).map((item,index)=>index===conflictIndex?{
   ...item,status:'resolved',resolution:strategy,resolvedAt:now(),resolvedBy,
   mergedPayload:strategy==='merged'?record:null
  }:item),
  syncQueue:list(next.syncQueue).map((item,index)=>index===queueIndex?{
   ...item,status:'completed',error:'',updatedAt:now()
  }:item)
 }
}

export async function resolveConflictRemote(conflict,{strategy='remote',mergedPayload=null}={}){
 if(!supabaseEnabled)return{skipped:true}
 const companyId=text(conflict?.companyId)
 if(!companyId)throw new Error('El conflicto remoto no tiene empresa asociada')
 let payload=null
 if(strategy==='merged'){
  const source=mergedPayload||conflict.localPayload||conflict.remotePayload||null
  if(source){
   const owner=payloadOrganizationId(source)
   if(owner&&owner!==companyId)throw new Error('El payload combinado pertenece a otra empresa')
   payload={...source,organizationId:companyId}
  }
 }
 return authenticatedRequest('/rest/v1/rpc/resolve_sync_conflict',{
  method:'POST',
  body:{
   p_conflict_id:conflict.id,
   p_resolution:strategy,
   p_payload:payload
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
