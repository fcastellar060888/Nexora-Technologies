import test from'node:test'
import assert from'node:assert/strict'
import{readFile}from'node:fs/promises'

test('el panel MIPE exige confirmación para selección múltiple',async()=>{
 const source=await readFile(new URL('../src/components/MaterialPlantMipePanel.jsx',import.meta.url),'utf8')
 assert.match(source,/count>1&&!draft\.confirmed/)
 assert.match(source,/Confirma el registro MIPE masivo/)
 assert.match(source,/appendMaterialPlantFindings/)
 assert.match(source,/mipe\.finding\.recorded/)
 assert.match(source,/targetCount:count/)
})

test('el panel conserva uso individual sin confirmación adicional',async()=>{
 const source=await readFile(new URL('../src/components/MaterialPlantMipePanel.jsx',import.meta.url),'utf8')
 assert.match(source,/Registrar MIPE individual/)
 assert.match(source,/count>1&&<label/)
 assert.match(source,/Registrar hallazgo MIPE/)
 assert.match(source,/Severidad MIPE/)
})
