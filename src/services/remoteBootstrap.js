import{authenticatedRequest,supabaseEnabled}from'./supabase.js'
import{migrateState}from'./stateMigration.js'
import{migrateMaterialPlantIdentity}from'./materialPlantPersistence.js'

const LOCAL_ONLY_COLLECTIONS=new Set([
 'syncQueue','syncConflicts','syncHealthEvents','syncDeviceHealth','userSessions','auditLog',
 'companies','users','roles','memberships'
])

const list=value=>Array.isArray(value)?value:[]
const recordKey=record=>String(record?.id||'')
const serialize=value=>{try{return JSON.stringify(value)}catch{return String(value)}}

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
  grouped[row.collection].push({...row.payload,id:row.payload?.id||row.recordId,_serverVersion:row.version,_serverUpdatedAt:row.updatedAt})
 }
 return grouped
}

function upsert(collection,record){
 const id=recordKey(record)
 if(!id)return collection
 const index=collection.findIndex(candidate=>recordKey(candidate)===id)
 if(index<0)return[...collection,record]
 return collection.map((candidate,position)=>position===index?record:candidate)
}

export function overlayConcurrentChanges(initialState,currentState,base){
 const next={...base}
 const collections=new Set([...operationalCollections(initialState),...operationalCollections(currentState)])
 for(const collection of collections){
  const initial=list(initialState?.[collection]),current=list(currentState?.[collection])
  const initialById=new Map(initial.map(record=>[recordKey(record),record]).filter(([id])=>id))
  const currentById=new Map(current.map(record=>[recordKey(record),record]).filter(([id])=>id))
  let merged=list(next[collection])
  for(const[id,record]of currentById){
   const previous=initialById.get(id)
   if(!previous||serialize(previous)!==serialize(record))merged=upsert(merged,record)
  }
  for(const id of initialById.keys())if(!currentById.has(id))merged=merged.filter(record=>recordKey(record)!==id)
  next[collection]=merged
 }
 return next
}

export function overlayPendingMutations(state,base){
 const next={...base}
 const companyId=state?.currentContext?.companyId||''
 const queue=list(state?.syncQueue).filter(item=>item.companyId===companyId&&['pending','failed','conflict'].includes(item.status))
 for(const item of queue){
  if(!item.collection||!Array.isArray(next[item.collection]))continue
  if(item.operation==='delete')next[item.collection]=next[item.collection].filter(record=>String(record.id)!==String(item.recordId))
  else{
   const record={...(item.payload||{}),id:item.payload?.id||item.recordId}
   const index=next[item.collection].findIndex(candidate=>String(candidate.id)===String(item.recordId))
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
 const collections=new Set([...operationalCollections(initialState),...operationalCollections(localState)])
 const authoritative={...localState}
 for(const collection of collections)authoritative[collection]=grouped[collection]||[]
 const concurrent=overlayConcurrentChanges(initialState,localState,authoritative)
 const reconciled=overlayPendingMutations(localState,concurrent)
 return migrateMaterialPlantIdentity(migrateState({
  ...reconciled,
  currentContext:{...(localState.currentContext||{}),companyId},
  syncQueue:list(localState.syncQueue),
  syncConflicts:list(localState.syncConflicts),
  syncHealthEvents:list(localState.syncHealthEvents),
  syncDeviceHealth:list(localState.syncDeviceHealth),
  companies:list(localState.companies),users:list(localState.users),roles:list(localState.roles),memberships:list(localState.memberships),userSessions:list(localState.userSessions),
  auditLog:list(localState.auditLog),
  syncMeta:{...(localState.syncMeta||{}),lastHydratedAt:hydratedAt,hydrationSource:'postgres',hydratedCompanyId:companyId}
 }))
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
