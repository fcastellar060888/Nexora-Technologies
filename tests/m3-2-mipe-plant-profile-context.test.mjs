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

test('F010: perfil de material vegetal valida sede autorizada antes del Passport y limpia jerarquía Position',async()=>{
 const source=await readFile('src/pages/MaterialPlantProfilePage.jsx','utf8')
 assert.match(source,/materialPlantUnitById/)
 assert.match(source,/operationalContextOptions,transitionOperationalContext/)
 assert.match(source,/unit&&unit\.siteId&&options\.sites\.some\(item=>item\.id===unit\.siteId\)\?unit:null/)
 assert.match(source,/if\(!authorizedUnit\)return null;try\{return createMaterialPlantPassportFromState/)
 assert.match(source,/siteId:authorizedUnit\.siteId,houseId:'',bedId:'',plantId:'',geneticId:authorizedUnit\.geneticId\|\|''/)
 assert.match(source,/options\.sites\.find\(item=>item\.id===object\.siteId\)/)
 assert.doesNotMatch(source,/attributes\.siteId/)
})

test('F010: perfil de material vegetal usa identidad canónica para tipo y lote',async()=>{
 const source=await readFile('src/pages/MaterialPlantProfilePage.jsx','utf8')
 assert.match(source,/identity=object\.identity\|\|\{\}/)
 assert.match(source,/identity\.plantType\|\|authorizedUnit\.plantType/)
 assert.match(source,/authorizedUnit\.sourceLot\?\.lotCode/)
 assert.doesNotMatch(source,/attributes\.plantType/)
})

test('F010: ContextBar representa la rama material como Empresa→Sede→Genética',async()=>{
 const source=await readFile('src/components/ContextBar.jsx','utf8')
 assert.ok(source.includes("[/^\\/material-plant\\//,['company','site','genetic']]"))
})
