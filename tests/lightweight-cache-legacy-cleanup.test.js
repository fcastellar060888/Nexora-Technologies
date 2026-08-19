import test from'node:test'
import assert from'node:assert/strict'
import{purgeLegacyLightweightCache}from'../src/services/lightweightCache.js'

function memoryStorage(seed={}){
 const map=new Map(Object.entries(seed))
 return{
  get length(){return map.size},
  key(index){return[...map.keys()][index]??null},
  getItem(key){return map.has(key)?map.get(key):null},
  setItem(key,value){map.set(key,String(value))},
  removeItem(key){map.delete(key)},
  keys(){return[...map.keys()]}
 }
}

test('M4.6 F007: purge removes only unsafe Cannapa segmented cache keys and preserves device identity/recovery keys',()=>{
 const storage=memoryStorage({
  'cannapa_cache_v2:manifest':'{}',
  'cannapa_cache_v2:identity':'{"auditLog":[{"organizationId":"org-b"}]}',
  'cannapa_cache_v2:company:org-a':'{}',
  'cannapa_cache_v2:company:org-b':'{}',
  'cannapa_device_id':'device-stable',
  'cannapa_erp_v1_foundation_backup':'recovery',
  'nexora_cache_v3:identity':'{}'
 })
 const result=purgeLegacyLightweightCache(storage)
 assert.equal(result.removed,4)
 assert.equal(storage.getItem('cannapa_cache_v2:identity'),null)
 assert.equal(storage.getItem('cannapa_device_id'),'device-stable')
 assert.equal(storage.getItem('cannapa_erp_v1_foundation_backup'),'recovery')
 assert.equal(storage.getItem('nexora_cache_v3:identity'),'{}')
})
