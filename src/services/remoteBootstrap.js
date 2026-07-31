import{authenticatedRequest,supabaseEnabled}from'./supabase.js'
import{migrateState}from'./stateMigration.js'

const LOCAL_ONLY_COLLECTIONS=new Set([
 'syncQueue','syncConflicts','syncHealthEvents','syncDeviceHealth','userSessions','auditLog',
 'companies','users','roles','memberships'
])

const list=value=>Array.isArray(value)?value:[]

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

export function groupRemoteRecords(rows=[]){
 const grouped={}
 for(const row of list(rows).map(mapBootstrapRow)){
  if(!row.collection||!row.recordId||row.deletedAt)continue
  if(!grouped[row.collection])grouped[row.collection]=[]
  grouped[row.collection].push({...row.payload,id:row.payload?.id||row.recordId,_serverVersion:row.version,_serverUpdatedAt:row.updatedAt})
 }
 return grouped
}

export function overlayPendingMutations(state,base){
 const next={...base}
 const queue=list(state?.syncQueue).filter(item=>['pending','failed','conflict'].includes(item.status))
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

export function hydrateAuthoritativeState(localState,rows,{companyId='',hydratedAt=new Date().toISOString()}={}){
 const grouped=groupRemoteRecords(rows)
 const collections=operationalCollections(localState)
 const authoritative={...localState}
 for(const collection of collections)authoritative[collection]=grouped[collection]||[]
 const reconciled=overlayPendingMutations(localState,authoritative)
 return migrateState({
  ...reconciled,
  currentContext:{...(localState.currentContext||{}),companyId:companyId||localState.currentContext?.companyId||''},
  syncQueue:list(localState.syncQueue),
  syncConflicts:list(localState.syncConflicts),
  syncHealthEvents:list(localState.syncHealthEvents),
  syncDeviceHealth:list(localState.syncDeviceHealth),
  companies:list(localState.companies),users:list(localState.users),roles:list(localState.roles),memberships:list(localState.memberships),userSessions:list(localState.userSessions),
  auditLog:list(localState.auditLog),
  syncMeta:{...(localState.syncMeta||{}),lastHydratedAt:hydratedAt,hydrationSource:'postgres',hydratedCompanyId:companyId||localState.currentContext?.companyId||''}
 })
}

export async function loadAuthoritativeOrganization(companyId){
 if(!supabaseEnabled)return{skipped:true,rows:[]}
 if(!companyId)throw new Error('Selecciona una empresa antes de cargar datos de PostgreSQL')
 const response=await authenticatedRequest('/rest/v1/rpc/load_organization_state',{method:'POST',body:{p_organization_id:companyId}})
 return{skipped:false,rows:list(response)}
}

export async function bootstrapOrganization(localState,companyId){
 const result=await loadAuthoritativeOrganization(companyId)
 if(result.skipped)return{state:localState,skipped:true,count:0}
 return{state:hydrateAuthoritativeState(localState,result.rows,{companyId}),skipped:false,count:result.rows.length}
}
