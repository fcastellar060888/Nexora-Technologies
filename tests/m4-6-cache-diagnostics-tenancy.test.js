import test from'node:test'
import assert from'node:assert/strict'
import{cacheDiagnostics,cleanupLightweightCache,lightweightCacheKeys}from'../src/services/lightweightCache.js'

function storageOf(entries={}){const map=new Map(Object.entries(entries));return{getItem:key=>map.has(key)?map.get(key):null,setItem:(key,value)=>map.set(key,String(value)),removeItem:key=>map.delete(key),has:key=>map.has(key)}}

test('cache diagnostics exposes only the requested company partition',()=>{
 const manifest={version:2,companies:[{companyId:'org-a',cachedAt:'2026-08-01T00:00:00Z'},{companyId:'org-b',cachedAt:'2026-08-01T00:00:00Z'}]}
 const storage=storageOf({[lightweightCacheKeys.MANIFEST_KEY]:JSON.stringify(manifest),[lightweightCacheKeys.IDENTITY_KEY]:'{}',[`${lightweightCacheKeys.COMPANY_PREFIX}org-a`]:'{"a":1}',[`${lightweightCacheKeys.COMPANY_PREFIX}org-b`]:'{"secret":true}'})
 const result=cacheDiagnostics(storage,{companyId:'org-a'})
 assert.deepEqual(result.companies.map(x=>x.companyId),['org-a'])
})

test('company-scoped cleanup cannot delete a foreign expired cache',()=>{
 const old='2020-01-01T00:00:00Z'
 const manifest={version:2,companies:[{companyId:'org-a',cachedAt:old,lastAccessedAt:old},{companyId:'org-b',cachedAt:old,lastAccessedAt:old}]}
 const a=`${lightweightCacheKeys.COMPANY_PREFIX}org-a`,b=`${lightweightCacheKeys.COMPANY_PREFIX}org-b`
 const storage=storageOf({[lightweightCacheKeys.MANIFEST_KEY]:JSON.stringify(manifest),[a]:'{}',[b]:'{}'})
 const result=cleanupLightweightCache(storage,{companyId:'org-a',now:Date.parse('2026-08-29T00:00:00Z'),ttlMs:1})
 assert.equal(result.removed,1)
 assert.equal(storage.has(a),false)
 assert.equal(storage.has(b),true)
 assert.deepEqual(result.manifest.companies.map(x=>x.companyId),['org-b'])
})
