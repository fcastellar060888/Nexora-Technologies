import test from'node:test'
import assert from'node:assert/strict'
import{readFile}from'node:fs/promises'

test('AUD-F016: el Store descarta resultados y telemetría tras cambiar de empresa',async()=>{
 const source=await readFile(new URL('../src/services/store.jsx',import.meta.url),'utf8')
 const guards=source.match(/stateRef\.current\.currentContext\?\.companyId!==companyId/g)||[]
 assert.ok(guards.length>=3)
 assert.match(source,/reason:'stale-company-context'/)
 assert.match(source,/broadcast\('sync-started',\{companyId,reason\}\)/)
 assert.match(source,/broadcast\('sync-result',\{companyId,completedAt/)
 assert.match(source,/broadcast\('sync-result',\{companyId,completedAt:new Date\(\)\.toISOString\(\),error:message/)
})
