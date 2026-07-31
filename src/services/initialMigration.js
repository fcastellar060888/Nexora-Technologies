import{authenticatedRequest}from'./supabase.js'

const EXCLUDED=new Set(['syncQueue','syncConflicts','syncHealthEvents','auditLog','userSessions'])
const list=value=>Array.isArray(value)?value:[]
const now=()=>new Date().toISOString()

export function migratableCollections(state={}){
 return Object.entries(state)
  .filter(([key,value])=>Array.isArray(value)&&!EXCLUDED.has(key))
  .map(([collection,records])=>({collection,records:list(records).filter(item=>item&&typeof item==='object'&&item.id)}))
  .filter(item=>item.records.length>0)
}

export function validateMigrationState(state,companyId=state?.currentContext?.companyId||''){
 const errors=[]
 const warnings=[]
 if(!companyId)errors.push('Selecciona una empresa antes de migrar.')
 const collections=migratableCollections(state)
 if(collections.length===0)errors.push('No hay registros locales migrables.')
 for(const{collection,records}of collections){
  const seen=new Set()
  for(const record of records){
   const id=String(record.id||'')
   if(!id)errors.push(`${collection}: existe un registro sin identificador.`)
   if(seen.has(id))errors.push(`${collection}: identificador duplicado ${id}.`)
   seen.add(id)
   const recordCompany=record.companyId||record.organizationId||''
   if(recordCompany&&companyId&&recordCompany!==companyId)warnings.push(`${collection}/${id}: pertenece a otra empresa y será excluido.`)
  }
 }
 return{valid:errors.length===0,errors:[...new Set(errors)],warnings:[...new Set(warnings)]}
}

export function buildMigrationManifest(state,{companyId=state?.currentContext?.companyId||'',migrationId=crypto.randomUUID()}={}){
 const validation=validateMigrationState(state,companyId)
 const collections=migratableCollections(state).map(({collection,records})=>{
  const eligible=records.filter(record=>{
   const owner=record.companyId||record.organizationId||''
   return!owner||owner===companyId
  })
  return{collection,count:eligible.length,records:eligible}
 }).filter(item=>item.count>0)
 const total=collections.reduce((sum,item)=>sum+item.count,0)
 return{migrationId,companyId,createdAt:now(),schemaVersion:Number(state?.schemaVersion||0),collections,total,validation}
}

export function createMigrationBackup(state,manifest){
 return{
  format:'cannapa-initial-migration-backup',
  version:1,
  migrationId:manifest.migrationId,
  organizationId:manifest.companyId,
  createdAt:now(),
  state
 }
}

export function migrationRows(manifest){
 return manifest.collections.flatMap(group=>group.records.map(record=>({
  organization_id:manifest.companyId,
  collection:group.collection,
  record_id:String(record.id),
  payload:record,
  source_migration_id:manifest.migrationId
 })))
}

export async function previewInitialMigration(manifest){
 if(!manifest.validation.valid)throw new Error(manifest.validation.errors.join(' '))
 const result=await authenticatedRequest('/rest/v1/rpc/preview_initial_migration',{method:'POST',body:{
  p_organization_id:manifest.companyId,
  p_migration_id:manifest.migrationId,
  p_rows:migrationRows(manifest)
 }})
 return Array.isArray(result)?result[0]:result
}

export async function executeInitialMigration(manifest,{backupHash='',confirmationToken=''}={}){
 if(!manifest.validation.valid)throw new Error(manifest.validation.errors.join(' '))
 if(!confirmationToken)throw new Error('Confirma expresamente la migración antes de ejecutarla.')
 const result=await authenticatedRequest('/rest/v1/rpc/execute_initial_migration',{method:'POST',body:{
  p_organization_id:manifest.companyId,
  p_migration_id:manifest.migrationId,
  p_rows:migrationRows(manifest),
  p_backup_hash:backupHash,
  p_confirmation_token:confirmationToken
 }})
 return Array.isArray(result)?result[0]:result
}

export async function rollbackInitialMigration({companyId,migrationId}){
 if(!companyId||!migrationId)throw new Error('Faltan datos para revertir la migración.')
 const result=await authenticatedRequest('/rest/v1/rpc/rollback_initial_migration',{method:'POST',body:{p_organization_id:companyId,p_migration_id:migrationId}})
 return Array.isArray(result)?result[0]:result
}

export async function hashBackup(backup){
 const text=JSON.stringify(backup)
 if(globalThis.crypto?.subtle){
  const bytes=new TextEncoder().encode(text)
  const digest=await crypto.subtle.digest('SHA-256',bytes)
  return[...new Uint8Array(digest)].map(value=>value.toString(16).padStart(2,'0')).join('')
 }
 let hash=0
 for(let index=0;index<text.length;index++)hash=(hash*31+text.charCodeAt(index))>>>0
 return hash.toString(16).padStart(8,'0')
}
