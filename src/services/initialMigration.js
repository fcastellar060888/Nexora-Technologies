import{authenticatedRequest}from'./supabase.js'
import{SYNCABLE_COLLECTIONS}from'./syncEngine.js'

const MIGRATABLE_COLLECTIONS=new Set(SYNCABLE_COLLECTIONS)
const list=value=>Array.isArray(value)?value:[]
const text=value=>String(value??'').trim()
const now=()=>new Date().toISOString()
const recordId=record=>text(record?.id||record?.commandId)
const recordOrganizationId=record=>text(record?.organizationId||record?.companyId||record?._organizationId)

function singleCompanyId(state){const companies=list(state?.companies);return companies.length===1?text(companies[0]?.id):''}
function canMaterializeOwnerless(state,companyId){const only=singleCompanyId(state);return Boolean(only&&only===text(companyId))}
function normalizedEligibleRecord(state,record,companyId){
 const owner=recordOrganizationId(record)
 if(owner&&owner!==companyId)return null
 if(!owner&&!canMaterializeOwnerless(state,companyId))return null
 return{...record,id:recordId(record),organizationId:companyId}
}

export function migratableCollections(state={}){
 return Object.entries(state)
  .filter(([key,value])=>MIGRATABLE_COLLECTIONS.has(key)&&Array.isArray(value))
  .map(([collection,records])=>({collection,records:list(records).filter(item=>item&&typeof item==='object'&&recordId(item))}))
  .filter(item=>item.records.length>0)
}

export function validateMigrationState(state,companyId=state?.currentContext?.companyId||''){
 const errors=[]
 const warnings=[]
 const tenant=text(companyId)
 if(!tenant)errors.push('Selecciona una empresa antes de migrar.')
 const collections=migratableCollections(state)
 if(collections.length===0)errors.push('No hay registros locales migrables.')
 const allowOwnerless=canMaterializeOwnerless(state,tenant)
 for(const{collection,records}of collections){
  const seen=new Set()
  for(const record of records){
   const id=recordId(record),owner=recordOrganizationId(record)
   if(!id){errors.push(`${collection}: existe un registro sin identificador.`);continue}
   if(owner&&tenant&&owner!==tenant){warnings.push(`${collection}/${id}: pertenece a otra empresa y será excluido.`);continue}
   if(!owner&&!allowOwnerless){errors.push(`${collection}/${id}: no tiene ownership inequívoco en un estado multiempresa; asigna organizationId antes de migrar.`);continue}
   if(seen.has(id))errors.push(`${collection}: identificador duplicado ${id} dentro de la empresa seleccionada.`)
   seen.add(id)
  }
 }
 return{valid:errors.length===0,errors:[...new Set(errors)],warnings:[...new Set(warnings)]}
}

export function buildMigrationManifest(state,{companyId=state?.currentContext?.companyId||'',migrationId=crypto.randomUUID()}={}){
 const tenant=text(companyId)
 const validation=validateMigrationState(state,tenant)
 const collections=migratableCollections(state).map(({collection,records})=>{
  const eligible=records.flatMap(record=>{
   const normalized=normalizedEligibleRecord(state,record,tenant)
   return normalized?[normalized]:[]
  })
  return{collection,count:eligible.length,records:eligible}
 }).filter(item=>item.count>0)
 const total=collections.reduce((sum,item)=>sum+item.count,0)
 return{migrationId,companyId:tenant,createdAt:now(),schemaVersion:Number(state?.schemaVersion||0),collections,total,validation}
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
 const tenant=text(manifest?.companyId)
 if(!tenant)throw new Error('La migración no tiene empresa autoritativa.')
 return list(manifest?.collections).flatMap(group=>list(group.records).map(record=>{
  const id=recordId(record),owner=recordOrganizationId(record)
  if(!id)throw new Error(`${group.collection}: registro sin identidad estable.`)
  if(!owner)throw new Error(`${group.collection}/${id}: el payload migrable requiere organizationId explícito.`)
  if(owner!==tenant)throw new Error(`${group.collection}/${id}: el payload pertenece a otra empresa.`)
  const payload={...record,id,organizationId:tenant}
  return{
   organization_id:tenant,
   collection:group.collection,
   record_id:id,
   payload,
   source_migration_id:manifest.migrationId
  }
 }))
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
 const value=JSON.stringify(backup)
 if(globalThis.crypto?.subtle){
  const bytes=new TextEncoder().encode(value)
  const digest=await crypto.subtle.digest('SHA-256',bytes)
  return[...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join('')
 }
 let hash=0
 for(let index=0;index<value.length;index++)hash=(hash*31+value.charCodeAt(index))>>>0
 return hash.toString(16).padStart(8,'0')
}
