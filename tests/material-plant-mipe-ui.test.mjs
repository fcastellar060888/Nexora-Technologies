import test from'node:test'
import assert from'node:assert/strict'
import{readFile}from'node:fs/promises'

test('el panel MIPE exige confirmación para selección múltiple y delega el commit al command boundary',async()=>{
 const source=await readFile(new URL('../src/components/MaterialPlantMipePanel.jsx',import.meta.url),'utf8')
 assert.match(source,/count>1&&!draft\.confirmed/)
 assert.match(source,/Confirma el registro MIPE masivo/)
 assert.match(source,/useMipeCommandStore/)
 assert.match(source,/MIPE_OPERATIONS\.CREATE_MATERIAL_FINDINGS/)
 assert.match(source,/plantIds:plants\.map\(item=>item\.id\)/)
 assert.doesNotMatch(source,/appendMaterialPlantFindings/)
 assert.doesNotMatch(source,/publishDomainEvent/)
})

test('el panel conserva uso individual sin confirmación adicional',async()=>{
 const source=await readFile(new URL('../src/components/MaterialPlantMipePanel.jsx',import.meta.url),'utf8')
 assert.match(source,/Registrar MIPE individual/)
 assert.match(source,/count>1&&<label/)
 assert.match(source,/Registrar hallazgo MIPE/)
 assert.match(source,/Severidad MIPE/)
})

test('el explorador conecta MIPE individual y masivo a la selección existente',async()=>{
 const source=await readFile(new URL('../src/components/MaterialPlantUnitExplorer.jsx',import.meta.url),'utf8')
 assert.match(source,/import MaterialPlantMipePanel/)
 assert.match(source,/plants=\{selectedUnits\}/)
 assert.match(source,/plants=\{\[active\]\}/)
 assert.match(source,/onComplete=\{\(\)=>setSelection\(current=>clearSelection\(current\)\)\}/)
 assert.match(source,/MIPE abiertos/)
})
