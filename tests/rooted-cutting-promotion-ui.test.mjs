import test from'node:test'
import assert from'node:assert/strict'
import{readFile}from'node:fs/promises'

test('el detalle de lote integra la promoción de esquejes enraizados',async()=>{
 const page=await readFile(new URL('../src/pages/LotDetailStablePage.jsx',import.meta.url),'utf8')
 const route=await readFile(new URL('../src/pages/LotDetailPage.jsx',import.meta.url),'utf8')
 assert.match(page,/RootedCuttingPromotionPanel/)
 assert.match(route,/LotDetailStablePage/)
})

test('la promoción reutiliza selección universal y confirmación explícita',async()=>{
 const source=await readFile(new URL('../src/components/RootedCuttingPromotionPanel.jsx',import.meta.url),'utf8')
 assert.match(source,/createSelection/)
 assert.match(source,/toggleSelection/)
 assert.match(source,/selectAll/)
 assert.match(source,/clearSelection/)
 assert.match(source,/createBulkActionRequest/)
 assert.match(source,/Confirma explícitamente la promoción/)
 assert.match(source,/Promover selección/)
})

test('producción exige nave y cama y los propósitos no confirmados no se ejecutan',async()=>{
 const source=await readFile(new URL('../src/components/RootedCuttingPromotionPanel.jsx',import.meta.url),'utf8')
 assert.match(source,/PROMOTION_TARGETS\.PRODUCTION/)
 assert.match(source,/Selecciona nave y cama/)
 assert.match(source,/permanece en evaluación/)
 assert.match(source,/promotePropagationUnits/)
})
