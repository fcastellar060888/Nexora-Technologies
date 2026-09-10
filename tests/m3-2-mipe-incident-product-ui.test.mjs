import test from'node:test'
import assert from'node:assert/strict'
import{readFile}from'node:fs/promises'

const source=path=>readFile(new URL(`../src/${path}`,import.meta.url),'utf8')

test('M32-F007: sanitary catalog archives identity instead of deleting it',async()=>{
 const text=await source('pages/IncidentsPage.jsx')
 assert.match(text,/MIPE_OPERATIONS\.ARCHIVE_INCIDENT/)
 assert.match(text,/Archivar/)
 assert.doesNotMatch(text,/MIPE_OPERATIONS\.DELETE_INCIDENT/)
 assert.doesNotMatch(text,/>Eliminar</)
 assert.match(text,/scientificName/)
 assert.match(text,/validFrom/)
 assert.match(text,/validUntil/)
})

test('M32-F007: productive map offers only active non-archived Incidents for new Findings',async()=>{
 const text=await source('pages/HouseMapPage.jsx')
 assert.match(text,/activeIncidents/)
 assert.match(text,/item\.active!==false/)
 assert.match(text,/!item\.archivedAt/)
 assert.match(text,/activeIncidents\.map/)
 assert.match(text,/MIPE_OPERATIONS\.CREATE_FINDING/)
})

test('M32-F007: material-plant findings use canonical incidentId and quick action is follow-up only',async()=>{
 const text=await source('components/MaterialPlantMipePanel.jsx')
 assert.match(text,/incidentId/)
 assert.match(text,/CREATE_MATERIAL_FINDINGS/)
 assert.match(text,/MIPE_INTERVENTION_TYPES\.FOLLOW_UP/)
 assert.doesNotMatch(text,/MIPE_INTERVENTION_TYPES\.TREATMENT/)
 assert.doesNotMatch(text,/Producto o tratamiento MIPE/)
 assert.match(text,/Tratamientos MIPE/)
})

test('M32-F007: Treatment scheduling locks dose unit to the selected technical profile',async()=>{
 const text=await source('pages/TreatmentsPage.jsx')
 assert.match(text,/product\?\.active!==false/)
 assert.match(text,/!product\?\.archivedAt/)
 assert.match(text,/registrationNumber/)
 assert.match(text,/validUntil/)
 assert.match(text,/Unidad de dosis técnica/)
 assert.match(text,/value=\{selectedProduct\?\.doseUnit\|\|f\.doseUnit\} disabled/)
 assert.match(text,/t\.productSnapshot\|\|liveProduct/)
})

test('M32-F007: shared Inventory captures tenant-owned executable product metadata and coherent units',async()=>{
 const text=await source('pages/InventoryPage.jsx'),store=await source('services/inventoryCommandStore.js')
 for(const token of['manufacturer','registrationNumber','validFrom','validUntil','technicalRevision'])assert.match(text,new RegExp(token))
 assert.match(text,/useInventoryCommandStore/)
 assert.match(store,/scopeInventoryUiState\(store\.state\)/)
 assert.match(text,/organizationId/)
 assert.match(text,/executableMipeCategory/)
 assert.match(text,/expectedInventoryUnit/)
 assert.match(text,/p\.unit!==expected/)
 assert.match(text,/La unidad de inventario debe ser/)
})

test('M32-F007: command and execution consume canonical catalog authority and frozen snapshot',async()=>{
 const command=await source('services/mipeCommand.js'),domain=await source('domain/mipe.js')
 assert.match(command,/createMipeIncidentCatalogRecord/)
 assert.match(command,/archiveMipeIncidentRecord/)
 assert.match(command,/assertMipeIncidentUsable/)
 assert.match(command,/createExecutableMipeProductSnapshot/)
 assert.match(command,/MIPE_INCIDENT_ARCHIVED/)
 assert.match(command,/productTechnicalRevision/)
 assert.match(domain,/productSnapshot/)
 assert.match(domain,/assertExecutableMipeProductSnapshot/)
 assert.match(domain,/profile=snapshot\|\|product/)
 assert.match(domain,/movementBackedCostEntry\(movement/)
 assert.match(domain,/const cost=costEntry\.amount/)
 assert.doesNotMatch(domain,/quantity\*Number\(product\.cost/)
})
