import test from'node:test'
import assert from'node:assert/strict'
import{readFile}from'node:fs/promises'

test('el mapa usa una sola vista para naves, bancos, camas y bandejas',async()=>{
 const source=await readFile(new URL('../src/pages/UnifiedCultivationMapPage.jsx',import.meta.url),'utf8')
 assert.match(source,/HouseContents/)
 assert.match(source,/BankContents/)
 assert.match(source,/unified-plant-grid/)
 assert.match(source,/unified-tray-grid/)
 assert.doesNotMatch(source,/HouseInterior/)
})

test('cada planta y esqueje abre información contextual',async()=>{
 const source=await readFile(new URL('../src/pages/UnifiedCultivationMapPage.jsx',import.meta.url),'utf8')
 assert.match(source,/PlantDrawer/)
 assert.match(source,/plantPositionId/)
 assert.match(source,/propagationUnitId/)
 assert.match(source,/Abrir perfil completo/)
 assert.match(source,/Hallazgos abiertos/)
})

test('la ruta histórica del mapa delega a la vista unificada',async()=>{
 const source=await readFile(new URL('../src/pages/CultivationMapPage.jsx',import.meta.url),'utf8')
 assert.match(source,/UnifiedCultivationMapPage/)
 const css=await readFile(new URL('../src/styles/unified-cultivation-map.css',import.meta.url),'utf8')
 assert.match(css,/\.unified-map-object/)
 assert.match(css,/\.unified-map-drawer/)
})
