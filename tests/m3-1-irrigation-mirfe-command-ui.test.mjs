import test from'node:test'
import assert from'node:assert/strict'
import{readFile}from'node:fs/promises'

const pages=Object.freeze({
 'src/pages/IrrigationPlanPage.jsx':['CREATE_IRRIGATION_PLAN'],
 'src/pages/WaterAnalysisPage.jsx':['RECORD_WATER_ANALYSIS'],
 'src/pages/NutrientProductsPage.jsx':['CREATE_NUTRIENT_PRODUCT'],
 'src/pages/NutrientObjectivesPage.jsx':['RECORD_NUTRIENT_OBJECTIVE'],
 'src/pages/FormulationPage.jsx':['CREATE_FORMULATION','APPROVE_FORMULATION'],
 'src/pages/PreparationsPage.jsx':['CREATE_PREPARATION','EXECUTE_PREPARATION'],
 'src/pages/IrrigationWorkflowPage.jsx':['REGISTER_APPLICATION']
})

test('M31-F003: las siete pantallas escriben exclusivamente mediante command boundary',async()=>{
 for(const[path,operations]of Object.entries(pages)){
  const source=await readFile(new URL(`../${path}`,import.meta.url),'utf8')
  assert.match(source,/useIrrigationMirfeCommandStore/,path)
  assert.doesNotMatch(source,/useIrrigationMirfeStore|\bupdate\s*\(/,path)
  assert.doesNotMatch(source,/createTankPreparation|executeTankPreparation|registerIrrigationApplication/,path)
  for(const operation of operations)assert.match(source,new RegExp(`IRRIGATION_MIRFE_OPERATIONS\\.${operation}\\b`),`${path}:${operation}`)
 }
})

test('M31-F003: el adaptador UI conserva tenant, retry e integración con persistencia/sync',async()=>{
 const source=await readFile(new URL('../src/services/irrigationMirfeCommandStore.js',import.meta.url),'utf8')
 assert.match(source,/scopeIrrigationMirfeState\(rawState\)/)
 assert.match(source,/activeOrganizationId\(snapshot\)/)
 assert.match(source,/inFlightRef/)
 assert.match(source,/retryRef/)
 assert.match(source,/publishDomainEvent\(snapshot,event\)/)
 assert.match(source,/commit:update/)
 assert.match(source,/return useMemo\(\(\)=>\(\{state,execute\}\)/)
 assert.doesNotMatch(source,/\{state,execute,update\}/)
})
