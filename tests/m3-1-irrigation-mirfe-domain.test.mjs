import test from'node:test'
import assert from'node:assert/strict'
import{IRRIGATION_EMITTER_KINDS,IRRIGATION_TARGET_TYPES,MEASUREMENT_SOURCES,IRRIGATION_PULSE_STATUSES,FERTIGATION_STATUSES,createIrrigationEmitter,createIrrigationSector,irrigationAssignmentFromTopology,createIrrigationPulse,createIrrigationMeasurement,createDrainageMeasurement,createFertigationProduct,createFertigationFormula,nextFertigationFormulaVersion,createFertigationPreparation,createFertigationApplication}from'../src/domain/irrigationMirfe.js'

const emitter=organizationId=>createIrrigationEmitter({id:'emitter-shared',organizationId,siteId:`site-${organizationId}`,name:'Anillo 2 L/h',kind:IRRIGATION_EMITTER_KINDS.RING,flowLitersPerHour:2})
const sector=organizationId=>createIrrigationSector({id:'sector-shared',organizationId,siteId:`site-${organizationId}`,name:'Sector 1'})

test('M31-F001: topology entities preserve tenant ownership with repeated ids',()=>{
 const aEmitter=emitter('org-a'),bEmitter=emitter('org-b'),aSector=sector('org-a'),bSector=sector('org-b')
 const a=irrigationAssignmentFromTopology({id:'assignment-shared',targetType:IRRIGATION_TARGET_TYPES.POSITION,targetId:'plant-shared',emitterCount:1,plantsServed:1,validFrom:'2026-08-15T12:00:00.000Z'},{emitter:aEmitter,sector:aSector})
 const b=irrigationAssignmentFromTopology({id:'assignment-shared',targetType:IRRIGATION_TARGET_TYPES.POSITION,targetId:'plant-shared',validFrom:'2026-08-15T12:00:00.000Z'},{emitter:bEmitter,sector:bSector})
 assert.equal(a.organizationId,'org-a')
 assert.equal(b.organizationId,'org-b')
 assert.equal(a.id,b.id)
 assert.notEqual(a.siteId,b.siteId)
 assert.equal(Object.isFrozen(a),true)
})

test('M31-F001: topology rejects cross-tenant references and invalid shared emitters',()=>{
 assert.throws(()=>irrigationAssignmentFromTopology({id:'a',targetType:'POSITION',targetId:'p',validFrom:'2026-08-15T12:00:00Z'},{emitter:emitter('org-a'),sector:sector('org-b')}),/misma organización/)
 assert.throws(()=>createIrrigationEmitter({id:'e',organizationId:'org-a',siteId:'s',name:'Compartido',kind:'SHARED',flowLitersPerHour:2,plantsPerEmitter:1}),/al menos dos/)
 assert.throws(()=>createIrrigationEmitter({id:'e',organizationId:'org-a',siteId:'s',name:'Desconocido',kind:'UNKNOWN',flowLitersPerHour:2}),/catálogo canónico/)
})

test('M31-F001: assignments reject invalid target and validity windows',()=>{
 const refs={emitter:emitter('org-a'),sector:sector('org-a')}
 assert.throws(()=>irrigationAssignmentFromTopology({id:'a',targetType:'HOUSE',targetId:'h',validFrom:'2026-08-15T12:00:00Z'},refs),/catálogo canónico/)
 assert.throws(()=>irrigationAssignmentFromTopology({id:'a',targetType:'BED',targetId:'b',validFrom:'2026-08-16T12:00:00Z',validTo:'2026-08-15T12:00:00Z'},refs),/anterior/)
})

test('M31-F001: pulses and measurements require canonical source and serializable numeric evidence',()=>{
 const pulse=createIrrigationPulse({id:'pulse-1',organizationId:'org-a',siteId:'site-a',sectorId:'sector-1',source:MEASUREMENT_SOURCES.CONTROLLER,status:IRRIGATION_PULSE_STATUSES.COMPLETED,startedAt:'2026-08-15T12:00:00Z',completedAt:'2026-08-15T12:05:00Z',durationSeconds:300,plannedVolumeLiters:100,actualVolumeLiters:98})
 const measurement=createIrrigationMeasurement({id:'measurement-1',organizationId:'org-a',siteId:'site-a',sectorId:'sector-1',pulseId:pulse.id,measuredAt:pulse.completedAt,source:MEASUREMENT_SOURCES.SENSOR,deviceId:'sensor-1',values:{ec:2.1,ph:5.8,pressureBar:1.2},units:{ec:'mS/cm',pressureBar:'bar'}})
 assert.equal(pulse.actualVolumeLiters,98)
 assert.deepEqual(measurement.values,{ec:2.1,ph:5.8,pressureBar:1.2})
 assert.equal(Object.isFrozen(measurement.values),true)
 assert.throws(()=>createIrrigationPulse({...pulse,id:'bad',status:'COMPLETED',actualVolumeLiters:null}),/requiere actualVolumeLiters/)
 assert.throws(()=>createIrrigationMeasurement({...measurement,id:'bad',source:'DEVICE'}),/catálogo canónico/)
 assert.throws(()=>createIrrigationMeasurement({...measurement,id:'bad-2',values:{ec:Infinity}}),/número finito/)
})

