import test from'node:test'
import assert from'node:assert/strict'
import{readFile}from'node:fs/promises'

test('las áreas físicas soportan capacidades exclusivas y compartidas',async()=>{
 const source=await readFile(new URL('../src/components/FacilityAreaManager.jsx',import.meta.url),'utf8')
 assert.match(source,/SPACE_CAPABILITIES/)
 assert.match(source,/Manicura/)
 assert.match(source,/Empaque/)
 assert.match(source,/capabilities\.length>1/)
 assert.match(source,/Área compartida/)
 assert.match(source,/facilityAreas/)
})

test('naves y camas permiten asignar un área física sin romper históricos',async()=>{
 const source=await readFile(new URL('../src/pages/HousesPage.jsx',import.meta.url),'utf8')
 assert.match(source,/FacilityAreaManager/)
 assert.match(source,/Área física/)
 assert.match(source,/Sin área asignada/)
 assert.match(source,/areaId/)
 assert.match(source,/state\.facilityAreas\|\|\[\]/)
})

test('un área con espacios vinculados conserva el guard de archivado',async()=>{
 const source=await readFile(new URL('../src/components/FacilityAreaManager.jsx',import.meta.url),'utf8')
 assert.match(source,/const linked=/)
 assert.match(source,/item\.areaId===area\.id&&item\.active!==false/)
 assert.match(source,/if\(linked\)return alert/)
 assert.match(source,/FACILITY_AREA_ARCHIVED/)
})
