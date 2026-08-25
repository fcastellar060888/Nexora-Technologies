import{authenticatedRequest,supabaseEnabled}from'./supabase.js'
import{migrateState}from'./stateMigration.js'
import{migrateMaterialPlantIdentity}from'./materialPlantPersistence.js'
import{migrateMipePersistenceState}from'./mipePersistenceMigration.js'
import{normalizeOperationalContext}from'../domain/operationalContext.js'

const LOCAL_ONLY_COLLECTIONS=new Set([
 'syncQueue','syncConflicts','syncHealthEvents','syncDeviceHealth','userSessions','auditLog',
 'operationalLedgerEntries','timelineEntries',
 'companies','users','roles','memberships','entitlements'
])

const list=value=>Array.isArray(value)?value:[]
const recordId=record=>String(record?.id||record?.commandId||'')
const recordOrganizationId=record=>String(record?._organizationId||record?.companyId||record?.organizationId||'')
const recordKey=(record,fallbackCompanyId='')=>`${recordOrganizationId(record)||fallbackCompanyId}:${recordId(record)}`
const serialize=value=>{try{return JSON.stringify(value)}catch{return String(value)}}
const finalizeHydratedState=value=>{const migrated=migrateMipePersistenceState(migrateMaterialPlantIdentity(migrateState(value)));return{...migrated,currentContext:normalizeOperationalContext(migrated,migrated.currentContext)}}

export function operationalCollections(state={}){
 return Object.keys(state).filter(key=>Array.isArray(state[key])&&!LOCAL_ONLY_COLLECTIONS.has(key))
}

export function mapBootstrapRow(row){
 return{
  companyId:row.organization_id,
  collection:row.collection,
  recordId:row.record_id,
  payload:row.payload,
  version:Number(row.version||0),
  updatedAt:row.updated_at,
  deletedAt:row.deleted_at||''
 }
}

export function groupRemoteRecords(rows=[],{companyId=''}={}){
 const mapped=list(rows).map(mapBootstrapRow)
 if(companyId&&mapped.some(row=>row.companyId!==companyId))throw new Error('La hidratación remota contiene registros de otra empresa')
 const grouped={}
 for(const row of mapped){
  if(!row.collection||!row.recordId||row.deletedAt)continue
  if(!grouped[row.collection])grouped[row.collection]=[]
  grouped[row.collection].push({...row.payload,id:row.payload?.id||row.recordId,_organizationId:row.companyId,_serverVersion:row.version,_serverUpdatedAt:row.updatedAt})
 }
 return grouped
}

function replaceCompanyPartition(existing,remote,companyId){
 const foreign=list(existing).filter(record=>{
  const owner=recordOrganizationId(record)
  return owner&&owner!==companyId
 })
 return[...foreign,...list(remote)]
}

function upsert(collection,record,companyId=''){
 const id=recordKey(record,companyId)
 if(!recordId(record))return collection
 const index=collection.findIndex(candidate=>recordKey(candidate,companyId)===id)
 if(index<0)return[...collection,record]
 return collection.map((candidate,position)=>position===index?record:candidate)
}

export function overlayConcurrentChanges(initialState,currentState,base,{companyId=currentState?.currentContext?.companyId||''}={}){
 const next={...base}
 const collections=new Set([...operationalCollections(initialState),...operationalCollections(currentState)])
 for(const collection of collections){
  const initial=list(initialState?.[collection]),current=list(currentState?.[collection])
  const initialById=new Map(initial.map(record=>[recordKey(record,companyId),record]).filter(([id])=>!id.endsWith(':')))
  const currentById=new Map(current.map(record=>[recordKey(record,companyId),record]).filter(([id])=>!id.endsWith(':')))
  let merged=list(next[collection])
  for(const[id,record]of currentById){
   const previous=initialById.get(id)
   if(!previous||serialize(previous)!==serialize(record))merged=upsert(merged,record,companyId)
  }
  for(const id of initialById.keys())if(!currentById.has(id))merged=merged.filter(record=>recordKey(record,companyId)!==id)
  next[collection]=merged
 }
 return next
}

