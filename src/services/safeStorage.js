import { initialState } from './storage'
import { CURRENT_SCHEMA_VERSION, migrateState } from './stateMigration'
import { getPersistenceDriver } from './persistenceDriver'
import{cleanupLightweightCache,readLightweightCache,writeLightweightCache}from'./lightweightCache.js'

function cloneInitialState(){
 return migrateState(structuredClone(initialState))
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
 try{return migrateState(parsed)}catch(error){
  console.error('Falló la normalización del estado legado.',error)
  return migrateState({...structuredClone(initialState),...parsed,schemaVersion:Number(parsed.schemaVersion||1)})
 }
}

export function loadState(){
 try{
  cleanupLightweightCache()
  const cached=readLightweightCache()
  if(cached)return migrateState({...structuredClone(initialState),...cached})
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
  const normalized=migrateState(state)
  const result=writeLightweightCache({...normalized,schemaVersion:CURRENT_SCHEMA_VERSION,persistedAt:new Date().toISOString()})
  return{ok:true,...result}
 }catch(error){
  console.error('No fue posible guardar la caché offline.',error)
  return{ok:false,error:error instanceof Error?error.message:'Error desconocido de almacenamiento'}
 }
}

export function getRecoverySnapshot(){
 return getPersistenceDriver().readRecovery()
}
