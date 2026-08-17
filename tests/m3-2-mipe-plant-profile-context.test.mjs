import test from'node:test'
import assert from'node:assert/strict'
import{readFile}from'node:fs/promises'

test('F010: perfil directo de planta resuelve scope autorizado y sincroniza jerarquía compartida',async()=>{
 const source=await readFile('src/pages/PlantProfilePage.jsx','utf8')
 assert.match(source,/operationalContextForPlant,scopeOperationalState/)
 assert.match(source,/const resolvedContext=useMemo\(\(\)=>\{try\{return operationalContextForPlant\(state,plantId\)\}catch\{return null\}\}/)
 assert.match(source,/resolvedContext\?scopeOperationalState\(state,resolvedContext\):null/)
 assert.match(source,/currentContext:operationalContextForPlant\(current,plantId\)/)
 assert.match(source,/hasPermission\(profileState,'record_observations'\)/)
 assert.match(source,/Planta no encontrada o fuera del alcance operativo autorizado/)
})

test('F010: cambio de plantId invalida el draft local de evento',async()=>{
 const source=await readFile('src/pages/PlantProfilePage.jsx','utf8')
 assert.match(source,/useEffect\(\(\)=>\{setEvent\(emptyEvent\(\)\);setSubmitError\(''\)\},\[plantId\]\)/)
})
