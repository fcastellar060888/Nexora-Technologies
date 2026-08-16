import test from'node:test'
import assert from'node:assert/strict'
import{
 CALIBRATION_RESULTS,ENVIRONMENT_DEVICE_KINDS,ENVIRONMENT_DEVICE_STATUSES,
 MEASUREMENT_SOURCES,calibrationEffectiveAt,createEnvironmentCalibration,
 createEnvironmentDevice,createEnvironmentalReading,createEnvironmentSetpointVersion,effectiveEnvironmentCalibration,
 currentEnvironmentSetpoint,deriveEnvironmentAlerts,mergeEnvironmentState,
 migrateLegacyEnvironmentState,scopeEnvironmentState
}from'../src/domain/environment.js'

const base={organizationId:'org-a',siteId:'site-shared',elementId:'room-shared'}
const device=(overrides={})=>createEnvironmentDevice({id:'device-shared',...base,code:'ENV-01',name:'Sensor clima',kind:ENVIRONMENT_DEVICE_KINDS.SENSOR,variables:['temperature','humidity','co2'],createdAt:'2026-08-16T08:00:00.000Z',...overrides})
const calibration=(source=device(),overrides={})=>createEnvironmentCalibration({id:'calibration-shared',...base,deviceId:source.id,result:CALIBRATION_RESULTS.PASS,variables:source.variables,performedAt:'2026-08-16T08:00:00.000Z',validUntil:'2026-09-16T08:00:00.000Z',methodId:'method-1',certificateId:'cert-1',performedBy:'user-1',...overrides},source)
const setpoint=(overrides={},previous=null)=>createEnvironmentSetpointVersion({id:'setpoint-shared',...base,setpointKey:'site-shared:room-shared:climate',effectiveFrom:'2026-08-16T08:00:00.000Z',createdAt:'2026-08-16T08:00:00.000Z',createdBy:'user-1',targets:{temperature:{minimum:20,maximum:28},humidity:{minimum:50,maximum:70},co2:{maximum:1200}},...overrides},previous)

test('M31-F009: dispositivo, calibración, setpoint y lectura forman evidencia inmutable sin targets embebidos',()=>{
 const sensor=device(),record=calibration(sensor),target=setpoint()
 const reading=createEnvironmentalReading({id:'reading-1',...base,recordedAt:'2026-08-16T10:00:00.000Z',source:MEASUREMENT_SOURCES.SENSOR,values:{temperature:31,humidity:40,co2:900}},{device:sensor,calibration:record,setpoint:target})
 const alerts=deriveEnvironmentAlerts(reading,target)
 assert.equal(reading.deviceId,sensor.id)
 assert.equal(reading.calibrationId,record.id)
 assert.equal(reading.setpointId,target.id)
 assert.equal(Object.prototype.hasOwnProperty.call(reading,'targets'),false)
 assert.equal(Object.prototype.hasOwnProperty.call(reading,'targetTempMin'),false)
 assert.deepEqual(alerts.map(item=>[item.variable,item.direction]),[['temperature','HIGH'],['humidity','LOW']])
 assert.ok(Object.isFrozen(sensor)&&Object.isFrozen(record)&&Object.isFrozen(target.targets)&&Object.isFrozen(reading.values)&&Object.isFrozen(alerts[0]))
})

test('M31-F009: SENSOR/CONTROLLER exige dispositivo correcto y calibración PASS vigente para todas las variables',()=>{
 const sensor=device(),record=calibration(sensor),target=setpoint(),input={id:'reading-1',...base,recordedAt:'2026-08-16T10:00:00.000Z',source:MEASUREMENT_SOURCES.SENSOR,values:{temperature:24,humidity:60}}
 assert.equal(calibrationEffectiveAt(record,{device:sensor,variables:['temperature'],at:input.recordedAt}),true)
 assert.equal(effectiveEnvironmentCalibration([record],{...base,device:sensor,variables:['temperature'],at:input.recordedAt,calibrationId:record.id}).id,record.id)
 assert.throws(()=>createEnvironmentalReading(input,{device:sensor,setpoint:target}),/calibración/)
 assert.throws(()=>createEnvironmentalReading(input,{device:sensor,calibration:calibration(sensor,{result:CALIBRATION_RESULTS.FAIL}),setpoint:target}),/calibración/)
 assert.throws(()=>createEnvironmentalReading(input,{device:sensor,calibration:calibration(sensor,{validUntil:'2026-08-16T09:00:00.000Z'}),setpoint:target}),/calibración/)
 const controller=device({id:'controller-1',kind:ENVIRONMENT_DEVICE_KINDS.CONTROLLER})
 assert.throws(()=>createEnvironmentalReading(input,{device:controller,calibration:calibration(controller),setpoint:target}),/fuente no coincide/)
 const controllerCalibration=calibration(controller,{id:'controller-calibration'})
 assert.equal(createEnvironmentalReading({...input,id:'controller-reading',source:MEASUREMENT_SOURCES.CONTROLLER},{device:controller,calibration:controllerCalibration,setpoint:target}).source,MEASUREMENT_SOURCES.CONTROLLER)
 const inactive=device({id:'inactive-1',status:ENVIRONMENT_DEVICE_STATUSES.INACTIVE})
 assert.throws(()=>createEnvironmentCalibration({id:'bad',...base,result:CALIBRATION_RESULTS.PASS,performedAt:'2026-08-16T08:00:00.000Z',methodId:'m',performedBy:'u'},inactive),/activo/)
})

