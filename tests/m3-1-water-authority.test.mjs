import test from'node:test'
import assert from'node:assert/strict'
import{assertWaterSampleIdentity,compareWaterAnalyses,createWaterAnalysisVersion,currentWaterAnalysisForSite,effectiveWaterAnalysisStatus,WATER_ANALYTES,WATER_ANALYTE_KEYS,WATER_ANALYSIS_STATUSES,WATER_FORMULATION_ANALYTES}from'../src/domain/waterAnalysis.js'

const results=(keys=WATER_ANALYTE_KEYS,{methodId='method-1',offset=0}={})=>keys.map((analyte,index)=>({analyte,value:analyte==='ph'?7+offset/10:index+1+offset,methodId}))
const input=(overrides={})=>({id:'water-1',organizationId:'org-a',siteId:'site-1',laboratoryId:'lab-1',laboratoryName:'Lab Uno',sampleId:'sample-1',samplePoint:'well-1',sampleType:'SOURCE_WATER',sampledAt:'2026-08-16T08:00:00.000Z',reportedAt:'2026-08-16T10:00:00.000Z',analyticalMethodId:'method-1',expectedAnalytes:WATER_ANALYTE_KEYS,results:results(),status:WATER_ANALYSIS_STATUSES.CURRENT,...overrides})

test('M31-F008: análisis vigente materializa laboratorio, muestra, método, panel y aliases inmutables',()=>{
 const record=createWaterAnalysisVersion(input())
 assert.equal(record.schemaVersion,1)
 assert.equal(record.analysisKey,'water-1')
 assert.equal(record.version,1)
 assert.equal(record.laboratoryId,'lab-1')
 assert.equal(record.sampleId,'sample-1')
 assert.equal(record.completeness.complete,true)
 assert.equal(record.completeness.resultCount,WATER_ANALYTE_KEYS.length)
 assert.equal(record.ca,record.results.find(item=>item.analyte==='ca').value)
 assert.ok(Object.isFrozen(record)&&Object.isFrozen(record.results)&&Object.isFrozen(record.results[0])&&Object.isFrozen(record.completeness))
})

test('M31-F008: adaptadores de resultados objeto y campos legacy convergen al mismo contrato',()=>{
 const fromObject=createWaterAnalysisVersion(input({id:'object-results',expectedAnalytes:['ec','ph'],results:{ec:{value:1.2},ph:7},status:WATER_ANALYSIS_STATUSES.CURRENT}))
 const legacyInput=input({id:'flat-results',expectedAnalytes:['ec','ph'],status:WATER_ANALYSIS_STATUSES.CURRENT});delete legacyInput.results
 const fromFlat=createWaterAnalysisVersion({...legacyInput,ec:1.2,ph:7})
 assert.deepEqual(fromObject.results.map(item=>[item.analyte,item.value]),[['ec',1.2],['ph',7]])
 assert.deepEqual(fromFlat.results.map(item=>[item.analyte,item.value]),[['ec',1.2],['ph',7]])
})

test('M31-F008: parcial conserva ausencias y Vigente falla cerrado si el panel está incompleto',()=>{
 const partialInput=input({expectedAnalytes:['ec','ph','ca'],results:results(['ec']),status:WATER_ANALYSIS_STATUSES.PARTIAL})
 const partial=createWaterAnalysisVersion(partialInput)
 assert.equal(partial.completeness.complete,false)
 assert.deepEqual(partial.completeness.missingAnalytes,['ph','ca'])
 assert.equal(Object.prototype.hasOwnProperty.call(partial,'ph'),false)
 assert.throws(()=>createWaterAnalysisVersion({...partialInput,status:WATER_ANALYSIS_STATUSES.CURRENT}),/panel completo/)
 assert.throws(()=>createWaterAnalysisVersion({...partialInput,status:'Inventado'}),/catálogo canónico/)
 assert.throws(()=>createWaterAnalysisVersion({...partialInput,results:[{analyte:'ph',value:15,methodId:'method-1'}]}),/entre 0 y 14/)
 assert.throws(()=>createWaterAnalysisVersion({...partialInput,expectedAnalytes:['ec','ec']}),/duplicados/)
 assert.throws(()=>createWaterAnalysisVersion({...partialInput,date:'2026-02-30'}),/fecha civil válida/)
 assert.throws(()=>createWaterAnalysisVersion({...partialInput,sampledAt:'2026-08-18T08:00:00.000Z'}),/posterior a reportedAt/)
})

test('M31-F008: una versión completa un parcial sin reescribir la evidencia anterior',()=>{
 const first=createWaterAnalysisVersion(input({expectedAnalytes:['ec','ph','ca'],results:results(['ec']),status:WATER_ANALYSIS_STATUSES.PARTIAL}))
 const second=createWaterAnalysisVersion(input({id:'water-2',analysisKey:'water-1',supersedesWaterAnalysisId:'water-1',expectedAnalytes:['ec','ph','ca'],results:results(['ph','ca']),status:WATER_ANALYSIS_STATUSES.CURRENT,version:99,reportedAt:'2026-08-17T10:00:00.000Z'}),first)
 assert.equal(second.analysisKey,'water-1')
 assert.equal(second.version,2)
 assert.equal(second.supersedesWaterAnalysisId,'water-1')
 assert.equal(second.completeness.complete,true)
 assert.deepEqual(second.results.map(item=>item.analyte),['ec','ph','ca'])
 assert.equal(first.status,WATER_ANALYSIS_STATUSES.PARTIAL)
 assert.equal(first.completeness.resultCount,1)
 assert.throws(()=>createWaterAnalysisVersion({...input({id:'bad'}),sampleId:'another'},second),/identidad de la muestra/)
 assert.throws(()=>createWaterAnalysisVersion({...input({id:'bad'}),laboratoryId:'another'},second),/laboratoryId/)
})

