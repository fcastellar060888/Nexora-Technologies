import test from'node:test'
import assert from'node:assert/strict'
import{readFile}from'node:fs/promises'

async function source(path){return readFile(new URL(`../src/${path}`,import.meta.url),'utf8')}

const commandSurfaces=[
 'pages/IncidentsPage.jsx',
 'pages/FindingsPage.jsx',
 'pages/TreatmentsPage.jsx',
 'pages/MipeDashboardPage.jsx',
 'pages/HouseMapPage.jsx',
 'components/MaterialPlantMipePanel.jsx'
]

test('M32-F003: every MIPE writing surface invokes the explicit command store',async()=>{
 for(const path of commandSurfaces){
  const text=await source(path)
  assert.match(text,/useMipeCommandStore/,`${path} debe consumir el command store MIPE`)
  assert.match(text,/MIPE_OPERATIONS/,`${path} debe seleccionar una operación MIPE explícita`)
 }
})

test('M32-F003: primary MIPE pages no longer expose tenant-store update as a write escape hatch',async()=>{
 for(const path of['pages/IncidentsPage.jsx','pages/FindingsPage.jsx','pages/TreatmentsPage.jsx','pages/MipeDashboardPage.jsx']){
  const text=await source(path)
  assert.doesNotMatch(text,/useMipeStore/,`${path} no debe conservar el mutador tenant legacy`)
  assert.doesNotMatch(text,/\bupdate\s*\(/,`${path} no debe mutar el Store directamente`)
 }
})

test('M32-F003: treatment UI cannot call legacy schedule or execution mutators directly',async()=>{
 const text=await source('pages/TreatmentsPage.jsx')
 assert.doesNotMatch(text,/from['"]\.\.\/domain\/mipe['"]/)
 assert.doesNotMatch(text,/scheduleTreatment\s*\(/)
 assert.doesNotMatch(text,/executeTreatment\s*\(/)
 assert.match(text,/MIPE_OPERATIONS\.SCHEDULE_TREATMENT/)
 assert.match(text,/MIPE_OPERATIONS\.EXECUTE_TREATMENT/)
})

test('M32-F003: material plant panel has no manual event publication or domain mutation escape hatch',async()=>{
 const text=await source('components/MaterialPlantMipePanel.jsx')
 assert.doesNotMatch(text,/publishDomainEvent/)
 assert.doesNotMatch(text,/appendMaterialPlantFindings/)
 assert.doesNotMatch(text,/appendMipeIntervention/)
 assert.doesNotMatch(text,/resolveMaterialPlantFinding/)
 assert.match(text,/MIPE_OPERATIONS\.CREATE_MATERIAL_FINDINGS/)
 assert.match(text,/MIPE_OPERATIONS\.RECORD_INTERVENTION/)
 assert.match(text,/MIPE_OPERATIONS\.RESOLVE_FINDING/)
})

test('M32-F003: dashboard follow-up is explicit and reassigns through commands',async()=>{
 const text=await source('pages/MipeDashboardPage.jsx')
 assert.doesNotMatch(text,/appendMipeIntervention/)
 assert.doesNotMatch(text,/reassignMipeReviewTask/)
 assert.match(text,/type:'Seguimiento'/)
 assert.match(text,/MIPE_OPERATIONS\.RECORD_INTERVENTION/)
 assert.match(text,/MIPE_OPERATIONS\.REASSIGN_INTERVENTION/)
})

test('M32-F003: HouseMap creates findings through command while non-MIPE genetic edit is tenant guarded',async()=>{
 const text=await source('pages/HouseMapPage.jsx')
 assert.match(text,/MIPE_OPERATIONS\.CREATE_FINDING/)
 assert.doesNotMatch(text,/findings:\s*\[\.\.\./)
 assert.match(text,/mipeRecordOrganizationId/)
 assert.match(text,/activeOrganizationId/)
})

test('M32-F003: command service separates treatment execution permission and uses core operation causality',async()=>{
 const text=await source('services/mipeCommand.js')
 assert.match(text,/execute_treatments/)
 assert.match(text,/manage_mipe/)
 assert.match(text,/executeCoreOperationCommand/)
 assert.match(text,/applyOnce/)
 assert.match(text,/commandId/)
 assert.match(text,/MIPE_TREATMENT_EXECUTED/)
})
