const PREFIX='cannapa_cache_v2'
const MANIFEST_KEY=`${PREFIX}:manifest`
const IDENTITY_KEY=`${PREFIX}:identity`
const COMPANY_PREFIX=`${PREFIX}:company:`
const DEFAULT_TTL_MS=30*24*60*60*1000
const MAX_COMPANIES=3
const MAX_COLLECTION_RECORDS=1500
const MAX_LEDGER_RECORDS=10000
const MAX_QUEUE_RECORDS=1000

const INTERNAL_ARRAYS=new Set(['users','roles','memberships','userSessions','auditLog','syncQueue','syncConflicts','syncHealthEvents','syncDeviceHealth'])
const list=value=>Array.isArray(value)?value:[]
const bytes=value=>new Blob([value||'']).size

function parse(raw,fallback=null){try{return raw?JSON.parse(raw):fallback}catch{return fallback}}
function companyKey(companyId){return`${COMPANY_PREFIX}${companyId}`}
function stamp(record){return Date.parse(record?.updatedAt||record?.createdAt||record?.recordedAt||record?.date||record?.event?.occurredAt||0)||0}
function bounded(records,max=MAX_COLLECTION_RECORDS){return[...list(records)].sort((a,b)=>stamp(b)-stamp(a)).slice(0,max)}
function eventIdOf(entry){return String(entry?.event?.eventId||entry?.id||'').trim()}
function boundedLedger(records,max=MAX_LEDGER_RECORDS,pendingIds=[]){
 const pending=new Set(list(pendingIds).map(value=>String(value||'').trim()).filter(Boolean))
 const ordered=[...list(records)].sort((a,b)=>Number(a?.sequence||0)-Number(b?.sequence||0)||stamp(a)-stamp(b)||String(a?.id||'').localeCompare(String(b?.id||'')))
 const confirmed=ordered.filter(entry=>!pending.has(eventIdOf(entry))).slice(-max)
 const unconfirmed=ordered.filter(entry=>pending.has(eventIdOf(entry)))
 return[...confirmed,...unconfirmed]
}
function recordOrganizationId(record){return String(record?._organizationId||record?.companyId||record?.organizationId||record?.event?.context?.organizationId||'')}

export function cacheCollections(state={}){
 return Object.keys(state).filter(key=>Array.isArray(state[key])&&!INTERNAL_ARRAYS.has(key))
}

export function compactIdentity(state={}){
 return{
  schemaVersion:state.schemaVersion,
  currentContext:state.currentContext||{},
  companies:list(state.companies),
  users:list(state.users),roles:list(state.roles),memberships:list(state.memberships),userSessions:list(state.userSessions),
  auditLog:bounded(state.auditLog,250),
  syncQueue:bounded(state.syncQueue,MAX_QUEUE_RECORDS),
  syncConflicts:bounded(state.syncConflicts,300),
  syncHealthEvents:bounded(state.syncHealthEvents,250),
  syncDeviceHealth:bounded(state.syncDeviceHealth,100),
  syncMeta:state.syncMeta||{},
  cacheMeta:state.cacheMeta||{}
 }
}

export function compactCompanyState(state={},companyId=''){
 const collections={}
 const ledgerOutbox=state?.syncMeta?.ledgerOutboxByCompany?.[companyId]||[]
 for(const key of cacheCollections(state)){
  if(key==='companies')continue
  const scoped=list(state[key]).filter(record=>{
   const owner=recordOrganizationId(record)
   return!owner||owner===companyId
  })
  collections[key]=key==='operationalLedgerEntries'?boundedLedger(scoped,MAX_LEDGER_RECORDS,ledgerOutbox):bounded(scoped)
 }
 return{companyId,cachedAt:new Date().toISOString(),collections}
}

export function createManifest(previous={},companyId='',sizeBytes=0){
 const now=new Date().toISOString()
 const entries=list(previous.companies).filter(item=>item.companyId!==companyId)
 entries.unshift({companyId,cachedAt:now,lastAccessedAt:now,sizeBytes})
 return{version:2,updatedAt:now,lastCleanupAt:previous.lastCleanupAt||'',companies:entries.slice(0,MAX_COMPANIES)}
}

export function writeLightweightCache(state,storage=localStorage){
 const companyId=state.currentContext?.companyId||''
 const identityRaw=JSON.stringify(compactIdentity(state))
 storage.setItem(IDENTITY_KEY,identityRaw)
 let companyRaw=''
 if(companyId){
  companyRaw=JSON.stringify(compactCompanyState(state,companyId))
  storage.setItem(companyKey(companyId),companyRaw)
 }
 const previous=parse(storage.getItem(MANIFEST_KEY),{})
 const manifest=createManifest(previous,companyId,bytes(companyRaw))
 storage.setItem(MANIFEST_KEY,JSON.stringify(manifest))
 for(const entry of list(previous.companies).slice(MAX_COMPANIES-1))if(entry.companyId!==companyId)storage.removeItem(companyKey(entry.companyId))
 return{ok:true,companyId,sizeBytes:bytes(identityRaw)+bytes(companyRaw),manifest}
}

export function readLightweightCache(storage=localStorage){
 const identity=parse(storage.getItem(IDENTITY_KEY))
 if(!identity)return null
 const companyId=identity.currentContext?.companyId||''
 const company=companyId?parse(storage.getItem(companyKey(companyId)),{}):{}
 return{...identity,...(company.collections||{}),cacheMeta:{...(identity.cacheMeta||{}),source:'segmented-cache',loadedAt:new Date().toISOString(),companyId}}
}

export function cleanupLightweightCache(storage=localStorage,{now=Date.now(),ttlMs=DEFAULT_TTL_MS}={}){
 const manifest=parse(storage.getItem(MANIFEST_KEY),{companies:[]})
 const retained=[]
 let removed=0
 for(const entry of list(manifest.companies)){
  const age=now-(Date.parse(entry.lastAccessedAt||entry.cachedAt)||0)
  if(age>ttlMs){storage.removeItem(companyKey(entry.companyId));removed++}
  else retained.push(entry)
 }
 const next={...manifest,companies:retained.slice(0,MAX_COMPANIES),lastCleanupAt:new Date(now).toISOString(),updatedAt:new Date(now).toISOString()}
 storage.setItem(MANIFEST_KEY,JSON.stringify(next))
 return{removed,manifest:next}
}

export function cacheDiagnostics(storage=localStorage){
 const manifest=parse(storage.getItem(MANIFEST_KEY),{companies:[]})
 const identityRaw=storage.getItem(IDENTITY_KEY)||''
 const companies=list(manifest.companies).map(entry=>({
  ...entry,
  actualSizeBytes:bytes(storage.getItem(companyKey(entry.companyId))||''),
  available:Boolean(storage.getItem(companyKey(entry.companyId)))
 }))
 const totalBytes=bytes(identityRaw)+companies.reduce((sum,item)=>sum+item.actualSizeBytes,0)+bytes(storage.getItem(MANIFEST_KEY)||'')
 return{version:manifest.version||0,totalBytes,identityBytes:bytes(identityRaw),companies,lastCleanupAt:manifest.lastCleanupAt||'',updatedAt:manifest.updatedAt||''}
}

export const lightweightCacheKeys={MANIFEST_KEY,IDENTITY_KEY,COMPANY_PREFIX}
