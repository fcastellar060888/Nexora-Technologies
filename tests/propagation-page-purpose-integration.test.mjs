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

test('la administración de bancos y bandejas permanece disponible',async()=>{
 const source=await readFile('src/pages/PropagationPage.jsx','utf8')
 for(const label of['Nuevo banco de propagación','Bancos registrados','Agregar tipo de bandeja','Cavidades por bandeja'])assert.match(source,new RegExp(label))
})
