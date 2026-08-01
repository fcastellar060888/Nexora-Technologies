import test from'node:test'
import assert from'node:assert/strict'
import{readFile}from'node:fs/promises'

test('el mapa reutiliza el motor universal para selección individual múltiple y total',async()=>{
 const source=await readFile('src/pages/UnifiedCultivationMapPage.jsx','utf8')
 assert.match(source,/createSelection/)
 assert.match(source,/toggleSelection/)
 assert.match(source,/selectAll/)
 assert.match(source,/clearSelection/)
 assert.match(source,/selectionSummary/)
 assert.match(source,/aria-pressed/)
 assert.match(source,/Seleccionar todas/)
 assert.match(source,/Limpiar selección/)
})

test('la acción masiva exige confirmación y reconcilia objetivos disponibles',async()=>{
 const source=await readFile('src/pages/UnifiedCultivationMapPage.jsx','utf8')
 assert.match(source,/createBulkActionRequest/)
 assert.match(source,/availableIds:availablePlantIds/)
 assert.match(source,/requiresConfirmation|confirmed/)
 assert.match(source,/Confirmo registrar esta observación/)
 assert.match(source,/request\.targetIds\.map/)
 assert.match(source,/Observación masiva registrada/)
})

test('el cambio de sede limpia selección y borrador para evitar acciones cruzadas',async()=>{
 const source=await readFile('src/pages/UnifiedCultivationMapPage.jsx','utf8')
 assert.match(source,/setSelection\(selectionFor\(nextSiteId\)\)/)
 assert.match(source,/setSelectionMode\(false\)/)
 assert.match(source,/setBulkDraft\(\{title:'',detail:'',confirmed:false\}\)/)
})
