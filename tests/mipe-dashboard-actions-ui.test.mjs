import test from'node:test'
import assert from'node:assert/strict'
import{readFile}from'node:fs/promises'

test('el Dashboard MIPE ofrece filtros y acciones rápidas de revisión',async()=>{
 const source=await readFile('src/pages/MipeDashboardPage.jsx','utf8')
 assert.match(source,/Filtrar tareas por sede/)
 assert.match(source,/Filtrar tareas por estado/)
 assert.match(source,/Filtrar tareas por responsable/)
 assert.match(source,/Registrar seguimiento/)
 assert.match(source,/Reasignar/)
 assert.match(source,/Abrir planta/)
 assert.match(source,/appendMipeIntervention/)
 assert.match(source,/reassignMipeReviewTask/)
})
