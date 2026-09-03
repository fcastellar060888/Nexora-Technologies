import test from'node:test'
import assert from'node:assert/strict'
import{readFile}from'node:fs/promises'

test('el Dashboard MIPE ofrece filtros y acciones rápidas de revisión por command boundary',async()=>{
 const source=await readFile('src/pages/MipeDashboardPage.jsx','utf8')
 assert.match(source,/scopeOperationalState/)
 assert.match(source,/Filtrar tareas por estado/)
 assert.match(source,/Filtrar tareas por responsable/)
 assert.match(source,/Registrar seguimiento/)
 assert.match(source,/Reasignar/)
 assert.match(source,/Ver Passport/)
 assert.match(source,/\/material-plant\//)
 assert.match(source,/useMipeCommandStore/)
 assert.match(source,/MIPE_OPERATIONS\.RECORD_INTERVENTION/)
 assert.match(source,/MIPE_OPERATIONS\.REASSIGN_INTERVENTION/)
 assert.match(source,/type:'Seguimiento'/)
 assert.doesNotMatch(source,/appendMipeIntervention/)
 assert.doesNotMatch(source,/reassignMipeReviewTask/)
})
