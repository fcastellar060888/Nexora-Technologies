import test from'node:test'
import assert from'node:assert/strict'
import{readFile}from'node:fs/promises'

const source=()=>readFile('src/pages/HouseMapPage.jsx','utf8')

test('F010: HouseMap usa la autoridad operacional y no mantiene geografía paralela en useState',async()=>{
 const text=await source()
 assert.match(text,/operationalContextForPlant,operationalContextOptions,scopeOperationalState,transitionOperationalContext/)
 assert.doesNotMatch(text,/const\s*\[siteId\s*,\s*setSiteId\]/)
 assert.doesNotMatch(text,/const\s*\[houseId\s*,\s*setHouseId\]/)
 assert.doesNotMatch(text,/const\s*\[plant\s*,\s*setPlant\]/)
})

test('F010: HouseMap renderiza camas, plantas, incidencias y genéticas desde mapState contextual',async()=>{
 const text=await source()
 assert.match(text,/scopeOperationalState\(state,\{\.\.\.context,siteId,houseId,bedId:'',plantId:''\}\)/)
 assert.match(text,/mapState\.beds\.filter/)
 assert.match(text,/mapState\.plantPositions\.filter/)
 assert.match(text,/mapState\.findings\.filter/)
 assert.match(text,/mapState\.incidents\.find/)
 assert.match(text,/mapState\.genetics\.find/)
})

test('F010: seleccionar planta en HouseMap persiste Plant→Cama→Nave→Sede canónico',async()=>{
 const text=await source()
 assert.match(text,/function choosePlant\(position\)\{rawUpdate\(current=>\(\{\.\.\.current,currentContext:operationalContextForPlant\(current,position\.id\)\}\)/)
 assert.match(text,/\{audit:false,sync:false\}/)
})

test('F010: defaults de Sede y Nave se aplican secuencialmente para respetar cascada',async()=>{
 const text=await source()
 assert.match(text,/if\(!context\.siteId&&siteId\).*transitionOperationalContext\(current,\{siteId\}\)/s)
 assert.match(text,/if\(context\.siteId===siteId&&!context\.houseId&&houseId\).*transitionOperationalContext\(current,\{houseId\}\)/s)
 assert.doesNotMatch(text,/transitionOperationalContext\(current,\{siteId,houseId\}\)/)
})

test('F010: crear hallazgo desde HouseMap conserva el command boundary MIPE',async()=>{
 const text=await source()
 assert.match(text,/MIPE_OPERATIONS\.CREATE_FINDING/)
 assert.match(text,/await execute\(\{operation:MIPE_OPERATIONS\.CREATE_FINDING/)
 assert.doesNotMatch(text,/findings\s*:\s*\[\.\.\./)
})
