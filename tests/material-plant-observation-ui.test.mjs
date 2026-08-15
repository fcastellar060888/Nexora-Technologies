import test from'node:test'
import assert from'node:assert/strict'
import{readFile}from'node:fs/promises'

test('el explorador integra observaciones individuales y masivas sin sobrescribir la ficha',async()=>{
 const explorer=await readFile(new URL('../src/components/MaterialPlantUnitExplorer.jsx',import.meta.url),'utf8')
 const panel=await readFile(new URL('../src/components/MaterialPlantObservationPanel.jsx',import.meta.url),'utf8')
 assert.match(explorer,/MaterialPlantObservationPanel/)
 assert.match(explorer,/plants=\{selectedUnits\}/)
 assert.match(explorer,/plants=\{\[active\]\}/)
 assert.match(panel,/appendMaterialPlantObservation/)
 assert.match(panel,/material\.plant\.observation-recorded/)
 assert.match(panel,/Confirmo registrar esta observación/)
 assert.match(panel,/Observación registrada/)
})

test('la acción masiva exige confirmación y conserva objetivos individuales',async()=>{
 const panel=await readFile(new URL('../src/components/MaterialPlantObservationPanel.jsx',import.meta.url),'utf8')
 assert.match(panel,/count>1&&!draft\.confirmed/)
 assert.match(panel,/for\(const plant of plants\)/)
 assert.match(panel,/aggregateId:plant\.id/)
 assert.match(panel,/targetCount:count/)
})
