import test from'node:test'
import assert from'node:assert/strict'
import{hasPendingWork,hasRemoteSessionIdentity,shouldAutoSync,statusLabel}from'../src/services/autoSyncRuntime.js'

const base={currentContext:{companyId:'org-1'},users:[{id:'u1',remoteId:'auth-1',activeSession:true}],syncQueue:[],syncConflicts:[],syncMeta:{}}

test('detecta identidad remota y trabajo pendiente',()=>{
 assert.equal(hasRemoteSessionIdentity(base),true)
 assert.equal(hasPendingWork({...base,syncQueue:[{status:'pending'}]}),true)
})

test('bloquea sincronización automática sin red, visibilidad o sesión',()=>{
 assert.equal(shouldAutoSync({state:base,online:false}),false)
 assert.equal(shouldAutoSync({state:base,visible:false}),false)
 assert.equal(shouldAutoSync({state:{...base,users:[]}}),false)
})

test('respeta separación mínima entre ejecuciones',()=>{
 const state={...base,syncQueue:[{status:'pending'}]}
 const now=Date.now()
 assert.equal(shouldAutoSync({state,now,lastAttemptAt:new Date(now-1000).toISOString()}),false)
 assert.equal(shouldAutoSync({state,now,lastAttemptAt:new Date(now-20000).toISOString()}),true)
})

test('describe estado global de sincronización',()=>{
 assert.equal(statusLabel({running:true},base),'Sincronizando')
 assert.equal(statusLabel({online:false},base),'Sin conexión')
 assert.equal(statusLabel({}, {...base,syncConflicts:[{status:'open'}]}),'1 conflicto')
 assert.equal(statusLabel({lastSuccessAt:new Date().toISOString()},base),'Al día')
})
