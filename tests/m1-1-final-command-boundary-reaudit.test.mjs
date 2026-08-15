import test from'node:test'
import assert from'node:assert/strict'
import{readFile}from'node:fs/promises'

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8')

const coreSurfaces=[
 'src/pages/CompaniesPage.jsx',
 'src/pages/SitesPage.jsx',
 'src/pages/HousesPage.jsx',
 'src/components/FacilityAreaManager.jsx',
 'src/components/BedManager.jsx',
 'src/components/PropagationBankManager.jsx'
]

test('M1.1 final re-audit: organization/site/facility writes cannot bypass the canonical command boundary',async()=>{
 for(const path of coreSurfaces){
  const source=await read(path)
  assert.match(source,/executeCoreOperationCommand/,`${path} debe usar executeCoreOperationCommand`)
  assert.match(source,/publishDomainEvent/,`${path} debe publicar evidencia canónica`)
  assert.doesNotMatch(source,/\bupdate\s*\(/,`${path} no puede mutar el Store directamente`)
 }
})

test('M1.1 final re-audit: configuration routes require manage_settings authorization',async()=>{
 const app=await read('src/App.jsx')
 for(const route of['companies','sites','houses']){
  const pattern=new RegExp(`path="/${route}"[^\n]+Guard permission="manage_settings"`)
  assert.match(app,pattern,`/${route} debe exigir manage_settings`)
 }
})

test('M1.1 final re-audit: plant profile keeps its independent permission-aware command boundary',async()=>{
 const profile=await read('src/pages/PlantProfilePage.jsx')
 const command=await read('src/services/plantEventCommand.js')
 assert.match(profile,/executePlantEventCommand/)
 assert.match(command,/hasPermission\(state,'record_observations'\)/)
 assert.doesNotMatch(profile,/\bupdate\s*\(/)
})
