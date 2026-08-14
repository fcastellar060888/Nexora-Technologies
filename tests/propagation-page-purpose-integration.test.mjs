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
 for(const label of['Nuevo banco de propagación','Agregar tipo de bandeja','Bandejas y medio de propagación','Cavidades'])assert.match(source,new RegExp(label))
 assert.match(source,/bankCapacity\(bank\.trays\)/)
 assert.match(source,/bankOccupancy/)
})

test('integra sin pérdida los metadatos de bancos y bandejas provenientes de main',async()=>{
 const source=await readFile('src/components/PropagationBankManager.jsx','utf8')
 for(const field of['substrate','usesJiffy','plugType','plugSize','volumePerCavityMl','mediumLot'])assert.match(source,new RegExp(field))
 for(const label of['Medio','Usa jiffy','Tipo de plug','Tamaño del plug','Volumen/cavidad','Lote del medio'])assert.match(source,new RegExp(label))
 assert.match(source,/item\.trayCount/)
 assert.match(source,/item\.cavitiesPerTray/)
})

test('impide archivar bancos vinculados a lotes o esquejes activos',async()=>{
 const manager=await readFile('src/components/PropagationBankManager.jsx','utf8')
 const lifecycle=await readFile('src/domain/facilityLifecycle.js','utf8')
 assert.match(manager,/archivePropagationBank/)
 assert.match(lifecycle,/unit\?\.bankId===bankId\|\|unit\?\.propagationBankId===bankId/)
 assert.match(lifecycle,/batch\?\.bankId===bankId\|\|batch\?\.propagationBankId===bankId/)
 assert.match(lifecycle,/El banco tiene/)
})
