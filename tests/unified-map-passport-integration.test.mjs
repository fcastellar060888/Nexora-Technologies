import test from'node:test'
import assert from'node:assert/strict'
import{readFile}from'node:fs/promises'

test('el mapa abre plantas productivas con el mismo Passport universal de la ficha',async()=>{
 const map=await readFile('src/pages/UnifiedCultivationMapPage.jsx','utf8')
 const drawer=await readFile('src/components/PlantPassportDrawer.jsx','utf8')
 assert.match(map,/PlantPassportDrawer/)
 assert.match(map,/plantId=\{selectedPlant\.plant\.id\}/)
 assert.match(map,/navigate\(`\/plant\/\$\{selectedPlant\.plant\.id\}`\)/)
 assert.match(drawer,/createCultivationPlantPassportFromState/)
 assert.match(drawer,/passport\.relationships/)
 assert.match(drawer,/passport\.indicators/)
 assert.match(drawer,/passport\.risks/)
 assert.match(drawer,/passport\.documents/)
 assert.match(drawer,/passport\.timeline/)
})

test('la integración conserva el panel contextual independiente para esquejes',async()=>{
 const map=await readFile('src/pages/UnifiedCultivationMapPage.jsx','utf8')
 assert.match(map,/selectedPlant\.kind==='plant'\?/) 
 assert.match(map,/propagationUnitId===plant\.id/)
 assert.match(map,/aria-label="Información del esqueje"/)
})
