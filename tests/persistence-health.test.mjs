import test from'node:test'
import assert from'node:assert/strict'
import{readFile}from'node:fs/promises'
import{createPersistenceRuntime,recordPersistenceResult}from'../src/services/persistenceHealth.js'

test('un fallo de caché queda observable y marca datos pendientes',()=>{
 const initial=createPersistenceRuntime()
 const failed=recordPersistenceResult(initial,{ok:false,error:'QuotaExceededError'},{attemptedAt:'2026-08-03T05:00:00.000Z'})
 assert.equal(failed.status,'error')
 assert.equal(failed.dirty,true)
 assert.equal(failed.lastError,'QuotaExceededError')
 assert.equal(failed.consecutiveFailures,1)
 assert.equal(failed.lastSavedAt,'')
 assert.equal(Object.isFrozen(failed),true)
})

test('los fallos consecutivos conservan el último guardado exitoso',()=>{
 const saved=recordPersistenceResult(createPersistenceRuntime(),{ok:true,segments:4},{attemptedAt:'2026-08-03T05:01:00.000Z'})
 const first=recordPersistenceResult(saved,{ok:false,error:'fallo 1'},{attemptedAt:'2026-08-03T05:02:00.000Z'})
 const second=recordPersistenceResult(first,{ok:false,error:'fallo 2'},{attemptedAt:'2026-08-03T05:03:00.000Z'})
 assert.equal(second.lastSavedAt,'2026-08-03T05:01:00.000Z')
 assert.equal(second.lastAttemptAt,'2026-08-03T05:03:00.000Z')
 assert.equal(second.consecutiveFailures,2)
 assert.equal(second.lastError,'fallo 2')
})

test('un reintento exitoso limpia el estado pendiente',()=>{
 const failed=recordPersistenceResult(createPersistenceRuntime(),{ok:false,error:'almacenamiento lleno'},{attemptedAt:'2026-08-03T05:04:00.000Z'})
 const recovered=recordPersistenceResult(failed,{ok:true,segments:7},{attemptedAt:'2026-08-03T05:05:00.000Z'})
 assert.equal(recovered.status,'ready')
 assert.equal(recovered.dirty,false)
 assert.equal(recovered.lastError,'')
 assert.equal(recovered.consecutiveFailures,0)
 assert.equal(recovered.lastSavedAt,'2026-08-03T05:05:00.000Z')
})

test('safeStorage publica cada resultado de persistencia',async()=>{
 const source=await readFile(new URL('../src/services/safeStorage.js',import.meta.url),'utf8')
 assert.match(source,/recordPersistenceResult/)
 assert.match(source,/subscribePersistenceRuntime/)
 assert.match(source,/publishPersistenceResult\(\{ok:false/)
 assert.match(source,/publishPersistenceResult\(\{ok:true/)
})

test('el bridge informa al usuario y permite reintentar el guardado',async()=>{
 const bridge=await readFile(new URL('../src/components/PersistenceHealthBridge.jsx',import.meta.url),'utf8')
 const main=await readFile(new URL('../src/main.jsx',import.meta.url),'utf8')
 assert.match(bridge,/useSyncExternalStore/)
 assert.match(bridge,/Cambios pendientes de guardar/)
 assert.match(bridge,/Reintentar guardado/)
 assert.match(bridge,/saveState\(state\)/)
 assert.match(main,/PersistenceHealthBridge/)
})