test('M31-F008: selección vigente es determinista, tenant-aware y exige analitos de formulación',()=>{
 const older=createWaterAnalysisVersion(input({id:'same',sampledAt:'2026-08-15T08:00:00.000Z',reportedAt:'2026-08-15T10:00:00.000Z'}))
 const newer=createWaterAnalysisVersion(input({id:'newer',sampleId:'sample-2',sampledAt:'2026-08-17T08:00:00.000Z',reportedAt:'2026-08-17T10:00:00.000Z',results:results(WATER_ANALYTE_KEYS,{offset:10})}))
 const foreign=createWaterAnalysisVersion(input({id:'same',organizationId:'org-b',reportedAt:'2026-08-18T10:00:00.000Z'}))
 assert.equal(currentWaterAnalysisForSite([newer,foreign,older],{organizationId:'org-a',siteId:'site-1'}).id,'newer')
 assert.equal(currentWaterAnalysisForSite([newer,foreign,older],{organizationId:'org-a',siteId:'site-1',requiredAnalytes:WATER_FORMULATION_ANALYTES}).id,'newer')
 const insufficient=createWaterAnalysisVersion(input({id:'insufficient',expectedAnalytes:['ec','ph'],results:results(['ec','ph']),reportedAt:'2026-08-19T10:00:00.000Z'}))
 assert.equal(currentWaterAnalysisForSite([newer,insufficient],{organizationId:'org-a',siteId:'site-1',requiredAnalytes:WATER_FORMULATION_ANALYTES}).id,'newer')
 assert.throws(()=>currentWaterAnalysisForSite([older,{...older}],{organizationId:'org-a',siteId:'site-1'}),/identidad duplicada/)
 assert.throws(()=>currentWaterAnalysisForSite([older,{...older,id:'same-version'}],{organizationId:'org-a',siteId:'site-1'}),/versión duplicada/)
})

test('M31-F008: comparación histórica solo calcula método, unidad, base y punto compatibles',()=>{
 const before=createWaterAnalysisVersion(input({id:'before',sampledAt:'2026-08-15T08:00:00.000Z',expectedAnalytes:['ec','ph','ca'],results:results(['ec','ph','ca']),reportedAt:'2026-08-15T10:00:00.000Z'}))
 const after=createWaterAnalysisVersion(input({id:'after',sampleId:'sample-2',sampledAt:'2026-08-17T08:00:00.000Z',expectedAnalytes:['ec','ph','ca'],results:[{analyte:'ec',value:4,methodId:'method-1'},{analyte:'ph',value:7.2,methodId:'method-2'},{analyte:'ca',value:8,methodId:'method-1'}],reportedAt:'2026-08-17T10:00:00.000Z'}))
 const comparison=compareWaterAnalyses(before,after)
 assert.deepEqual(comparison.rows.map(row=>row.analyte),['ec','ca'])
 assert.deepEqual(comparison.incompatible.map(row=>row.analyte),['ph'])
 assert.equal(comparison.rows[0].delta,3)
 assert.throws(()=>compareWaterAnalyses(before,{...after,organizationId:'org-b'}),/misma organización/)
 assert.throws(()=>compareWaterAnalyses(before,{...after,samplePoint:'reservoir-2'}),/mismo punto/)
 assert.throws(()=>compareWaterAnalyses(before,{...after,results:after.results.map(item=>({...item,methodId:'method-2'}))}),/técnicamente comparables/)
})

test('M31-F008: estado histórico se deriva sin mutar versiones anteriores',()=>{
 const older=createWaterAnalysisVersion(input({id:'older',sampledAt:'2026-08-15T08:00:00.000Z',reportedAt:'2026-08-15T10:00:00.000Z'}))
 const newer=createWaterAnalysisVersion(input({id:'newer',sampleId:'sample-2',sampledAt:'2026-08-17T08:00:00.000Z',reportedAt:'2026-08-17T10:00:00.000Z'}))
 const records=[older,newer]
 assert.equal(effectiveWaterAnalysisStatus(older,records),'Histórico')
 assert.equal(effectiveWaterAnalysisStatus(newer,records),WATER_ANALYSIS_STATUSES.CURRENT)
 assert.equal(older.status,WATER_ANALYSIS_STATUSES.CURRENT)
 assert.equal(WATER_ANALYTES.ec.unit,'mS/cm')
})

test('M31-F008: sampleId conserva una identidad física aunque existan varios laboratorios',()=>{
 const first=createWaterAnalysisVersion(input({id:'lab-one'}))
 const second=createWaterAnalysisVersion(input({id:'lab-two',analysisKey:'lab-two',laboratoryId:'lab-2',laboratoryName:'Lab Dos'}))
 assert.equal(assertWaterSampleIdentity([first],second),second)
 const contradictory=createWaterAnalysisVersion(input({id:'bad-sample',samplePoint:'reservoir-2'}))
 assert.throws(()=>assertWaterSampleIdentity([first],contradictory),/otra muestra/)
})
