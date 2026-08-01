import test from'node:test'
import assert from'node:assert/strict'
import{readFile}from'node:fs/promises'

test('el formulario asigna lotes a bancos y posiciones físicas',async()=>{
 const source=await readFile(new URL('../src/pages/PropagationPage.jsx',import.meta.url),'utf8')
 assert.match(source,/allocateUnitsToBank/)
 assert.match(source,/bankId/)
 assert.match(source,/posiciones disponibles/)
 assert.match(source,/Crear lote y ubicar esquejes/)
 assert.match(source,/propagationUnits:\[\.\.\.store\.propagationUnits,\.\.\.units\]/)
})

test('el mapa usa la misma definición de posiciones de bandeja',async()=>{
 const source=await readFile(new URL('../src/pages/UnifiedCultivationMapPage.jsx',import.meta.url),'utf8')
 assert.match(source,/bankTrayPositions/)
 assert.match(source,/group\.positions/)
 assert.match(source,/traySlot/)
 assert.match(source,/propagationUnitId/)
})
