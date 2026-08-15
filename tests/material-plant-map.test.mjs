import test from'node:test'
import assert from'node:assert/strict'
import{readFile}from'node:fs/promises'

test('la capa de material vegetal proyecta abuelas y madres individuales',async()=>{
 const source=await readFile('src/components/MaterialPlantMapContents.jsx','utf8')
 assert.match(source,/projectLotPlantUnits/)
 assert.match(source,/MATERIAL_PLANT_TYPES\.GRANDMOTHER/)
 assert.match(source,/state\.grandmotherPlants/)
 assert.match(source,/state\.motherPlants/)
 assert.match(source,/unified-plant-cell/)
 assert.match(source,/kind:'material'/)
})

test('cada planta de material vegetal abre Passport universal sin salir del mapa',async()=>{
 const source=await readFile('src/components/MaterialPlantMapContents.jsx','utf8')
 assert.match(source,/createMaterialPlantPassportFromState/)
 assert.match(source,/MaterialPlantMapDrawer/)
 assert.match(source,/unified-map-drawer/)
 assert.match(source,/Passport universal/)
 assert.match(source,/Genealogía y relaciones/)
 assert.match(source,/Timeline/)
})
