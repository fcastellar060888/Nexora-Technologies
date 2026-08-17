import { initialState } from './storage'
import { CURRENT_SCHEMA_VERSION, migrateState } from './stateMigration'
import { getPersistenceDriver } from './persistenceDriver'
import{cleanupLightweightCache,readLightweightCache,writeLightweightCache}from'./lightweightCache.js'
import{createPersistenceRuntime,recordPersistenceResult}from'./persistenceHealth.js'
import{migrateMaterialPlantIdentity}from'./materialPlantPersistence.js'
import{migrateMipePersistenceState}from'./mipePersistenceMigration.js'
import{normalizeOperationalContext}from'../domain/operationalContext.js'
import{cleanupLegacySeed}from'./legacySeedCleanup.js'
import{quarantineLegacyInlineDocuments}from'./legacyInlineDocumentMigration.js'

let lastObservedAuditId=''
let persistenceRuntime=createPersistenceRuntime()
const persistenceListeners=new Set()
const migratePersistedState=value=>cleanupLegacySeed(migrateMipePersistenceState(migrateMaterialPlantIdentity(migrateState(value))))
const normalizeState=value=>{const migrated=migratePersistedState(value);return{...migrated,currentContext:normalizeOperationalContext(migrated,migrated.currentContext)}}
const preparePersistedState=value=>normalizeState(quarantineLegacyInlineDocuments(value))

function cloneInitialState(){
 return preparePersistedState(structuredClone(initialState))
}

function publishPersistenceResult(result){
 persistenceRuntime=recordPersistenceResult(persistenceRuntime,result)
 persistenceListeners.forEach(listener=>{try{listener()}catch(error){console.error('Falló un observador de persistencia.',error)}})
 return result
}

export function getPersistenceRuntime(){return persistenceRuntime}
export function subscribePersistenceRuntime(listener){
 if(typeof listener!=='function')throw new Error('El observador de persistencia debe ser una función')
 persistenceListeners.add(listener)
 return()=>persistenceListeners.delete(listener)
}

function readLegacyState(){
 const driver=getPersistenceDriver()
 const raw=driver.readRaw()
 if(!raw)return null
 let parsed
 try{parsed=JSON.parse(raw)}catch(error){
  driver.preserveCorrupt(raw,error instanceof Error?error.message:'JSON inválido')
  console.error('No fue posible leer el estado persistido. Se preservó una copia para recuperación.',error)
  return null
 }
 driver.preserveBackup(raw,'Copia previa a migración hacia caché segmentada')
 try{return preparePersistedState(parsed)}catch(error){
  console.error('Falló la normalización del estado legado.',error)
  return preparePersistedState({...structuredClone(initialState),...parsed,schemaVersion:Number(parsed.schemaVersion||1)})
 }
}

function emitOperationalChange(state){
 if(typeof window==='undefined')return
 const audit=(state.auditLog||[]).at(-1)
 if(!audit?.id)return
 if(!lastObservedAuditId){lastObservedAuditId=audit.id;return}
 if(audit.id===lastObservedAuditId)return
 lastObservedAuditId=audit.id
 window.dispatchEvent(new CustomEvent('canapa:operational-change',{detail:{
  auditId:audit.id,
  action:audit.action||'Actualización de datos',
  module:audit.module||'Sistema',
  detail:audit.detail||'',
  collections:Array.isArray(audit.collections)?audit.collections:[],
  organizationId:state.currentContext?.companyId||'',
  createdAt:audit.createdAt||new Date().toISOString()
 }}))
}

export function loadState(){
 try{
  cleanupLightweightCache()
  const cached=readLightweightCache()
  if(cached)return preparePersistedState({...structuredClone(initialState),...cached})
 }catch(error){console.error('No fue posible cargar la caché segmentada.',error)}
 const legacy=readLegacyState()
 if(legacy){
  try{writeLightweightCache(legacy)}catch(error){console.error('No fue posible convertir la caché legada.',error)}
  return legacy
 }
 return cloneInitialState()
}

export function saveState(state){
 try{
  const normalized=preparePersistedState(state)
  const result=writeLightweightCache({...normalized,schemaVersion:CURRENT_SCHEMA_VERSION,persistedAt:new Date().toISOString()})
  emitOperationalChange(normalized)
  return publishPersistenceResult({ok:true,...result})
 }catch(error){
  console.error('No fue posible guardar la caché offline.',error)
  return publishPersistenceResult({ok:false,error:error instanceof Error?error.message:'Error desconocido de almacenamiento'})
 }
}

export function getRecoverySnapshot(){
 return getPersistenceDriver().readRecovery()
}
