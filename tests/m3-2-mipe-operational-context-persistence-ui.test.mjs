import test from'node:test'
import assert from'node:assert/strict'
import{readFile}from'node:fs/promises'
import{initialState}from'../src/services/storage.js'
import{migrateState}from'../src/services/stateMigration.js'
import{hydrateAuthoritativeState}from'../src/services/remoteBootstrap.js'

function staleLocal(){return migrateState({...structuredClone(initialState),
 companies:[{id:'org-a',name:'A'},{id:'org-b',name:'B'}],
 currentContext:{companyId:'org-a',siteId:'site-a',houseId:'house-a',bedId:'bed-a',plantId:'plant-a',geneticId:'',stage:'Floración',week:3,cycleId:''},
 users:[{id:'u1',active:true,activeSession:true,remote:true}],roles:[],memberships:[{id:'m1',userId:'u1',companyId:'org-a',siteIds:['site-a'],status:'active'}],
 sites:[{id:'site-a',organizationId:'org-a',companyId:'org-a'},{id:'site-b',organizationId:'org-b',companyId:'org-b'}],
 houses:[{id:'house-a',organizationId:'org-a',siteId:'site-a'},{id:'house-b',organizationId:'org-b',siteId:'site-b'}],
 beds:[{id:'bed-a',organizationId:'org-a',houseId:'house-a'},{id:'bed-b',organizationId:'org-b',houseId:'house-b'}],
 plantPositions:[{id:'plant-a',organizationId:'org-a',bedId:'bed-a'},{id:'plant-b',organizationId:'org-b',bedId:'bed-b'}],
 incidents:[],findings:[],treatments:[],mipeInterventions:[],mipeCommandReceipts:[],syncQueue:[],syncConflicts:[],syncHealthEvents:[],syncDeviceHealth:[]
})}

test('F010: bootstrap autoritativo conserva empresa/sede válida y limpia descendientes que ya no existen',()=>{
 const local=staleLocal(),rows=[{organization_id:'org-a',collection:'sites',record_id:'site-a',payload:{id:'site-a',organizationId:'org-a',companyId:'org-a',name:'A'},version:2,updated_at:'2026-08-17T15:00:00.000Z',deleted_at:null}]
 const hydrated=hydrateAuthoritativeState(local,rows,{companyId:'org-a',initialState:local,hydratedAt:'2026-08-17T15:01:00.000Z'})
 assert.equal(hydrated.currentContext.companyId,'org-a')
 assert.equal(hydrated.currentContext.siteId,'site-a')
 assert.equal(hydrated.currentContext.houseId,'')
 assert.equal(hydrated.currentContext.bedId,'')
 assert.equal(hydrated.currentContext.plantId,'')
 assert.equal(hydrated.houses.some(item=>(item.organizationId||item._organizationId)==='org-b'),true)
})

test('F010: safeStorage normaliza contexto después de migraciones de estado/material/MIPE',async()=>{
 const source=await readFile('src/services/safeStorage.js','utf8')
 assert.match(source,/normalizeOperationalContext/)
 assert.match(source,/const normalizeState=value=>\{const migrated=migratePersistedState\(value\);return\{\.\.\.migrated,currentContext:normalizeOperationalContext\(migrated,migrated\.currentContext\)\}\}/)
 assert.match(source,/writeLightweightCache/)
})

test('F010: bootstrap remoto conserva currentContext local pero lo revalida tras hidratar',async()=>{
 const source=await readFile('src/services/remoteBootstrap.js','utf8')
 assert.match(source,/finalizeHydratedState/)
 assert.match(source,/normalizeOperationalContext\(migrated,migrated\.currentContext\)/)
 assert.match(source,/currentContext:\{\.\.\.\(localState\.currentContext\|\|\{\}\),companyId\}/)
})

test('F010: AppShell monta la barra de contexto persistente sobre las páginas operativas',async()=>{
 const source=await readFile('src/components/AppShell.jsx','utf8')
 assert.match(source,/import ContextBar from'\.\/ContextBar\.jsx'/)
 assert.match(source,/<main className="main-content"[^>]*><ContextBar\/><Outlet\/><\/main>/)
})

test('F010: ContextBar usa autoridad jerárquica y no permite empresa global Todas',async()=>{
 const source=await readFile('src/components/ContextBar.jsx','utf8')
 assert.match(source,/operationalContextOptions,transitionOperationalContext/)
 assert.match(source,/currentContext:transitionOperationalContext\(current,patch\)/)
 assert.doesNotMatch(source,/<option value="">Todas<\/option>\{options\.companies/)
 assert.match(source,/aria-label="Planta activa"/)
})

test('F010: croquis consume estado contextual y persiste la planta antes de abrir Passport',async()=>{
 const source=await readFile('src/pages/UnifiedCultivationMapPage.jsx','utf8')
 assert.match(source,/scopeOperationalState/)
 assert.match(source,/operationalContextForPlant/)
 assert.match(source,/<SiteOverviewMap state=\{mapState\}/)
 assert.match(source,/<UnifiedMapCanvas state=\{mapState\}/)
 assert.match(source,/<PlantPassportDrawer state=\{mapState\}/)
})

test('F010: selección masiva del croquis no escribe plantEvents directamente',async()=>{
 const source=await readFile('src/services/useUnifiedMapSelection.js','utf8')
 assert.match(source,/executePlantEvent/)
 assert.doesNotMatch(source,/plantEvents\s*:/)
 assert.match(source,/await executePlantEvent\(/)
})

test('F010: Dashboard MIPE deriva KPIs y tareas desde scopeOperationalState, no desde un filtro geográfico paralelo',async()=>{
 const source=await readFile('src/pages/MipeDashboardPage.jsx','utf8')
 assert.match(source,/scopeOperationalState\(tenantState,tenantState\.currentContext\)/)
 assert.doesNotMatch(source,/useState\(\{siteId:/)
 assert.match(source,/El alcance Empresa → Sede → Nave → Cama → Planta/)
})
