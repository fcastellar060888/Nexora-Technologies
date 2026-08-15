import test from'node:test'
import assert from'node:assert/strict'
import{readFile}from'node:fs/promises'

const read=path=>readFile(path,'utf8')

test('el mapa reutiliza el motor universal para selección individual múltiple y total',async()=>{
 const page=await read('src/pages/UnifiedCultivationMapPage.jsx')
 const hook=await read('src/services/useUnifiedMapSelection.js')
 const panel=await read('src/components/UnifiedMapSelectionPanel.jsx')
 const plants=await read('src/components/UnifiedMapHouseContents.jsx')
 const source=page+hook+panel+plants
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
 const source=(await read('src/services/useUnifiedMapSelection.js'))+(await read('src/components/UnifiedMapSelectionPanel.jsx'))
 assert.match(source,/createBulkActionRequest/)
 assert.match(source,/availableIds:availablePlantIds/)
 assert.match(source,/confirmed/)
 assert.match(source,/Confirmo registrar esta observación/)
 assert.match(source,/request\.targetIds\.map/)
 assert.match(source,/Observación masiva registrada/)
})

test('el cambio de sede limpia selección y borrador para evitar acciones cruzadas',async()=>{
 const page=await read('src/pages/UnifiedCultivationMapPage.jsx')
 const hook=await read('src/services/useUnifiedMapSelection.js')
 assert.match(page,/selection\.resetForSite\(nextSiteId\)/)
 assert.match(hook,/setSelection\(selectionFor\(nextSiteId\)\)/)
 assert.match(hook,/setSelectionMode\(false\)/)
 assert.match(hook,/setBulkDraft\(emptyDraft\(\)\)/)
})
