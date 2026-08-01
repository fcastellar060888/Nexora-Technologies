import test from'node:test'
import assert from'node:assert/strict'
import{readFile}from'node:fs/promises'

test('la ficha visual consume la proyección universal de Passport',async()=>{
 const source=await readFile('src/pages/PlantProfilePage.jsx','utf8')
 assert.match(source,/createCultivationPlantPassportFromState/)
 assert.match(source,/Passport universal/)
 assert.match(source,/passport\.relationships/)
 assert.match(source,/passport\.indicators/)
 assert.match(source,/const\{object,timeline\}=passport/)
 assert.doesNotMatch(source,/plantTimeline\(/)
 assert.doesNotMatch(source,/tracePlant\(/)
})

test('la ficha conserva fotografías y escritura de eventos compatibles',async()=>{
 const source=await readFile('src/pages/PlantProfilePage.jsx','utf8')
 assert.match(source,/AttachmentUploader entityType="plant" entityId=\{plantId\}/)
 assert.match(source,/plantEvents:\[\.\.\.\(s\.plantEvents\|\|\[\]\)/)
 assert.match(source,/MIPE/)
 assert.match(source,/MIRFE/)
})
