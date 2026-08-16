import test from'node:test'
import assert from'node:assert/strict'
import{readFile}from'node:fs/promises'

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8')

test('M31-F010: las pantallas MIRFE dejaron de mutar el Store y usan operaciones canónicas',async()=>{
 const expectations={
  'src/pages/MirfeProgramsPage.jsx':['CREATE_MIRFE_PROGRAM'],
  'src/pages/MirfeMonitoringPage.jsx':['RECORD_MIRFE_MONITORING'],
  'src/pages/MirfeReinforcementsPage.jsx':['CREATE_MIRFE_REINFORCEMENT'],
  'src/pages/MirfeHistoryPage.jsx':['TRANSITION_MIRFE_REINFORCEMENT','RECORD_MIRFE_CORRECTION']
 }
 for(const[path,operations]of Object.entries(expectations)){
  const source=await read(path)
  assert.match(source,/useIrrigationMirfeCommandStore/,path)
  assert.doesNotMatch(source,/from['"]\.\.\/services\/store|\bupdate\s*\(/,path)
  for(const operation of operations)assert.match(source,new RegExp(`IRRIGATION_MIRFE_OPERATIONS\\.${operation}\\b`),`${path}:${operation}`)
 }
})

test('M31-F010: la UI no permite estado arbitrario y expone workflow e historia append-only',async()=>{
 const reinforcement=await read('src/pages/MirfeReinforcementsPage.jsx'),history=await read('src/pages/MirfeHistoryPage.jsx'),dashboard=await read('src/pages/MirfeDashboardPage.jsx')
 assert.doesNotMatch(reinforcement,/mirfeStatuses|Estado de la orden/)
 assert.match(reinforcement,/Estado inicial/)
 assert.match(history,/availableMirfeTransitions/)
 assert.match(history,/MIRFE_WORKFLOW_TRANSITIONS/)
 assert.match(history,/Historia agronómica inmutable/)
 assert.match(history,/state\.irrigationHistory/)
 assert.doesNotMatch(history,/const phaseOf=record|result\|\|'\'\)\.trim\(\)/)
 assert.match(dashboard,/useIrrigationMirfeCommandStore/)
 assert.doesNotMatch(dashboard,/useStore/)
})

test('M31-F010: catálogo y Timeline reconocen todos los eventos agronómicos',async()=>{
 const catalog=await read('src/core/events/eventCatalog.js'),timeline=await read('src/core/timeline/timelineProjection.js')
 for(const event of['mirfe.program.created','mirfe.monitoring.recorded','mirfe.reinforcement.created','mirfe.reinforcement.transitioned','mirfe.correction.recorded']){
  assert.match(catalog,new RegExp(event.replaceAll('.','\\.')))
  assert.match(timeline,new RegExp(event.replaceAll('.','\\.')))
 }
})

test('M31-F010: schema v13 migra el workflow legado sin adjudicarse F011',async()=>{
 const migration=await read('src/services/stateMigration.js'),sync=await read('src/services/syncEngine.js')
 assert.match(migration,/CURRENT_SCHEMA_VERSION=13/)
 assert.match(migration,/migrateLegacyMirfeWorkflowState\(state\)/)
 for(const collection of['mirfePrograms','mirfeMonitoring','mirfeReinforcements','irrigationCorrections','irrigationHistory']){
  assert.match(migration,new RegExp(collection))
  assert.match(sync,new RegExp(collection))
 }
 assert.doesNotMatch(sync,/irrigationEmitters|irrigationSectors|irrigationAssignments|irrigationPulses|irrigationMeasurements|drainageMeasurements/)
})
