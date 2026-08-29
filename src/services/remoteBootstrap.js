import{authenticatedRequest,supabaseEnabled}from'./supabase.js'
import{SYNCABLE_COLLECTIONS}from'./syncEngine.js'
import{migrateState}from'./stateMigration.js'
import{migrateMaterialPlantIdentity}from'./materialPlantPersistence.js'
import{migrateMipePersistenceState}from'./mipePersistenceMigration.js'
import{normalizeOperationalContext}from'../domain/operationalContext.js'

const SYNCABLE_COLLECTION_SET=new Set(SYNCABLE_COLLECTIONS)
const list=value=>Array.isArray(value)?value:[]
const text=value=>String(value??'').trim()
const recordId=record=>text(record?.id||record?.commandId)
const domainOrganizationId=record=>text(record?.organizationId||record?.companyId)
const transportOrganizationId=record=>text(record?._organizationId)
const recordOrganizationId=record=>domainOrganizationId(record)||transportOrganizationId(record)
const recordKey=record=>`${recordOrganizationId(record)}:${recordId(record)}`
const serialize=value=>{try{return JSON.stringify(value)}catch{return String(value)}}
const finalizeHydratedState=value=>{const migrated=migrateMipePersistenceState(migrateMaterialPlantIdentity(migrateState(value)));return{...migrated,currentContext:normalizeOperationalContext(migrated,migrated.currentContext)}}

export function operationalCollections(state={}){
 return SYNCABLE_COLLECTIONS.filter(key=>Array.isArray(state?.[key]))
}

export function mapBootstrapRow(row){return{companyId:text(row.organization_id),collection:text(row.collection),recordId:text(row.record_id),payload:row.payload,version:Number(row.version||0),updatedAt:row.updated_at,deletedAt:row.deleted_at||''}}

