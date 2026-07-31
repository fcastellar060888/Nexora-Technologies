import { initialState } from './storage'
import { CURRENT_SCHEMA_VERSION, migrateState } from './stateMigration'
import { getPersistenceDriver } from './persistenceDriver'

function cloneInitialState(){
 return migrateState(structuredClone(initialState))
}

export function loadState(){
 const driver=getPersistenceDriver()
 const raw=driver.readRaw()
 if(!raw)return cloneInitialState()

 let parsed
 try{
  parsed=JSON.parse(raw)
 }catch(error){
  driver.preserveCorrupt(raw,error instanceof Error?error.message:'JSON inválido')
  console.error('No fue posible leer el estado persistido. Se preservó una copia para recuperación.',error)
  return cloneInitialState()
 }

 driver.preserveBackup(raw,'Copia previa a normalización/migración')

 try{
  return migrateState(parsed)
 }catch(error){
  console.error('Falló la normalización del estado persistido. Se usará la copia original preservada.',error)
  return migrateState({
   ...structuredClone(initialState),
   ...parsed,
   schemaVersion:Number(parsed.schemaVersion||1)
  })
 }
}

export function saveState(state){
 try{
  const normalized=migrateState(state)
  getPersistenceDriver().writeRaw(JSON.stringify({
   ...normalized,
   schemaVersion:CURRENT_SCHEMA_VERSION,
   persistedAt:new Date().toISOString()
  }))
  return{ok:true}
 }catch(error){
  console.error('No fue posible guardar el estado.',error)
  return{ok:false,error:error instanceof Error?error.message:'Error desconocido de almacenamiento'}
 }
}

export function getRecoverySnapshot(){
 return getPersistenceDriver().readRecovery()
}
