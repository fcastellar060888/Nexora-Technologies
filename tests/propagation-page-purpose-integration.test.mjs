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

test('la administración moderna de bancos y múltiples bandejas permanece disponible',async()=>{
 const source=await readFile('src/pages/PropagationPage.jsx','utf8')
 for(const label of['Nuevo banco de propagación','Bancos registrados','Agregar tipo de bandeja','Bandejas y medio de propagación','Cavidades'])assert.match(source,new RegExp(label))
 assert.match(source,/bankCapacity\(bank\.trays\)/)
 assert.match(source,/bankOccupancy/)
})

test('integra sin pérdida los metadatos de bancos y bandejas provenientes de main',async()=>{
 const source=await readFile('src/pages/PropagationPage.jsx','utf8')
 for(const field of['substrate','usesJiffy','plugType','plugSize','volumePerCavityMl','mediumLot'])assert.match(source,new RegExp(field))
 for(const label of['Medio','Usa jiffy','Tipo de plug','Tamaño del plug','Volumen/cavidad','Lote del medio'])assert.match(source,new RegExp(label))
 assert.match(source,/item\.trayCount/)
 assert.match(source,/item\.cavitiesPerTray/)
 assert.match(source,/item\.propagationBankId/)
 assert.match(source,/item\.propagationBankName/)
})

test('impide eliminar bancos vinculados a lotes o esquejes activos',async()=>{
 const source=await readFile('src/pages/PropagationPage.jsx','utf8')
 assert.match(source,/unit\.bankId===item\.id\|\|unit\.propagationBankId===item\.id/)
 assert.match(source,/batch\.bankId===item\.id\|\|batch\.propagationBankId===item\.id/)
 assert.match(source,/No puedes eliminar un banco vinculado/)
})
