import test from'node:test'
import assert from'node:assert/strict'
import{readFile}from'node:fs/promises'

test('Canapa form system defines consistent spacing and focus states',async()=>{
 const css=await readFile(new URL('../src/styles/form-system.css',import.meta.url),'utf8')
 assert.match(css,/\.form-grid\{[^}]*row-gap:16px/)
 assert.match(css,/min-height:46px/)
 assert.match(css,/:focus\{outline:0;border-color:var\(--teal\)/)
 assert.match(css,/@media\(max-width:760px\)/)
 assert.match(css,/font-size:16px/)
})

test('visible product branding uses Canapa with one n',async()=>{
 const files=['../index.html','../src/components/AppShell.jsx','../package.json']
 for(const path of files){
  const content=await readFile(new URL(path,import.meta.url),'utf8')
  assert.doesNotMatch(content,/Cannapa ERP|cannapa-erp/)
 }
})

test('realtime context reacts to operational changes from other devices',async()=>{
 const source=await readFile(new URL('../src/services/realtimeContext.jsx',import.meta.url),'utf8')
 assert.match(source,/operational-change/)
 assert.match(source,/actorId!==actorId/)
 assert.match(source,/hydrateFromPostgres/)
 assert.match(source,/REFRESH_DELAY_MS/)
})
