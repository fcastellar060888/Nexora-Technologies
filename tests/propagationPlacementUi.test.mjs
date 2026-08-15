import test from'node:test'
import assert from'node:assert/strict'
import{readFile}from'node:fs/promises'

test('la página delega la asignación física al formulario y el formulario al Action Engine canónico',async()=>{
 const page=await readFile(new URL('../src/pages/PropagationPage.jsx',import.meta.url),'utf8')
 const form=await readFile(new URL('../src/components/PurposeAwarePropagationForm.jsx',import.meta.url),'utf8')
 const command=await readFile(new URL('../src/services/propagationBatchCommand.js',import.meta.url),'utf8')
 assert.match(page,/PurposeAwarePropagationForm/)
 assert.match(form,/executePlantAction/)
 assert.match(form,/CREATE_PROPAGATION_BATCH/)
 assert.doesNotMatch(form,/executePropagationBatchCommand/)
 assert.match(form,/bankId/)
 assert.match(form,/posiciones libres/)
 assert.match(form,/Crear corte y ubicar esquejes/)
 assert.doesNotMatch(form,/propagationUnits:\s*\[/)
 assert.match(command,/allocateUnitsToBank/)
 assert.match(command,/propagationUnits:\[\.\.\.\(current\.propagationUnits\|\|\[\]\),\.\.\.prepared\.units\]/)
})

test('el mapa usa la misma definición de posiciones de bandeja',async()=>{
 const bank=await readFile(new URL('../src/components/UnifiedMapBankContents.jsx',import.meta.url),'utf8')
 const drawer=await readFile(new URL('../src/components/UnifiedMapCuttingDrawer.jsx',import.meta.url),'utf8')
 assert.match(bank,/bankTrayPositions/)
 assert.match(bank,/group\.positions/)
 assert.match(bank,/traySlot/)
 assert.match(drawer,/propagationUnitId===plant\.id/)
})
