import{authenticatedRequest,supabaseEnabled}from'./supabase.js'
import{applyRemoteRecords,compactQueue}from'./syncEngine.js'
import{synchronizeOperationalLedger}from'./operationalLedgerSync.js'

const MAX_ATTEMPTS=6
const PULL_PAGE_SIZE=1000
const EPOCH='1970-01-01T00:00:00.000Z'
const now=()=>new Date().toISOString()
const list=value=>Array.isArray(value)?value:[]
const text=value=>String(value??'').trim()
const sameMutation=(item,entry)=>text(item?.id)===text(entry?.id)&&text(item?.companyId)===text(entry?.companyId)
const queueIdentity=item=>`${text(item?.companyId)}|${text(item?.id)}`

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

export function normalizePullCursor(value){
 if(typeof value==='string')return{updatedAt:value||EPOCH,recordId:''}
 return{updatedAt:String(value?.updatedAt||EPOCH),recordId:String(value?.recordId||'')}
}

function quotedFilterValue(value){return`"${String(value).replace(/\\/g,'\\\\').replace(/"/g,'\\"')}"`}

export function buildPullPath(companyId,cursorValue,{limit=PULL_PAGE_SIZE}={}){
 const cursor=normalizePullCursor(cursorValue)
 const boundary=`(updated_at.gt.${quotedFilterValue(cursor.updatedAt)},and(updated_at.eq.${quotedFilterValue(cursor.updatedAt)},record_id.gt.${quotedFilterValue(cursor.recordId)}))`
 const params=new URLSearchParams()
 params.set('organization_id',`eq.${companyId}`)
 params.set('or',boundary)
 params.set('select','organization_id,collection,record_id,payload,version,updated_at,deleted_at')
 params.set('order','updated_at.asc,record_id.asc')
 params.set('limit',String(limit))
 return`/rest/v1/erp_records?${params.toString()}`
}

export function advancePullCursor(cursorValue,records=[]){
 const cursor=normalizePullCursor(cursorValue)
 if(!records.length)return cursor
 const last=records.at(-1)
 return{updatedAt:String(last.updatedAt||cursor.updatedAt),recordId:String(last.recordId||cursor.recordId)}
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
    queue=queue.map(item=>sameMutation(item,entry)?{...item,status:'conflict',updatedAt:now(),error:'Conflicto de versión'}:item)
    conflicts.push({
     id:row.conflict_id||crypto.randomUUID(),companyId:entry.companyId,mutationId:entry.id,
     collection:entry.collection,recordId:entry.recordId,localPayload:entry.payload,
     remotePayload:row.remote_payload||null,localVersion:Number(entry.baseVersion||0),
     remoteVersion:Number(row.remote_version||0),status:'open',createdAt:now()
    })
   }else{
    pushed++
    queue=queue.map(item=>sameMutation(item,entry)?{...item,status:'completed',serverVersion:Number(row?.version||entry.baseVersion||0),updatedAt:now(),error:''}:item)
   }
  }catch(error){
   queue=queue.map(item=>{
    if(!sameMutation(item,entry))return item
    const attempts=Number(item.attempts||0)+1
    return{...item,status:attempts>=MAX_ATTEMPTS?'failed':'pending',attempts,error:error instanceof Error?error.message:'Error de sincronización',nextAttemptAt:new Date(Date.now()+retryDelay(attempts)).toISOString(),updatedAt:now()}
   })
  }
 }
 return{state:{...state,syncQueue:queue,syncConflicts:conflicts},pushed}
}

export async function pullRemote(state,companyId){
 let cursor=normalizePullCursor(state.syncMeta?.cursorByCompany?.[companyId])
 let next=state
 let pulled=0
 while(true){
  const rows=await authenticatedRequest(buildPullPath(companyId,cursor))
  const records=list(rows).map(mapRemote)
  const foreign=records.filter(record=>record.companyId!==companyId)
  if(foreign.length)throw new Error('La respuesta remota contiene registros de otra empresa')
  next=applyRemoteRecords(next,records,{companyId})
  pulled+=records.length
  cursor=advancePullCursor(cursor,records)
  if(records.length<PULL_PAGE_SIZE)break
 }
 const syncedAt=now()
 return{
  state:{...next,syncMeta:{...(next.syncMeta||{}),lastSyncedAt:syncedAt,lastSyncedAtByCompany:{...(next.syncMeta?.lastSyncedAtByCompany||{}),[companyId]:syncedAt},cursorByCompany:{...(next.syncMeta?.cursorByCompany||{}),[companyId]:cursor}}},
  pulled
 }
}

export async function runIncrementalSync(state,{companyId=state.currentContext?.companyId}={}){
 if(!supabaseEnabled)return{state,skipped:true,pushed:0,pulled:0,ledgerPushed:0,ledgerPulled:0}
 if(!companyId)throw new Error('Selecciona una empresa antes de sincronizar')
 if(state.currentContext?.companyId&&state.currentContext.companyId!==companyId)throw new Error('La empresa solicitada no coincide con el contexto activo')
 const ledger=await synchronizeOperationalLedger(state,{companyId})
 const pushed=await pushPending(ledger.state,companyId)
 const pulled=await pullRemote(pushed.state,companyId)
 return{state:purgeCompleted(pulled.state,100,companyId),pushed:pushed.pushed,pulled:pulled.pulled,ledgerPushed:ledger.pushed,ledgerPulled:ledger.pulled,skipped:false}
}

export function purgeCompleted(state,keep=100,companyId=state.currentContext?.companyId||''){
 const tenant=text(companyId)
 if(!tenant)return state
 const completed=list(state.syncQueue).filter(item=>item.status==='completed'&&text(item.companyId)===tenant).sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')))
 const retained=new Set(completed.slice(0,keep).map(queueIdentity))
 return{...state,syncQueue:list(state.syncQueue).filter(item=>item.status!=='completed'||text(item.companyId)!==tenant||retained.has(queueIdentity(item)))}
}
