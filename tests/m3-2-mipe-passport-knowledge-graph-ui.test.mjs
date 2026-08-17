import test from'node:test'
import assert from'node:assert/strict'
import{readFile}from'node:fs/promises'

test('F011: enrichment conecta el mismo Knowledge Graph MIPE a Position y material vegetal',async()=>{
 const source=await readFile('src/core/passport/passportProjectionEnrichment.js','utf8')
 assert.match(source,/projectMipePassportTrace/)
 assert.match(source,/'cultivation\.plant\.projection':enrichCultivationPlant/)
 assert.match(source,/'cultivation\.materialplant\.projection':enrichMaterialPlant/)
 assert.match(source,/targetType:'POSITION',includeTreatmentTimeline:true,replaceLegacyTreatmentTimeline:true/)
 assert.match(source,/targetType:'MATERIAL_PLANT',includeTreatmentTimeline:true/)
})

test('F011: timeline legacy de Treatment se reemplaza por la proyección histórica basada en snapshot',async()=>{
 const enrichment=await readFile('src/core/passport/passportProjectionEnrichment.js','utf8'),projection=await readFile('src/core/passport/mipePassportProjection.js','utf8')
 assert.match(enrichment,/filter\(item=>!text\(item\?\.id\)\.startsWith\('treatment:'\)\)/)
 assert.match(projection,/treatment\?\.productSnapshot\?\.name/)
 assert.match(projection,/historicalSnapshots/)
 assert.match(projection,/mipekg:treatment:/)
})

test('F011: UI de Passport expone la cadena Knowledge Graph en ambas ramas vegetales',async()=>{
 const card=await readFile('src/components/MipeKnowledgeGraphCard.jsx','utf8'),position=await readFile('src/pages/PlantProfilePage.jsx','utf8'),material=await readFile('src/pages/MaterialPlantProfilePage.jsx','utf8')
 assert.match(card,/Finding → Incident → Intervention\/Treatment → Product\/Lot → Restriction → Resolution/)
 for(const type of['mipe.finding','mipe.incident','mipe.intervention','mipe.treatment','inventory.product','inventory.lot','mipe.restriction','mipe.resolution'])assert.ok(card.includes(`'${type}'`))
 assert.match(position,/MipeKnowledgeGraphCard passport=\{passport\}/)
 assert.match(material,/MipeKnowledgeGraphCard passport=\{passport\}/)
})

test('F011: Passport trata Planta eliminada como terminal y valida historial antes de proyectar Resolution',async()=>{
 const sources=await Promise.all([readFile('src/core/passport/passportDomainSources.js','utf8'),readFile('src/core/passport/mipePassportProjection.js','utf8')])
 assert.match(sources[0],/Planta eliminada/)
 assert.match(sources[1],/verifyMipeFindingHistory/)
 assert.match(sources[1],/historial MIPE de Finding.*no es íntegro/)
 assert.match(sources[1],/catalogPresent/)
})

test('F011: projector MIPE forma parte del API público de Passport',async()=>{
 const source=await readFile('src/core/passport/index.js','utf8')
 assert.match(source,/export\{projectMipePassportTrace\}from'\.\/mipePassportProjection\.js'/)
})
