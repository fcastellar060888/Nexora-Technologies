import test from'node:test'
import assert from'node:assert/strict'
import{readFile}from'node:fs/promises'

test('el explorador de material vegetal reutiliza selección universal',async()=>{
 const source=await readFile('src/components/MaterialPlantUnitExplorer.jsx','utf8')
 assert.match(source,/createSelection/)
 assert.match(source,/toggleSelection/)
 assert.match(source,/selectAll/)
 assert.match(source,/clearSelection/)
 assert.match(source,/selectionSummary/)
 assert.match(source,/Seleccionar todas/)
 assert.match(source,/aria-pressed/)
})

test('abuelas y madres exponen plantas individuales con el mismo componente',async()=>{
 const grandmother=await readFile('src/pages/GrandmotherPlantsPage.jsx','utf8')
 const mother=await readFile('src/pages/MotherPlantsPage.jsx','utf8')
 for(const source of[grandmother,mother]){
  assert.match(source,/MaterialPlantUnitExplorer/)
  assert.match(source,/MATERIAL_PLANT_TYPES/)
  assert.match(source,/Plantas individuales/)
 }
 assert.match(grandmother,/MATERIAL_PLANT_TYPES\.GRANDMOTHER/)
 assert.match(mother,/MATERIAL_PLANT_TYPES\.MOTHER/)
})

test('la ficha universal conserva identidad lote genética sede sanidad y origen',async()=>{
 const source=await readFile('src/components/MaterialPlantUnitExplorer.jsx','utf8')
 for(const label of['Passport universal','Lote','Genética','Sede','Estado','Sanidad','Origen'])assert.match(source,new RegExp(label))
 assert.match(source,/createMaterialPlantPassportFromState/)
})
