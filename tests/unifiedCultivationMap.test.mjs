import test from'node:test'
import assert from'node:assert/strict'
import{readFile}from'node:fs/promises'

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8')

test('el mapa usa una sola vista para naves, bancos, camas y bandejas',async()=>{
 const page=await read('src/pages/UnifiedCultivationMapPage.jsx')
 const canvas=await read('src/components/UnifiedMapCanvas.jsx')
 const houses=await read('src/components/UnifiedMapHouseContents.jsx')
 const banks=await read('src/components/UnifiedMapBankContents.jsx')
 const source=page+canvas+houses+banks
 assert.match(source,/HouseContents/)
 assert.match(source,/BankContents/)
 assert.match(source,/unified-plant-grid/)
 assert.match(source,/unified-tray-grid/)
 assert.doesNotMatch(source,/HouseInterior/)
})

test('cada planta y esqueje abre información contextual',async()=>{
 const page=await read('src/pages/UnifiedCultivationMapPage.jsx')
 const houses=await read('src/components/UnifiedMapHouseContents.jsx')
 const cutting=await read('src/components/UnifiedMapCuttingDrawer.jsx')
 const passportDrawer=await read('src/components/PlantPassportDrawer.jsx')
 const source=page+houses+cutting
 assert.match(page,/PlantPassportDrawer/)
 assert.match(page,/PlantDrawer/)
 assert.match(houses,/plantPositionId/)
 assert.match(cutting,/propagationUnitId/)
 assert.match(passportDrawer,/Abrir perfil completo/)
 assert.match(source+passportDrawer,/Hallazgos abiertos/)
})

test('la ruta histórica del mapa delega a la vista unificada',async()=>{
 const source=await read('src/pages/CultivationMapPage.jsx')
 assert.match(source,/UnifiedCultivationMapPage/)
 const css=await read('src/styles/unified-cultivation-map.css')
 assert.match(css,/\.unified-map-object/)
 assert.match(css,/\.unified-map-drawer/)
})
