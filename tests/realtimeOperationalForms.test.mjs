import test from 'node:test'
import assert from 'node:assert/strict'
import{readFile}from'node:fs/promises'

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8')

test('audited state changes emit the legacy-compatible operational event',async()=>{
 const source=await read('src/services/safeStorage.js')
 assert.match(source,/canapa:operational-change/)
 assert.match(source,/auditId:audit\.id/)
 assert.match(source,/organizationId:state\.currentContext\?\.companyId/)
})

test('Realtime listens for operational changes and form editing activity',async()=>{
 const source=await read('src/services/realtimeContext.jsx')
 assert.match(source,/addEventListener\('canapa:operational-change'/)
 assert.match(source,/editor-start/)
 assert.match(source,/editor-stop/)
 assert.match(source,/focusin/)
 assert.match(source,/focusout/)
})

test('visible product branding is Nexora One',async()=>{
 const shell=await read('src/components/AppShell.jsx')
 assert.match(shell,/Nexora One/)
 assert.match(shell,/Nexora Technologies/)
 assert.doesNotMatch(shell,/Canapa ERP/i)
 assert.doesNotMatch(shell,/Cannapa ERP/i)
})
