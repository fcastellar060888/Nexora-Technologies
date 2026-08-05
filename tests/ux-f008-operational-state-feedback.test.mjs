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

test('MIPE findings distinguish empty data, filtered results and healthy follow-ups',async()=>{
 const source=await read('src/pages/FindingsPage.jsx')
 assert.match(source,/import StateMessage/)
 assert.match(source,/import DateTimeFields/)
 assert.match(source,/No hay hallazgos MIPE/)
 assert.match(source,/Sin coincidencias/)
 assert.match(source,/type="success" title="Seguimientos al día"/)
 assert.match(source,/DateTimeFields value=/)
 assert.doesNotMatch(source,/type="datetime-local"/)
})

test('MIPE treatments expose missing prerequisites and inventory blocks',async()=>{
 const source=await read('src/pages/TreatmentsPage.jsx')
 assert.match(source,/import StateMessage/)
 assert.match(source,/No hay hallazgos abiertos/)
 assert.match(source,/No hay productos MIPE disponibles/)
 assert.match(source,/No hay tratamientos programados/)
 assert.match(source,/Sin lote disponible/)
 assert.match(source,/disabled=\{!canSchedule\}/)
})

test('MIRFE programs explain the empty configuration state',async()=>{
 const source=await read('src/pages/MirfeProgramsPage.jsx')
 assert.match(source,/import StateMessage/)
 assert.match(source,/No hay programas MIRFE configurados/)
 assert.match(source,/Crea el primer programa para definir reglas de activación/)
 assert.match(source,/!state\.mirfePrograms\.length\?<StateMessage/)
})

test('MIRFE monitoring blocks incomplete context and explains empty history',async()=>{
 const source=await read('src/pages/MirfeMonitoringPage.jsx')
 assert.match(source,/import StateMessage/)
 assert.match(source,/const prerequisitesReady=/)
 assert.match(source,/Configuración incompleta/)
 assert.match(source,/disabled=\{!canSave\}/)
 assert.match(source,/No hay monitoreos registrados/)
 assert.match(source,/!state\.mirfeMonitoring\.length\?<StateMessage/)
})

test('MIRFE reinforcements explain optional origins and block missing prerequisites',async()=>{
 const source=await read('src/pages/MirfeReinforcementsPage.jsx')
 assert.match(source,/import StateMessage/)
 assert.match(source,/Configuración incompleta/)
 assert.match(source,/Sin programas MIRFE/)
 assert.match(source,/Sin monitoreo de origen/)
 assert.match(source,/disabled=\{!canCreate\}/)
 assert.match(source,/No hay órdenes MIRFE/)
 assert.match(source,/const houseId=state\.houses\.find\(x=>x\.siteId===siteId\)\?\.id\|\|''/)
})

test('feedback styles respect mobile safe areas and reduced motion',async()=>{
 const css=await read('src/styles/state-feedback.css')
 assert.match(css,/safe-area-inset-bottom/)
 assert.match(css,/prefers-reduced-motion:reduce/)
 assert.match(css,/state-message-loading/)
})
