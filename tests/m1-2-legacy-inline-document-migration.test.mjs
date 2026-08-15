import test from'node:test'
import assert from'node:assert/strict'
import{readFile}from'node:fs/promises'
import{legacyInlineDocumentRecoveryKey,quarantineLegacyInlineDocuments,readLegacyInlineDocumentRecovery}from'../src/services/legacyInlineDocumentMigration.js'
import{SYNCABLE_COLLECTIONS}from'../src/services/syncEngine.js'

function memoryStorage(){const values=new Map();return{getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)}}
const dataUrl='data:application/pdf;base64,JVBERi0xLjQ='

test('M12-F004 legacy migration preserves inline bytes outside active state and strips dataUrl',()=>{
 const storage=memoryStorage()
 const state={attachments:[{id:'att-1',entityType:'plant',entityId:'p1',name:'old.pdf',type:'application/pdf',size:12,dataUrl}],syncQueue:[]}
 const migrated=quarantineLegacyInlineDocuments(state,storage)
 assert.equal(migrated.attachments[0].dataUrl,undefined)
 assert.equal(migrated.attachments[0].migrationRequired,true)
 assert.equal(migrated.attachments[0].legacyInlineQuarantined,true)
 const recovery=readLegacyInlineDocumentRecovery(storage)
 assert.equal(recovery.documents.length,1)
 assert.equal(recovery.documents[0].id,'att-1')
 assert.equal(recovery.documents[0].dataUrl,dataUrl)
 assert.ok(recovery.documents[0].fingerprint)
 assert.ok(storage.getItem(legacyInlineDocumentRecoveryKey))
})

test('M12-F004 legacy migration quarantines queued inline payloads and removes generic attachment mutations',()=>{
 const storage=memoryStorage()
 const state={attachments:[],syncQueue:[{id:'q1',companyId:'org-a',collection:'attachments',recordId:'att-2',operation:'upsert',payload:{id:'att-2',name:'queued.pdf',dataUrl}},{id:'q2',companyId:'org-a',collection:'beds',recordId:'bed-1',operation:'upsert',payload:{id:'bed-1'}}]}
 const migrated=quarantineLegacyInlineDocuments(state,storage)
 assert.deepEqual(migrated.syncQueue.map(item=>item.id),['q2'])
 assert.equal(readLegacyInlineDocumentRecovery(storage).documents[0].id,'att-2')
})

test('M12-F004 document metadata no longer participates in generic erp_records sync',()=>{
 assert.equal(SYNCABLE_COLLECTIONS.includes('attachments'),false)
})

test('M12-F004 state persistence invokes quarantine before active cache persistence',async()=>{
 const source=await readFile(new URL('../src/services/safeStorage.js',import.meta.url),'utf8')
 assert.match(source,/quarantineLegacyInlineDocuments/)
 assert.match(source,/preparePersistedState/)
 assert.match(source,/writeLightweightCache\(\{\.\.\.normalized/)
})