export function groupRemoteRecords(rows=[],{companyId=''}={}){
 const tenant=text(companyId),mapped=list(rows).map(mapBootstrapRow)
 if(tenant&&mapped.some(row=>row.companyId!==tenant))throw new Error('La hidratación remota contiene registros de otra empresa')
 const grouped={}
 for(const row of mapped){
  if(!row.collection||!row.recordId||row.deletedAt)continue
  if(!SYNCABLE_COLLECTION_SET.has(row.collection))throw new Error(`La hidratación remota contiene una colección fuera del contrato sync: ${row.collection}`)
  if(!row.companyId)throw new Error('La fila remota no tiene organización autoritativa')
  const payload=row.payload&&typeof row.payload==='object'&&!Array.isArray(row.payload)?row.payload:{}
  const payloadOwner=domainOrganizationId(payload)
  if(payloadOwner&&payloadOwner!==row.companyId)throw new Error('El payload remoto contradice la organización autoritativa de la fila')
  if(!grouped[row.collection])grouped[row.collection]=[]
  grouped[row.collection].push({...payload,id:payload.id||payload.commandId||row.recordId,organizationId:row.companyId,_organizationId:row.companyId,_serverVersion:row.version,_serverUpdatedAt:row.updatedAt})
 }
 return grouped
}
function replaceCompanyPartition(existing,remote,companyId){return[...list(existing).filter(record=>recordOrganizationId(record)!==companyId),...list(remote)]}
function upsert(collection,record){const id=recordKey(record);if(!recordId(record))return collection;const index=collection.findIndex(candidate=>recordKey(candidate)===id);if(index<0)return[...collection,record];return collection.map((candidate,position)=>position===index?record:candidate)}
export function overlayConcurrentChanges(initialState,currentState,base,{companyId=currentState?.currentContext?.companyId||''}={}){
 const next={...base},collections=new Set([...operationalCollections(initialState),...operationalCollections(currentState)])
 for(const collection of collections){const initial=list(initialState?.[collection]),current=list(currentState?.[collection]),initialById=new Map(initial.map(record=>[recordKey(record),record]).filter(([id])=>!id.endsWith(':'))),currentById=new Map(current.map(record=>[recordKey(record),record]).filter(([id])=>!id.endsWith(':')));let merged=list(next[collection]);for(const[id,record]of currentById){const previous=initialById.get(id);if(!previous||serialize(previous)!==serialize(record))merged=upsert(merged,record)}for(const id of initialById.keys())if(!currentById.has(id))merged=merged.filter(record=>recordKey(record)!==id);next[collection]=merged}
 return next
}
export function overlayPendingMutations(state,base){
 const next={...base},companyId=text(state?.currentContext?.companyId);if(!companyId)return next
 const queue=list(state?.syncQueue).filter(item=>text(item?.companyId)===companyId&&['pending','failed','conflict'].includes(item.status))
 for(const item of queue){if(!SYNCABLE_COLLECTION_SET.has(item.collection)||!Array.isArray(next[item.collection]))continue;const key=`${companyId}:${item.recordId}`;if(item.operation==='delete')next[item.collection]=next[item.collection].filter(record=>recordKey(record)!==key);else{const payload=item.payload&&typeof item.payload==='object'&&!Array.isArray(item.payload)?item.payload:{},payloadOwner=domainOrganizationId(payload);if(payloadOwner&&payloadOwner!==companyId)throw new Error('La mutación pendiente contradice la empresa de su cola');const record={...payload,id:payload.id||payload.commandId||item.recordId,organizationId:companyId,_organizationId:companyId},index=next[item.collection].findIndex(candidate=>recordKey(candidate)===key);if(index>=0)next[item.collection]=next[item.collection].map((candidate,position)=>position===index?{...candidate,...record}:candidate);else next[item.collection]=[...next[item.collection],record]}}
 return next
}
export function hydrateAuthoritativeState(localState,rows,{companyId='',hydratedAt=new Date().toISOString(),initialState=localState}={}){
 const tenant=text(companyId);if(!tenant)throw new Error('Se requiere empresa para hidratar el estado autoritativo');if(localState.currentContext?.companyId&&localState.currentContext.companyId!==tenant)throw new Error('La empresa de hidratación no coincide con el contexto activo')
 const grouped=groupRemoteRecords(rows,{companyId:tenant}),collections=new Set([...operationalCollections(initialState),...operationalCollections(localState),...Object.keys(grouped)]),authoritative={...localState}
 for(const collection of collections)authoritative[collection]=replaceCompanyPartition(localState[collection],grouped[collection],tenant)
 const concurrent=overlayConcurrentChanges(initialState,localState,authoritative,{companyId:tenant}),reconciled=overlayPendingMutations({...localState,currentContext:{...(localState.currentContext||{}),companyId:tenant}},concurrent)
 return finalizeHydratedState({...reconciled,currentContext:{...(localState.currentContext||{}),companyId:tenant},syncQueue:list(localState.syncQueue),syncConflicts:list(localState.syncConflicts),syncHealthEvents:list(localState.syncHealthEvents),syncDeviceHealth:list(localState.syncDeviceHealth),companies:list(localState.companies),users:list(localState.users),roles:list(localState.roles),memberships:list(localState.memberships),entitlements:list(localState.entitlements),userSessions:list(localState.userSessions),auditLog:list(localState.auditLog),operationalLedgerEntries:list(localState.operationalLedgerEntries),timelineEntries:list(localState.timelineEntries),syncMeta:{...(localState.syncMeta||{}),lastHydratedAt:hydratedAt,hydrationSource:'postgres',hydratedCompanyId:tenant}})
}
export function bootstrapContextIsCurrent(state,companyId){return Boolean(text(companyId)&&text(state?.currentContext?.companyId)===text(companyId))}
export async function loadAuthoritativeOrganization(companyId){if(!supabaseEnabled)return{skipped:true,rows:[]};if(!companyId)throw new Error('Selecciona una empresa antes de cargar datos de PostgreSQL');const response=await authenticatedRequest('/rest/v1/rpc/load_organization_state',{method:'POST',body:{p_organization_id:companyId}});return{skipped:false,rows:list(response)}}
export async function bootstrapOrganization(initialState,companyId,{getCurrentState=()=>initialState}={}){const result=await loadAuthoritativeOrganization(companyId);if(result.skipped)return{state:getCurrentState(),skipped:true,count:0};const currentState=getCurrentState();if(!bootstrapContextIsCurrent(currentState,companyId))return{state:currentState,skipped:true,reason:'stale-company-context',count:result.rows.length};return{state:hydrateAuthoritativeState(currentState,result.rows,{companyId,initialState}),skipped:false,count:result.rows.length}}
