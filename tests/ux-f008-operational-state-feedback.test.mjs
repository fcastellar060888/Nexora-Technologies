import test from'node:test'
import assert from'node:assert/strict'
import{readFile}from'node:fs/promises'

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8')

test('StateMessage exposes accessible status and alert semantics',async()=>{
 const source=await read('src/components/StateMessage.jsx')
 assert.match(source,/type==='error'\?'alert':'status'/)
 assert.match(source,/aria-live=/)
 assert.match(source,/actionLabel&&onAction/)
})

test('persistence failure uses the shared feedback component and retry action',async()=>{
 const source=await read('src/components/PersistenceHealthBridge.jsx')
 assert.match(source,/import StateMessage/)
 assert.match(source,/type=\{retrying\?'loading':'error'\}/)
 assert.match(source,/Reintentar guardado/)
 assert.doesNotMatch(source,/style=\{\{/)
})

test('infrastructure differentiates empty inventory from healthy maintenance state',async()=>{
 const source=await read('src/pages/InfrastructureOperationsPage.jsx')
 assert.match(source,/import StateMessage/)
 assert.match(source,/Sin activos registrados/)
 assert.match(source,/type="success" title="Sin mantenimientos pendientes"/)
 assert.match(source,/const pendingMaintenances=/)
 assert.doesNotMatch(source,/No hay activos registrados\.<\/p>/)
 assert.doesNotMatch(source,/No hay mantenimientos pendientes\.<\/p>/)
})

test('MIPE sanitary catalog explains the empty configuration state',async()=>{
 const source=await read('src/pages/IncidentsPage.jsx')
 assert.match(source,/import StateMessage/)
 assert.match(source,/No hay incidencias configuradas/)
 assert.match(source,/Registra la primera plaga, enfermedad, deficiencia o daño/)
 assert.match(source,/!state\.incidents\.length\?<StateMessage/)
})

test('feedback styles respect mobile safe areas and reduced motion',async()=>{
 const css=await read('src/styles/state-feedback.css')
 assert.match(css,/safe-area-inset-bottom/)
 assert.match(css,/prefers-reduced-motion:reduce/)
 assert.match(css,/state-message-loading/)
})
