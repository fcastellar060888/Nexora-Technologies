import test from'node:test'
import assert from'node:assert/strict'
import{readFile}from'node:fs/promises'
import{fileURLToPath}from'node:url'

const read=path=>readFile(fileURLToPath(new URL(`../${path}`,import.meta.url)),'utf8')

test('M1.1: el mapa unificado no crea ni mueve infraestructura',async()=>{
 const source=await read('src/pages/UnifiedCultivationMapPage.jsx')
 assert.doesNotMatch(source,/Mover naves y bancos/)
 assert.doesNotMatch(source,/startMove\(/)
 assert.doesNotMatch(source,/ObjectDrawer/)
 assert.match(source,/La infraestructura se configura fuera del mapa/)
 assert.match(source,/no se crean ni se mueven desde esta pantalla/)
})

test('M1.1: bancos y bandejas se administran junto con naves y camas',async()=>{
 const houses=await read('src/pages/HousesPage.jsx')
 const propagation=await read('src/pages/PropagationPage.jsx')
 assert.match(houses,/PropagationBankManager/)
 assert.match(houses,/Infraestructura, naves, camas y bancos/)
 assert.doesNotMatch(propagation,/Nuevo banco de propagación/)
 assert.doesNotMatch(propagation,/saveBank\(/)
 assert.match(propagation,/Los bancos y bandejas se crean en Infraestructura/)
})
