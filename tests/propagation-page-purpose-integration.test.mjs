import test from'node:test'
import assert from'node:assert/strict'
import{readFile}from'node:fs/promises'

test('la página de propagación usa el flujo por propósito y origen individual',async()=>{
 const source=await readFile('src/pages/PropagationPage.jsx','utf8')
 assert.match(source,/PurposeAwarePropagationForm/)
 assert.match(source,/Crear corte de propagación/)
 assert.match(source,/Lotes por propósito/)
 assert.doesNotMatch(source,/Lote de madres/)
 assert.doesNotMatch(source,/function create\(event\)/)
})

test('la administración moderna de bancos y múltiples bandejas permanece disponible en Infraestructura',async()=>{
 const source=await readFile('src/components/PropagationBankManager.jsx','utf8')
 for(const label of['Nuevo banco de propagación','Agregar tipo de bandeja','Bandejas y contenedor de propagación','Cavidades'])assert.match(source,new RegExp(label))
 assert.match(source,/bankCapacity\(bank\.trays\)/)
 assert.match(source,/bankOccupancy/)
 assert.match(source,/growingMediumAssignmentId/)
})

test('conserva metadatos físicos de bandejas y migra la autoridad del medio a GrowingMediumAssignment',async()=>{
 const source=await readFile('src/components/PropagationBankManager.jsx','utf8')
 for(const field of['usesJiffy','plugType','plugSize','volumePerCavityMl','growingMediumAssignmentId'])assert.match(source,new RegExp(field))
 for(const label of['Usa jiffy','Tipo de plug','Tamaño del plug','Volumen/cavidad'])assert.match(source,new RegExp(label))
 assert.doesNotMatch(source,/Field label="Medio"/)
 assert.doesNotMatch(source,/Field label="Lote del medio"/)
 assert.match(source,/item\.trayCount/)
 assert.match(source,/item\.cavitiesPerTray/)
 assert.match(source,/substrate:item\.substrate/)
 assert.match(source,/mediumLot:item\.mediumLot/)
})

test('impide archivar bancos vinculados a lotes o esquejes activos',async()=>{
 const manager=await readFile('src/components/PropagationBankManager.jsx','utf8')
 const lifecycle=await readFile('src/domain/facilityLifecycle.js','utf8')
 assert.match(manager,/archivePropagationBank/)
 assert.match(lifecycle,/unit\?\.bankId===bankId\|\|unit\?\.propagationBankId===bankId/)
 assert.match(lifecycle,/batch\?\.bankId===bankId\|\|batch\?\.propagationBankId===bankId/)
 assert.match(lifecycle,/El banco tiene/)
})
