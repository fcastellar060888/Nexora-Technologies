import test from'node:test'
import assert from'node:assert/strict'
import{readFileSync}from'node:fs'

const pages=[
 'IrrigationPlanPage.jsx','FormulationPage.jsx','PreparationsPage.jsx','IrrigationWorkflowPage.jsx',
 'WaterAnalysisPage.jsx','NutrientObjectivesPage.jsx','NutrientProductsPage.jsx'
]

test('M31-F002: todas las superficies legacy usan la vista/merge tenant-aware',()=>{
 for(const page of pages){
  const source=readFileSync(new URL(`../src/pages/${page}`,import.meta.url),'utf8')
  assert.match(source,/irrigationMirfeCommandStore/,page)
  assert.match(source,/useIrrigationMirfeCommandStore\(\)/,page)
  assert.doesNotMatch(source,/services\/store/,page)
 }
 const boundary=readFileSync(new URL('../src/services/irrigationMirfeCommandStore.js',import.meta.url),'utf8')
 assert.match(boundary,/scopeIrrigationMirfeState\(rawState\)/)
 assert.match(boundary,/executeIrrigationMirfeCommand/)
})