test('M31-F001: drainage records applied, recovered volume and derived percentage',()=>{
 const drainage=createDrainageMeasurement({id:'d1',organizationId:'org-a',siteId:'site-a',sectorId:'sector-1',pulseId:'pulse-1',measuredAt:'2026-08-15T13:00:00Z',source:MEASUREMENT_SOURCES.SAMPLE,appliedVolumeLiters:100,drainedVolumeLiters:20,inputEc:2,drainEc:2.8,inputPh:5.8,drainPh:6.1})
 assert.equal(drainage.drainagePercent,20)
 assert.throws(()=>createDrainageMeasurement({...drainage,id:'bad',drainedVolumeLiters:101}),/no puede superar/)
})

test('M31-F001: fertigation product and formula are immutable tenant-owned authorities',()=>{
 const product=createFertigationProduct({id:'nutrient-shared',organizationId:'org-a',name:'Calcio',inventoryProductId:'inventory-1',analysis:{n:15.5,ca:19},solubilityGramsPerLiter:1200})
 const formula=createFertigationFormula({id:'formula-v1',organizationId:'org-a',siteId:'site-a',formulaKey:'veg-a',name:'Vegetativo A',stage:'Vegetativo',volumeLiters:1000,items:[{productId:product.id,tank:'A',grams:500}],createdAt:'2026-08-15T12:00:00Z'})
 assert.equal(product.organizationId,'org-a')
 assert.equal(formula.items[0].grams,500)
 assert.equal(Object.isFrozen(formula.items),true)
 assert.throws(()=>createFertigationFormula({...formula,id:'bad',items:[{productId:'p',tank:'A',grams:1},{productId:'p',tank:'A',grams:2}]}),/no puede repetir/)
 assert.throws(()=>createFertigationProduct({...product,id:'bad',analysis:{n:-1}}),/no puede ser negativo/)
})

test('M31-F001: formula versions preserve history and preparation snapshots',()=>{
 const v1=createFertigationFormula({id:'f-v1',organizationId:'org-a',siteId:'site-a',formulaKey:'flower-a',name:'Floración',stage:'Floración',geneticId:'g1',volumeLiters:800,items:[{productId:'p1',tank:'A',grams:400}],createdAt:'2026-08-15T12:00:00Z'})
 const snapshot=JSON.stringify(v1)
 const v2=nextFertigationFormulaVersion(v1,{id:'f-v2',items:[{productId:'p1',tank:'A',grams:420}],createdAt:'2026-08-16T12:00:00Z'})
 const preparation=createFertigationPreparation({id:'prep-1',status:FERTIGATION_STATUSES.PREPARED,createdAt:'2026-08-16T13:00:00Z'},v2)
 assert.equal(JSON.stringify(v1),snapshot)
 assert.equal(v2.version,2)
 assert.equal(v2.supersedesFormulaId,'f-v1')
 assert.equal(preparation.formulaVersion,2)
 assert.equal(preparation.items[0].requiredGrams,420)
})

test('M31-F001: application inherits preparation tenant and rejects excess or pending preparations',()=>{
 const formula=createFertigationFormula({id:'f',organizationId:'org-a',siteId:'site-a',name:'F',stage:'Veg',volumeLiters:100,items:[{productId:'p',tank:'A',grams:10}],createdAt:'2026-08-15T12:00:00Z'})
 const prepared=createFertigationPreparation({id:'prep',status:FERTIGATION_STATUSES.PREPARED,createdAt:'2026-08-15T13:00:00Z'},formula)
 const application=createFertigationApplication({id:'app',sectorId:'sector-a',volumeLiters:90,source:MEASUREMENT_SOURCES.MANUAL,appliedAt:'2026-08-15T14:00:00Z'},prepared)
 assert.equal(application.organizationId,'org-a')
 assert.equal(application.formulaVersion,1)
 assert.throws(()=>createFertigationApplication({...application,id:'too-much',volumeLiters:101},prepared),/superar/)
 const pending=createFertigationPreparation({id:'pending',createdAt:'2026-08-15T13:00:00Z'},formula)
 assert.throws(()=>createFertigationApplication({...application,id:'pending-app'},pending),/PREPARED/)
})
