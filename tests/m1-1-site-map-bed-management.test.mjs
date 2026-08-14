import test from'node:test'
import assert from'node:assert/strict'
import{readFile}from'node:fs/promises'

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8')

test('houses page manages beds independently from house creation',async()=>{
 const source=await read('src/pages/HousesPage.jsx')
 assert.match(source,/BedManager/)
 assert.doesNotMatch(source,/Nombre cama inicial/)
 assert.doesNotMatch(source,/generatePlantPositions/)
 assert.match(source,/tantas naves y tantas camas por nave/)
})

test('bed manager supports multiple beds inside the same house',async()=>{
 const source=await read('src/components/BedManager.jsx')
 assert.match(source,/Agregar cama a una nave/)
 assert.match(source,/state\.beds\.some\(b=>b\.id!==editingId&&b\.houseId===form\.houseId/)
 assert.match(source,/beds:\[\.\.\.s\.beds,bed\]/)
 assert.match(source,/FACILITY_BED_CREATED/)
 assert.match(source,/FACILITY_BED_UPDATED/)
 assert.match(source,/FACILITY_BED_ARCHIVED/)
})

test('cultivation map starts from the whole site and keeps MIPE risk visible',async()=>{
 const page=await read('src/pages/UnifiedCultivationMapPage.jsx')
 const overview=await read('src/components/SiteOverviewMap.jsx')
 const canvas=await read('src/components/UnifiedMapCanvas.jsx')
 const plants=await read('src/components/UnifiedMapHouseContents.jsx')
 assert.match(page,/Mapa unificado del cultivo/)
 assert.match(page,/SiteOverviewMap/)
 assert.match(canvas,/Plano operativo/)
 assert.match(plants,/hallazgos abiertos/)
 assert.match(overview,/Plano maestro de la sede/)
 assert.match(overview,/facilityAreas/)
 assert.match(overview,/danger-tag/)
 assert.match(overview,/severity/)
})
