import{authenticatedRequest,supabaseEnabled}from'./supabase.js'
import{applyRemoteRecords,compactQueue}from'./syncEngine.js'

const MAX_ATTEMPTS=6
const now=()=>new Date().toISOString()
const list=value=>Array.isArray(value)?value:[]

export function retryDelay(attempts){
 return Math.min(60000,1000*Math.pow(2,Math.max(0,Number(attempts)||0)))
}

export function eligibleQueue(queue=[],at=Date.now(),companyId=''){
 return compactQueue(queue).filter(item=>{
  if(companyId&&item.companyId!==companyId)return false
  if(item.status==='completed'||item.status==='conflict')return false
  if(Number(item.attempts||0)>=MAX_ATTEMPTS)return false
  if(!item.nextAttemptAt)return true
  return Date.parse(item.nextAttemptAt)<=at
 })
}

function mapRemote(row){
 return{
  companyId:row.organization_id,
  collection:row.collection,
  recordId:row.record_id,
  payload:row.payload,
  version:row.version,
  updatedAt:row.updated_at,
  deletedAt:row.deleted_at
 }
}

async function pushOne(entry){
 return authenticatedRequest('/rest/v1/rpc/apply_sync_mutation',{
  method:'POST',
  body:{
   p_mutation_id:entry.id,
   p_organization_id:entry.companyId,
   p_device_id:entry.deviceId||'',
   p_collection:entry.collection,
   p_record_id:entry.recordId,
   p_operation:entry.operation,
   p_base_version:Number(entry.baseVersion||0),
   p_payload:entry.payload
  }
 })
}

export async function pushPending(state,companyId=state.currentContext?.companyId){
 if(!companyId)throw new Error('Selecciona una empresa antes de enviar mutaciones')
 let queue=list(state.syncQueue)
 const conflicts=[...list(state.syncConflicts)]
 let pushed=0
 for(const entry of eligibleQueue(queue,Date.now(),companyId)){
  try{
   const result=await pushOne(entry)
   const row=Array.isArray(result)?result[0]:result
   if(row?.status==='conflict'){
    queue=queue.map(item=>item.id===entry.id?{...item,status:'conflict',updatedAt:now(),error:'Conflicto de versión'}:item)
    conflicts.push({
     id:row.conflict_id||crypto.randomUUID(),companyId:entry.companyId,mutationId:entry.id,
     collection:entry.collection,recordId:entry.recordId,localPayload:entry.payload,
     remotePayload:row.remote_payload||null,localVersion:Number(entry.baseVersion||0),
     remoteVersion:Number(row.remote_version||0),status:'open',createdAt:now()
    })
   }else{
    pushed++
    queue=queue.map(item=>item.id===entry.id?{...item,status:'completed',serverVersion:Number(row?.version||entry.baseVersion||0),updatedAt:now(),error:''}:item)
   }
  }catch(error){
   queue=queue.map(item=>{
    if(item.id!==entry.id)return item
    const attempts=Number(item.attempts||0)+1
    return{...item,status:attempts>=MAX_ATTEMPTS?'failed':'pending',attempts,error:error instanceof Error?error.message:'Error de sincronización',nextAttemptAt:new Date(Date.now()+retryDelay(attempts)).toISOString(),updatedAt:now()}
   })
  }
 }
 return{state:{...state,syncQueue:queue,syncConflicts:conflicts},pushed}
}

export async function pullRemote(state,companyId){
 const cursor=state.syncMeta?.cursorByCompany?.[companyId]||'1970-01-01T00:00:00.000Z'
 const path=`/rest/v1/erp_records?organization_id=eq.${encodeURIComponent(companyId)}&updated_at=gt.${encodeURIComponent(cursor)}&select=organization_id,collection,record_id,payload,version,updated_at,deleted_at&order=updated_at.asc&limit=1000`
 const rows=await authenticatedRequest(path)
 const records=list(rows).map(mapRemote)
 const foreign=records.filter(record=>record.companyId!==companyId)
 if(foreign.length)throw new Error('La respuesta remota contiene registros de otra empresa')
 const next=applyRemoteRecords(state,records,{companyId})
 const latest=records.reduce((value,row)=>row.updatedAt>value?row.updatedAt:value,cursor)
 return{
  state:{...next,syncMeta:{...(next.syncMeta||{}),lastSyncedAt:now(),cursorByCompany:{...(next.syncMeta?.cursorByCompany||{}),[companyId]:latest}}},
  pulled:records.length
 }
}

export async function runIncrementalSync(state,{companyId=state.currentContext?.companyId}={}){
 if(!supabaseEnabled)return{state,skipped:true,pushed:0,pulled:0}
 if(!companyId)throw new Error('Selecciona una empresa antes de sincronizar')
 if(state.currentContext?.companyId&&state.currentContext.companyId!==companyId)throw new Error('La empresa solicitada no coincide con el contexto activo')
 const pushed=await pushPending(state,companyId)
 const pulled=await pullRemote(pushed.state,companyId)
 return{state:purgeCompleted(pulled.state),pushed:pushed.pushed,pulled:pulled.pulled,skipped:false}
}

export function purgeCompleted(state,keep=100){
 const completed=list(state.syncQueue).filter(item=>item.status==='completed').sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')))
 const retained=new Set(completed.slice(0,keep).map(item=>item.id))
 return{...state,syncQueue:list(state.syncQueue).filter(item=>item.status!=='completed'||retained.has(item.id))}
}
