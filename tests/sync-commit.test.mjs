import test from'node:test'
import assert from'node:assert/strict'
import{readFile}from'node:fs/promises'
import{commitIncrementalSyncResult}from'../src/services/syncCommit.js'

const queue=(id,status='pending')=>({id,companyId:'company-1',collection:'sites',recordId:id,operation:'upsert',status,payload:{id,name:id}})

function state(overrides={}){
 return{
  currentContext:{companyId:'company-1'},
  companies:[],users:[],roles:[],memberships:[],userSessions:[],auditLog:[],
  sites:[],houses:[],syncQueue:[],syncConflicts:[],syncHealthEvents:[],syncDeviceHealth:[],syncMeta:{},
  ...overrides
 }
}

test('conserva altas, cambios y eliminaciones locales ocurridos durante la sincronización',()=>{
 const initial=state({sites:[{id:'a',name:'Inicial'},{id:'remove',name:'Eliminar'}]})
 const current=state({sites:[{id:'a',name:'Edición concurrente'},{id:'new',name:'Alta concurrente'}]})
 const processed=state({sites:[{id:'a',name:'Remoto'},{id:'remove',name:'Remoto conservado'},{id:'remote',name:'Alta remota'}],syncMeta:{lastSyncedAt:'2026-08-03T05:00:00.000Z'}})
 const committed=commitIncrementalSyncResult(initial,current,processed)
 assert.deepEqual(committed.sites,[
  {id:'a',name:'Edición concurrente'},
  {id:'remote',name:'Alta remota'},
  {id:'new',name:'Alta concurrente'}
 ])
 assert.equal(committed.syncMeta.lastSyncedAt,'2026-08-03T05:00:00.000Z')
})

test('no resucita mutaciones iniciales completadas y conserva las creadas durante la operación',()=>{
 const initialMutation=queue('initial')
 const concurrentMutation=queue('concurrent')
 const initial=state({syncQueue:[initialMutation]})
 const current=state({syncQueue:[initialMutation,concurrentMutation]})
 const processed=state({syncQueue:[{...initialMutation,status:'completed'}]})
 const committed=commitIncrementalSyncResult(initial,current,processed)
 assert.deepEqual(committed.syncQueue.map(item=>[item.id,item.status]),[['initial','completed'],['concurrent','pending']])
})

test('AUD-F016: descarta íntegramente un resultado si cambió la empresa activa',()=>{
 const initial=state({currentContext:{companyId:'company-1'},sites:[{id:'a',name:'Empresa 1'}]})
 const current=state({currentContext:{companyId:'company-2'},sites:[{id:'b',name:'Empresa 2'}],auditLog:[{id:'new'}],syncHealthEvents:[{id:'health'}]})
 const processed=state({currentContext:{companyId:'company-1'},sites:[{id:'remote-a',name:'Remoto empresa 1'}],syncQueue:[queue('processed','completed')],syncMeta:{lastSyncedAt:'2026-08-03T05:00:00.000Z'}})
 const committed=commitIncrementalSyncResult(initial,current,processed)
 assert.strictEqual(committed,current)
 assert.deepEqual(committed.sites,[{id:'b',name:'Empresa 2'}])
 assert.equal(committed.syncMeta.lastSyncedAt,undefined)
})

test('AUD-F016: descarta resultados cuyo contexto procesado no coincide con el tenant inicial',()=>{
 const initial=state({currentContext:{companyId:'company-1'}})
 const current=state({currentContext:{companyId:'company-1'},sites:[{id:'local',name:'Local'}]})
 const processed=state({currentContext:{companyId:'company-2'},sites:[{id:'foreign',name:'Foráneo'}]})
 const committed=commitIncrementalSyncResult(initial,current,processed)
 assert.strictEqual(committed,current)
 assert.deepEqual(committed.sites,[{id:'local',name:'Local'}])
})

test('el Store confirma resultados de sync mediante receta funcional',async()=>{
 const source=await readFile(new URL('../src/services/store.jsx',import.meta.url),'utf8')
 assert.match(source,/commitIncrementalSyncResult/)
 assert.match(source,/update\(prev=>commitIncrementalSyncResult\(current,prev,committed\)/)
 assert.doesNotMatch(source,/update\(next,\{sync:false,audit:false\}\)/)
})
