import test from'node:test'
import assert from'node:assert/strict'
import{readFile}from'node:fs/promises'

test('el mapa unificado integra la capa individual de abuelas y madres por sede',async()=>{
 const source=await readFile('src/pages/UnifiedCultivationMapPage.jsx','utf8')
 assert.match(source,/MaterialPlantMapLayer/)
 assert.match(source,/Material vegetal individual/)
 assert.match(source,/siteId=\{siteId\}/)
 assert.match(source,/mismo contexto operativo/)
})
