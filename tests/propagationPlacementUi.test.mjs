import test from'node:test'
import assert from'node:assert/strict'
import{readFile}from'node:fs/promises'

test('la página delega la asignación física al formulario de propagación por propósito',async()=>{
 const page=await readFile(new URL('../src/pages/PropagationPage.jsx',import.meta.url),'utf8')
 const form=await readFile(new URL('../src/components/PurposeAwarePropagationForm.jsx',import.meta.url),'utf8')
 assert.match(page,/PurposeAwarePropagationForm/)
 assert.match(form,/allocateUnitsToBank/)
 assert.match(form,/bankId/)
 assert.match(form,/posiciones disponibles/)
 assert.match(form,/Crear corte y ubicar esquejes/)
 assert.match(form,/propagationUnits:\[\.\.\.store\.propagationUnits,\.\.\.enrichedUnits\]/)
})

test('el mapa usa la misma definición de posiciones de bandeja',async()=>{
 const bank=await readFile(new URL('../src/components/UnifiedMapBankContents.jsx',import.meta.url),'utf8')
 const drawer=await readFile(new URL('../src/components/UnifiedMapCuttingDrawer.jsx',import.meta.url),'utf8')
 assert.match(bank,/bankTrayPositions/)
 assert.match(bank,/group\.positions/)
 assert.match(bank,/traySlot/)
 assert.match(drawer,/propagationUnitId===plant\.id/)
})
