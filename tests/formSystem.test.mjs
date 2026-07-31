import test from'node:test'
import assert from'node:assert/strict'
import{readFile}from'node:fs/promises'

test('Nexora form system uses shared tokens and accessible states',async()=>{
 const css=await readFile(new URL('../src/styles/form-system.css',import.meta.url),'utf8')
 const tokens=await readFile(new URL('../src/styles/tokens.css',import.meta.url),'utf8')
 assert.match(css,/\.form-grid\{[^}]*row-gap:var\(--nx-space-5\)/)
 assert.match(css,/min-height:var\(--nx-control-height\)/)
 assert.match(css,/:focus\{[^}]*box-shadow:var\(--nx-focus-ring\)/)
 assert.match(css,/\[aria-invalid="true"\]/)
 assert.match(css,/@media\(max-width:760px\)/)
 assert.match(css,/font-size:16px/)
 assert.match(tokens,/--nx-space-5:/)
 assert.match(tokens,/--nx-control-height:/)
 assert.match(tokens,/--nx-focus-ring:/)
})

test('visible product branding is Nexora One',async()=>{
 const files=['../index.html','../src/components/AppShell.jsx','../package.json']
 for(const path of files){
  const content=await readFile(new URL(path,import.meta.url),'utf8')
  assert.doesNotMatch(content,/Cannapa ERP|cannapa-erp|Canapa ERP/)
 }
})

test('realtime context reacts to operational changes from other devices',async()=>{
 const source=await readFile(new URL('../src/services/realtimeContext.jsx',import.meta.url),'utf8')
 assert.match(source,/operational-change/)
 assert.match(source,/actorId!==actorId/)
 assert.match(source,/hydrateFromPostgres/)
 assert.match(source,/REFRESH_DELAY_MS/)
})
