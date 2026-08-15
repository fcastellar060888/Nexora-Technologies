import test from'node:test'
import assert from'node:assert/strict'
import{readFile}from'node:fs/promises'

test('registra una ruta directa para el Passport de material vegetal',async()=>{
 const app=await readFile('src/App.jsx','utf8')
 assert.match(app,/MaterialPlantProfilePage/)
 assert.match(app,/path="\/material-plant\/:plantId"/)
})

test('el Dashboard MIPE abre el Passport individual exacto',async()=>{
 const dashboard=await readFile('src/pages/MipeDashboardPage.jsx','utf8')
 assert.match(dashboard,/\/material-plant\//)
 assert.match(dashboard,/selectedTask\.materialPlantId/)
 assert.match(dashboard,/Ver Passport/)
 assert.doesNotMatch(dashboard,/Abrir planta/)
})

test('el Passport directo usa el contrato universal de material vegetal',async()=>{
 const page=await readFile('src/pages/MaterialPlantProfilePage.jsx','utf8')
 assert.match(page,/createMaterialPlantPassportFromState/)
 assert.match(page,/useParams/)
 assert.match(page,/available_for_cutting/)
 assert.match(page,/open_mipe_findings/)
 assert.match(page,/Línea de tiempo completa/)
})
