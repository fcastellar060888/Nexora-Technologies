import test from'node:test'
import assert from'node:assert/strict'
import{readFile}from'node:fs/promises'
import{createTimelineEngine}from'../src/core/timeline/timelineEngine.js'

test('el Timeline notifica registros nuevos y limpieza',()=>{
 const engine=createTimelineEngine(),versions=[]
 const unsubscribe=engine.subscribe(()=>versions.push(engine.size()))
 engine.record({id:'one',occurredAt:'2026-07-31T20:00:00.000Z'})
 engine.clear()
 unsubscribe()
 assert.deepEqual(versions,[1,0])
})

test('la interfaz visual ofrece búsqueda, categorías y estados vacíos',async()=>{
 const source=await readFile(new URL('../src/core/timeline/TimelineFeed.jsx',import.meta.url),'utf8')
 assert.match(source,/Buscar actividad/)
 assert.match(source,/Filtrar por categoría/)
 assert.match(source,/timeline-empty/)
 assert.match(source,/dateTime=/)
 const css=await readFile(new URL('../src/styles/timeline.css',import.meta.url),'utf8')
 assert.match(css,/\.timeline-list/)
 assert.match(css,/@media\(max-width:760px\)/)
})

test('Empresas, Sedes y Usuarios reutilizan TimelineFeed',async()=>{
 for(const path of['../src/pages/CompaniesPage.jsx','../src/pages/SitesPage.jsx','../src/pages/UsersPage.jsx']){
  const source=await readFile(new URL(path,import.meta.url),'utf8')
  assert.match(source,/TimelineFeed/)
  assert.match(source,/aggregateType=/)
 }
})