export function overlayPendingMutations(state,base){
 const next={...base}
 const companyId=String(state?.currentContext?.companyId||'').trim()
 if(!companyId)return next
 const queue=list(state?.syncQueue).filter(item=>{
  const owner=String(item?.companyId||companyId).trim()
  return owner===companyId&&['pending','failed','conflict'].includes(item.status)
 })
 for(const item of queue){
  if(!item.collection||!Array.isArray(next[item.collection]))continue
  if(item.operation==='delete')next[item.collection]=next[item.collection].filter(record=>recordKey(record,companyId)!==`${companyId}:${item.recordId}`)
  else{
   const record={...(item.payload||{}),id:item.payload?.id||item.payload?.commandId||item.recordId,_organizationId:companyId}
   const key=`${companyId}:${item.recordId}`
   const index=next[item.collection].findIndex(candidate=>recordKey(candidate,companyId)===key)
   if(index>=0)next[item.collection]=next[item.collection].map((candidate,position)=>position===index?{...candidate,...record}:candidate)
   else next[item.collection]=[...next[item.collection],record]
  }
 }
 return next
}

export function hydrateAuthoritativeState(localState,rows,{companyId='',hydratedAt=new Date().toISOString(),initialState=localState}={}){
 if(!companyId)throw new Error('Se requiere empresa para hidratar el estado autoritativo')
 if(localState.currentContext?.companyId&&localState.currentContext.companyId!==companyId)throw new Error('La empresa de hidratación no coincide con el contexto activo')
 const grouped=groupRemoteRecords(rows,{companyId})
 const collections=new Set([...operationalCollections(initialState),...operationalCollections(localState),...Object.keys(grouped)])
 const authoritative={...localState}
 for(const collection of collections)authoritative[collection]=replaceCompanyPartition(localState[collection],grouped[collection],companyId)
 const concurrent=overlayConcurrentChanges(initialState,localState,authoritative,{companyId})
 const reconciled=overlayPendingMutations({...localState,currentContext:{...(localState.currentContext||{}),companyId}},concurrent)
 return finalizeHydratedState({
  ...reconciled,
  currentContext:{...(localState.currentContext||{}),companyId},
  syncQueue:list(localState.syncQueue).map(item=>item?.companyId?item:{...item,companyId}),
  syncConflicts:list(localState.syncConflicts),
  syncHealthEvents:list(localState.syncHealthEvents),
  syncDeviceHealth:list(localState.syncDeviceHealth),
  companies:list(localState.companies),users:list(localState.users),roles:list(localState.roles),memberships:list(localState.memberships),entitlements:list(localState.entitlements),userSessions:list(localState.userSessions),
  auditLog:list(localState.auditLog),
  operationalLedgerEntries:list(localState.operationalLedgerEntries),
  timelineEntries:list(localState.timelineEntries),
  syncMeta:{...(localState.syncMeta||{}),lastHydratedAt:hydratedAt,hydrationSource:'postgres',hydratedCompanyId:companyId}
 })
}

export async function loadAuthoritativeOrganization(companyId){
 if(!supabaseEnabled)return{skipped:true,rows:[]}
 if(!companyId)throw new Error('Selecciona una empresa antes de cargar datos de PostgreSQL')
 const response=await authenticatedRequest('/rest/v1/rpc/load_organization_state',{method:'POST',body:{p_organization_id:companyId}})
 return{skipped:false,rows:list(response)}
}

export async function bootstrapOrganization(initialState,companyId,{getCurrentState=()=>initialState}={}){
 const result=await loadAuthoritativeOrganization(companyId)
 if(result.skipped)return{state:getCurrentState(),skipped:true,count:0}
 const currentState=getCurrentState()
 const currentCompanyId=currentState?.currentContext?.companyId||''
 if(currentCompanyId&&currentCompanyId!==companyId)return{state:currentState,skipped:true,reason:'stale-company-context',count:result.rows.length}
 return{state:hydrateAuthoritativeState(currentState,result.rows,{companyId,initialState}),skipped:false,count:result.rows.length}
}