test('M31-F009: las seis fuentes son explícitas y la evidencia no intercambia semánticas',()=>{
 const common={...base,recordedAt:'2026-08-16T10:00:00.000Z',values:{temperature:24}}
 const manual=createEnvironmentalReading({id:'manual',...common,source:MEASUREMENT_SOURCES.MANUAL,sourceEvidence:{actorId:'user-1'}})
 const sample=createEnvironmentalReading({id:'sample',...common,source:MEASUREMENT_SOURCES.SAMPLE,sourceEvidence:{sampleId:'sample-1'}})
 const imported=createEnvironmentalReading({id:'imported',...common,source:MEASUREMENT_SOURCES.IMPORTED,sourceEvidence:{importId:'import-1'}})
 const calculated=createEnvironmentalReading({id:'calculated',...common,source:MEASUREMENT_SOURCES.CALCULATED,sourceEvidence:{methodId:'vpd-1',inputReadingIds:['manual']}})
 assert.deepEqual([manual.source,sample.source,imported.source,calculated.source],[MEASUREMENT_SOURCES.MANUAL,MEASUREMENT_SOURCES.SAMPLE,MEASUREMENT_SOURCES.IMPORTED,MEASUREMENT_SOURCES.CALCULATED])
 assert.throws(()=>createEnvironmentalReading({id:'bad-sample',...common,source:MEASUREMENT_SOURCES.SAMPLE,sourceEvidence:{}}),/sampleId/)
 assert.throws(()=>createEnvironmentalReading({id:'bad-import',...common,source:MEASUREMENT_SOURCES.IMPORTED,sourceEvidence:{}}),/importId/)
 assert.throws(()=>createEnvironmentalReading({id:'bad-calculation',...common,source:MEASUREMENT_SOURCES.CALCULATED,sourceEvidence:{methodId:'vpd-1',inputReadingIds:[]}}),/al menos una lectura/)
 assert.throws(()=>createEnvironmentalReading({id:'bad-device',...common,source:MEASUREMENT_SOURCES.MANUAL,deviceId:'device-1',sourceEvidence:{actorId:'u'}},{device:device()}),/Solo SENSOR/)
})

test('M31-F009: setpoints son append-only y la selección vigente es determinista por tenant y tiempo',()=>{
 const first=setpoint(),second=setpoint({id:'setpoint-v2',effectiveFrom:'2026-08-17T08:00:00.000Z',createdAt:'2026-08-17T08:00:00.000Z',targets:{temperature:{minimum:21,maximum:27}}},first)
 const foreign=setpoint({organizationId:'org-b',targets:{temperature:{minimum:1,maximum:2}}})
 assert.equal(first.version,1)
 assert.equal(second.version,2)
 assert.equal(second.supersedesSetpointId,first.id)
 assert.equal(first.targets.temperature.minimum,20)
 assert.equal(currentEnvironmentSetpoint([foreign,second,first],{...base,at:'2026-08-16T12:00:00.000Z'}).id,first.id)
 assert.equal(currentEnvironmentSetpoint([foreign,second,first],{...base,at:'2026-08-18T12:00:00.000Z'}).id,second.id)
 assert.throws(()=>currentEnvironmentSetpoint([first,{...first,id:'duplicate-version'}],{...base,at:'2026-08-18T12:00:00.000Z'}),/versión duplicada/)
 assert.throws(()=>createEnvironmentSetpointVersion({...first,id:'bad',organizationId:'org-b',createdBy:'u'},first),/mismo ámbito/)
})

