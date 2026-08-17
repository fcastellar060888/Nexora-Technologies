import test from'node:test'
import assert from'node:assert/strict'
import{readFile}from'node:fs/promises'

const pages=['FindingsPage.jsx','TreatmentsPage.jsx','IncidentsPage.jsx','MipeDashboardPage.jsx']

test('M32-F002: primary MIPE surfaces consume the tenant-scoped store instead of global state',async()=>{
 for(const page of pages){
  const source=await readFile(new URL(`../src/pages/${page}`,import.meta.url),'utf8')
  assert.match(source,/useMipeStore/ ,`${page} debe usar useMipeStore`)
  assert.doesNotMatch(source,/useStore\s*\(/,`${page} no debe leer el Store global`)
  assert.doesNotMatch(source,/from['"]\.\.\/services\/store/,`${page} no debe importar store global`)
 }
})

test('M32-F002: tenant adapter composes MIPE ownership with shared inventory ownership',async()=>{
 const source=await readFile(new URL('../src/services/mipeTenantStore.js',import.meta.url),'utf8')
 assert.match(source,/scopeMipeState/)
 assert.match(source,/mergeMipeState/)
 assert.match(source,/mergeIrrigationMirfeState/)
 assert.match(source,/activeOrganizationId/)
 assert.match(source,/mutateMipeTenantState/)
})
