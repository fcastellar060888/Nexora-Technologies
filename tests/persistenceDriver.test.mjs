import test from'node:test'
import assert from'node:assert/strict'
import{createLocalPersistenceDriver}from'../src/services/persistenceDriver.js'

function memoryStorage(){
 const values=new Map()
 return{
  getItem:key=>values.has(key)?values.get(key):null,
  setItem:(key,value)=>values.set(key,String(value))
 }
}

test('driver local guarda y recupera el estado bruto',()=>{
 const driver=createLocalPersistenceDriver(memoryStorage())
 assert.equal(driver.readRaw(),null)
 driver.writeRaw('{"schemaVersion":4}')
 assert.equal(driver.readRaw(),'{"schemaVersion":4}')
})

test('driver local conserva copia preventiva y corrupta',()=>{
 const driver=createLocalPersistenceDriver(memoryStorage())
 driver.preserveBackup('{"ok":true}','antes de migrar')
 let snapshot=driver.readRecovery()
 assert.equal(snapshot.reason,'antes de migrar')
 assert.equal(snapshot.raw,'{"ok":true}')
 driver.preserveCorrupt('{mal','JSON inválido')
 snapshot=driver.readRecovery()
 assert.equal(snapshot.reason,'JSON inválido')
 assert.equal(snapshot.raw,'{mal')
})
