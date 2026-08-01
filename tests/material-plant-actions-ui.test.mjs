import test from'node:test'
import assert from'node:assert/strict'
import{readFile}from'node:fs/promises'

test('el explorador permite cambios individuales y masivos confirmados',async()=>{
 const source=await readFile('src/components/MaterialPlantUnitExplorer.jsx','utf8')
 assert.match(source,/Aplicar cambios masivos/)
 assert.match(source,/Confirmo aplicar esta acción/)
 assert.match(source,/Guardar planta/)
 assert.match(source,/applyMaterialPlantUnitPatch/)
 assert.match(source,/publishDomainEvent/)
 assert.match(source,/material\.plant\.updated/)
})

test('las páginas entregan update al explorador reutilizable',async()=>{
 const grandmother=await readFile('src/pages/GrandmotherPlantsPage.jsx','utf8')
 const mother=await readFile('src/pages/MotherPlantsPage.jsx','utf8')
 assert.match(grandmother,/MaterialPlantUnitExplorer state=\{state\} update=\{update\}/)
 assert.match(mother,/MaterialPlantUnitExplorer state=\{state\} update=\{update\}/)
})
