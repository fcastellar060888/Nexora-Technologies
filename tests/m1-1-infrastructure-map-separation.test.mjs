import test from'node:test'
import assert from'node:assert/strict'
import{readFile}from'node:fs/promises'
import{fileURLToPath}from'node:url'

const read=path=>readFile(fileURLToPath(new URL(`../${path}`,import.meta.url)),'utf8')

test('M1.1: el mapa unificado mantiene infraestructura en modo operativo',async()=>{
 const page=await read('src/pages/UnifiedCultivationMapPage.jsx')
 const canvas=await read('src/components/UnifiedMapCanvas.jsx')
 const source=page+canvas
 assert.doesNotMatch(source,/Mover naves y bancos/)
 assert.doesNotMatch(source,/startMove\(/)
 assert.doesNotMatch(source,/ObjectDrawer/)
 assert.match(page,/La infraestructura se configura fuera del mapa/)
 assert.match(canvas,/no se crean ni se mueven desde esta pantalla/)
})

test('M1.1: bancos y bandejas se administran junto con naves y camas',async()=>{
 const houses=await read('src/pages/HousesPage.jsx')
 const propagation=await read('src/pages/PropagationPage.jsx')
 const manager=await read('src/components/PropagationBankManager.jsx')
 assert.match(houses,/PropagationBankManager/)
 assert.match(houses,/Configura áreas físicas, naves, camas y bancos/)
 assert.match(manager,/Nuevo banco de propagación/)
 assert.match(manager,/Bandejas y medio de propagación/)
 assert.doesNotMatch(propagation,/saveBank\(/)
 assert.match(propagation,/Los bancos y bandejas se crean en Infraestructura/)
})