test('M31-F009: scope y merge conservan homónimos extranjeros y excluyen ownership ambiguo',()=>{
 const state={
  companies:[{id:'org-a'},{id:'org-b'}],currentContext:{companyId:'org-a'},
  sites:[{id:'site-shared',organizationId:'org-a'},{id:'site-shared',organizationId:'org-b'}],
  operationalAreas:[{id:'area-shared',organizationId:'org-a',siteId:'site-shared'},{id:'area-shared',organizationId:'org-b',siteId:'site-shared'}],
  infrastructureElements:[{id:'room-shared',organizationId:'org-a',siteId:'site-shared'},{id:'room-shared',organizationId:'org-b',siteId:'site-shared'}],
  environmentDevices:[device(),device({organizationId:'org-b',name:'Sensor extranjero'})],environmentCalibrations:[],environmentSetpoints:[],environmentalReadings:[],environmentAlerts:[]
 }
 const scoped=scopeEnvironmentState(state)
 assert.equal(scoped.sites.length,1)
 assert.equal(scoped.infrastructureElements.length,1)
 assert.equal(scoped.environmentDevices.length,1)
 assert.equal(scoped.environmentDevices[0].name,'Sensor clima')
 const added=device({id:'device-new',name:'Nuevo'})
 const merged=mergeEnvironmentState(state,{...scoped,environmentDevices:[...scoped.environmentDevices,added]},'org-a')
 assert.equal(merged.environmentDevices.length,3)
 assert.equal(merged.environmentDevices.find(item=>item.organizationId==='org-b').name,'Sensor extranjero')
 assert.equal(merged.environmentDevices.find(item=>item.id==='device-new').organizationId,'org-a')
})

test('M31-F009: migración mueve targets legacy a setpoints, registra fuente importada y genera alertas una sola vez',()=>{
 const legacy={
  companies:[{id:'org-a'}],currentContext:{companyId:'org-a'},
  sites:[{id:'site-shared',organizationId:'org-a'}],infrastructureElements:[{id:'room-shared',organizationId:'org-a',siteId:'site-shared'}],operationalAreas:[],
  environmentalReadings:[{id:'legacy-reading',siteId:'site-shared',elementId:'room-shared',recordedAt:'2026-08-16T10:00:00.000Z',temperature:'31',humidity:'40',targetTempMin:'20',targetTempMax:'28',targetHumidityMin:'50',targetHumidityMax:'70'}]
 }
 const once=migrateLegacyEnvironmentState(legacy),twice=migrateLegacyEnvironmentState(once),reading=once.environmentalReadings[0]
 assert.equal(reading.organizationId,'org-a')
 assert.equal(reading.source,MEASUREMENT_SOURCES.IMPORTED)
 assert.deepEqual(reading.values,{temperature:31,humidity:40})
 assert.equal(Object.prototype.hasOwnProperty.call(reading,'targetTempMin'),false)
 assert.equal(once.environmentSetpoints.length,1)
 assert.equal(once.environmentAlerts.length,2)
 assert.equal(twice.environmentSetpoints.length,1)
 assert.equal(twice.environmentAlerts.length,2)
})

test('M31-F009: migración multiempresa no secuestra una lectura legacy ambigua',()=>{
 const state=migrateLegacyEnvironmentState({
  companies:[{id:'org-a'},{id:'org-b'}],currentContext:{companyId:'org-a'},
  sites:[{id:'site-shared',organizationId:'org-a'},{id:'site-shared',organizationId:'org-b'}],operationalAreas:[],infrastructureElements:[],
  environmentalReadings:[{id:'shared-reading',siteId:'site-shared',elementId:'room-shared',temperature:24,humidity:60,targetTempMin:20,targetTempMax:28}]
 })
 assert.equal(state.environmentalReadings[0].organizationId,'')
 assert.equal(state.environmentalReadings[0].migrationStatus,'UNRESOLVED_OWNERSHIP')
 assert.equal(scopeEnvironmentState(state,'org-a').environmentalReadings.length,0)
 assert.equal(scopeEnvironmentState(state,'org-b').environmentalReadings.length,0)
})

test('M31-F009: evidencia legacy corrupta queda en cuarentena sin impedir cargar el estado',()=>{
 const state=migrateLegacyEnvironmentState({
  companies:[{id:'org-a'}],sites:[{id:'site-shared',organizationId:'org-a'}],operationalAreas:[],infrastructureElements:[{id:'room-shared',organizationId:'org-a',siteId:'site-shared'}],
  environmentalReadings:[{id:'corrupt',siteId:'site-shared',elementId:'room-shared',temperature:999,targetTempMin:90,targetTempMax:10}]
 })
 assert.equal(state.environmentalReadings[0].migrationStatus,'INVALID_READING_EVIDENCE')
 assert.equal(state.environmentSetpoints[0].migrationStatus,'INVALID_TARGET_EVIDENCE')
 assert.equal(scopeEnvironmentState(state,'org-a').environmentalReadings.length,0)
 assert.equal(scopeEnvironmentState(state,'org-a').environmentSetpoints.length,0)
})
