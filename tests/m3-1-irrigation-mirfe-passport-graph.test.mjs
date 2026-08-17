import test from'node:test'
import assert from'node:assert/strict'
import{createCultivationPlantPassportFromState}from'../src/core/passport/cultivationPlantPassport.js'
import{createKnowledgeGraphRepository,projectPassportToGraph}from'../src/core/knowledgeGraph/index.js'

const baseState=()=>({
 companies:[{id:'org-a',name:'Org A'},{id:'org-b',name:'Org B'}],
 currentContext:{companyId:'org-a',siteId:'site-a'},
 sites:[{id:'site-a',companyId:'org-a',organizationId:'org-a',name:'Sede A'},{id:'site-b',companyId:'org-b',organizationId:'org-b',name:'Sede B'}],
 houses:[{id:'house-a',organizationId:'org-a',siteId:'site-a',name:'Nave A'},{id:'house-b',organizationId:'org-b',siteId:'site-b',name:'Nave B'}],
 beds:[{id:'bed-shared',organizationId:'org-a',siteId:'site-a',houseId:'house-a',name:'Cama A'},{id:'bed-shared',organizationId:'org-b',siteId:'site-b',houseId:'house-b',name:'Cama B'}],
 plantPositions:[{id:'plant-shared',organizationId:'org-a',siteId:'site-a',houseId:'house-a',bedId:'bed-shared',row:1,position:1,status:'Activa',active:true,createdAt:'2026-08-01T00:00:00.000Z'},{id:'plant-shared',organizationId:'org-b',siteId:'site-b',houseId:'house-b',bedId:'bed-shared',row:1,position:1,status:'Activa',active:true,createdAt:'2026-08-01T00:00:00.000Z'}],
 genetics:[],propagationUnits:[],propagationBatches:[],motherPlants:[],grandmotherPlants:[],attachments:[],findings:[],incidents:[],treatments:[],plantEvents:[],timelineEntries:[],
 growingMediumAssignments:[],growingMediumBatches:[],growingMediumProducts:[],growingMediumFormulas:[],growingMediumReusePolicies:[],growingMediumReuseCycles:[],
 irrigationEmitters:[{id:'emitter-shared',organizationId:'org-a',siteId:'site-a',name:'Anillo A',kind:'RING',flowLitersPerHour:4,outletCount:1,plantsPerEmitter:1},{id:'emitter-shared',organizationId:'org-b',siteId:'site-b',name:'Anillo B',kind:'RING',flowLitersPerHour:40,outletCount:1,plantsPerEmitter:1}],
 irrigationSectors:[{id:'sector-shared',organizationId:'org-a',siteId:'site-a',houseId:'house-a',name:'Sector A'},{id:'sector-shared',organizationId:'org-b',siteId:'site-b',houseId:'house-b',name:'Sector B'}],
 irrigationAssignments:[{id:'assignment-shared',organizationId:'org-a',siteId:'site-a',sectorId:'sector-shared',emitterId:'emitter-shared',targetType:'BED',targetId:'bed-shared',emitterCount:25,plantsServed:50,validFrom:'2026-08-01T00:00:00.000Z',validTo:'2026-08-31T23:59:59.999Z',active:true},{id:'assignment-shared',organizationId:'org-b',siteId:'site-b',sectorId:'sector-shared',emitterId:'emitter-shared',targetType:'BED',targetId:'bed-shared',emitterCount:99,plantsServed:999,validFrom:'2026-08-01T00:00:00.000Z',validTo:null,active:true}],
 irrigationPulses:[{id:'pulse-shared',organizationId:'org-a',siteId:'site-a',sectorId:'sector-shared',source:'CONTROLLER',status:'COMPLETED',startedAt:'2026-08-10T12:00:00.000Z',completedAt:'2026-08-10T12:05:00.000Z',durationSeconds:300,plannedVolumeLiters:10,actualVolumeLiters:12,deviceId:'controller-a'},{id:'pulse-old',organizationId:'org-a',siteId:'site-a',sectorId:'sector-shared',source:'CONTROLLER',status:'COMPLETED',startedAt:'2026-07-10T12:00:00.000Z',completedAt:'2026-07-10T12:05:00.000Z',durationSeconds:300,plannedVolumeLiters:7,actualVolumeLiters:7,deviceId:'controller-a'},{id:'pulse-shared',organizationId:'org-b',siteId:'site-b',sectorId:'sector-shared',source:'CONTROLLER',status:'COMPLETED',startedAt:'2026-08-10T12:00:00.000Z',completedAt:'2026-08-10T12:05:00.000Z',durationSeconds:300,plannedVolumeLiters:999,actualVolumeLiters:999,deviceId:'controller-b'}],
 irrigationMeasurements:[{id:'measurement-shared',organizationId:'org-a',siteId:'site-a',sectorId:'sector-shared',pulseId:'pulse-shared',measuredAt:'2026-08-10T12:05:00.000Z',source:'SENSOR',deviceId:'sensor-a',values:{ec:1.8,ph:5.8},units:{ec:'mS/cm',ph:'pH'}},{id:'measurement-shared',organizationId:'org-b',siteId:'site-b',sectorId:'sector-shared',pulseId:'pulse-shared',measuredAt:'2026-08-10T12:05:00.000Z',source:'SENSOR',deviceId:'sensor-b',values:{ec:9.9,ph:9.9},units:{ec:'mS/cm',ph:'pH'}}],
 drainageMeasurements:[{id:'drain-shared',organizationId:'org-a',siteId:'site-a',sectorId:'sector-shared',pulseId:'pulse-shared',measuredAt:'2026-08-10T12:10:00.000Z',source:'SAMPLE',appliedVolumeLiters:12,drainedVolumeLiters:2,drainagePercent:16.6667,inputEc:1.8,drainEc:2.2,inputPh:5.8,drainPh:5.9},{id:'drain-shared',organizationId:'org-b',siteId:'site-b',sectorId:'sector-shared',pulseId:'pulse-shared',measuredAt:'2026-08-10T12:10:00.000Z',source:'SAMPLE',appliedVolumeLiters:999,drainedVolumeLiters:800,drainagePercent:80.0801,inputEc:9.9,drainEc:9.9,inputPh:9.9,drainPh:9.9}],
 formulations:[{id:'formula-shared',organizationId:'org-a',siteId:'site-a',formulaKey:'formula-key',version:2,name:'Fórmula A',stage:'Floración',status:'Aprobada',waterAnalysisId:'water-a',nutrientObjectiveId:'objective-a'},{id:'formula-shared',organizationId:'org-b',siteId:'site-b',formulaKey:'formula-key-b',version:7,name:'Fórmula B',stage:'Vegetativo',status:'Aprobada',waterAnalysisId:'water-b',nutrientObjectiveId:'objective-b'}],
 tankPreparations:[{id:'prep-shared',organizationId:'org-a',siteId:'site-a',formulationId:'formula-shared',formulaKey:'formula-key',formulaVersion:2,volumeL:100,status:'Aplicada',totalCost:5000,preparedAt:'2026-08-10T11:00:00.000Z',appliedAt:'2026-08-10T12:00:00.000Z',items:[{id:'item-a',nutrientProductId:'nutrient-a',inventoryProductId:'inventory-product-shared',tank:'A',lotId:'lot-shared',consumedQuantity:.5,consumedUnit:'kg',cost:5000}]},{id:'prep-shared',organizationId:'org-b',siteId:'site-b',formulationId:'formula-shared',formulaKey:'formula-key-b',formulaVersion:7,volumeL:999,status:'Aplicada',totalCost:999999,preparedAt:'2026-08-10T11:00:00.000Z',appliedAt:'2026-08-10T12:00:00.000Z',items:[{id:'item-b',nutrientProductId:'nutrient-b',inventoryProductId:'inventory-product-shared',tank:'A',lotId:'lot-shared',consumedQuantity:99,consumedUnit:'kg',cost:999999}]}],
 irrigationApplications:[{id:'application-shared',organizationId:'org-a',siteId:'site-a',houseId:'house-a',preparationId:'prep-shared',formulationId:'formula-shared',formulaKey:'formula-key',formulaVersion:2,date:'2026-08-10',volumeL:100,ec:1.8,ph:5.8,status:'Aplicada',createdAt:'2026-08-10T12:00:00.000Z'},{id:'application-shared',organizationId:'org-b',siteId:'site-b',houseId:'house-b',preparationId:'prep-shared',formulationId:'formula-shared',formulaKey:'formula-key-b',formulaVersion:7,date:'2026-08-10',volumeL:999,ec:9.9,ph:9.9,status:'Aplicada',createdAt:'2026-08-10T12:00:00.000Z'}],
 products:[{id:'inventory-product-shared',organizationId:'org-a',siteId:'site-a',name:'Fertilizante A',unit:'kg'},{id:'inventory-product-shared',organizationId:'org-b',siteId:'site-b',name:'Fertilizante B',unit:'kg'}],
 inventoryLots:[{id:'lot-shared',organizationId:'org-a',siteId:'site-a',productId:'inventory-product-shared',lotCode:'LOT-A',quantity:10},{id:'lot-shared',organizationId:'org-b',siteId:'site-b',productId:'inventory-product-shared',lotCode:'LOT-B',quantity:1000}],
 nutrientProducts:[],nutrientObjectives:[],waterAnalyses:[],irrigationPlans:[],mirfePrograms:[],mirfeMonitoring:[],mirfeReinforcements:[],irrigationCorrections:[],irrigationHistory:[],inventoryMovements:[],workOrders:[],costEntries:[]
})

test('M31-F012: cultivation Passport explains irrigation and MIRFE evidence only inside the active tenant',()=>{
 const passport=createCultivationPlantPassportFromState(baseState(),{plantId:'plant-shared'})
 assert.equal(passport.object.organizationId,'org-a')
 const pulse=passport.relationships.find(item=>item.type==='received_irrigation_pulse')
 assert.equal(pulse.targetOrganizationId,'org-a')
 assert.equal(pulse.actualVolumeLiters,12)
 assert.equal(passport.relationships.some(item=>item.targetId==='pulse-old'),false)
 assert.equal(passport.relationships.some(item=>item.actualVolumeLiters===999||item.label==='Fórmula B'),false)
 const measurement=passport.relationships.find(item=>item.type==='has_irrigation_measurement')
 assert.deepEqual(measurement.values,{ec:1.8,ph:5.8})
 const drainage=passport.relationships.find(item=>item.type==='has_drainage_measurement')
 assert.equal(drainage.drainedVolumeLiters,2)
 const formula=passport.relationships.find(item=>item.type==='uses_fertigation_formula')
 assert.equal(formula.label,'Fórmula A v2')
 const lot=passport.relationships.find(item=>item.type==='consumed_inventory_lot')
 assert.equal(lot.label,'LOT-A')
 assert.equal(lot.uses[0].cost,5000)
 assert.equal(passport.indicators.find(item=>item.key==='irrigation_volume_liters').value,12)
 assert.equal(passport.indicators.find(item=>item.key==='fertigation_volume_liters').value,100)
 assert.equal(passport.indicators.find(item=>item.key==='drainage_volume_liters').value,2)
 assert.ok(passport.timeline.some(item=>item.id==='irrigation:pulse:pulse-shared'))
 assert.ok(passport.timeline.some(item=>item.id==='mirfe:application:application-shared'))
})

test('M31-F012: Knowledge Graph preserves canonical irrigation/MIRFE relations without foreign nodes',()=>{
 const passport=createCultivationPlantPassportFromState(baseState(),{plantId:'plant-shared'}),repository=createKnowledgeGraphRepository()
 const projected=projectPassportToGraph(repository,passport)
 for(const relation of['irrigated_by_assignment','served_by_irrigation_sector','served_by_irrigation_emitter','received_irrigation_pulse','has_irrigation_measurement','has_drainage_measurement','received_fertigation_application','fertigation_from_preparation','uses_fertigation_formula','consumed_inventory_lot'])assert.ok(projected.edges.some(edge=>edge.relationType===relation),relation)
 const snapshot=repository.snapshot()
 assert.equal(snapshot.nodes.some(node=>node.organizationId==='org-b'),false)
 assert.ok(snapshot.nodes.some(node=>node.nodeType==='irrigation.pulse'&&node.organizationId==='org-a'))
 assert.ok(snapshot.nodes.some(node=>node.nodeType==='mirfe.fertigation.formula'&&node.organizationId==='org-a'))
 assert.ok(snapshot.nodes.some(node=>node.nodeType==='inventory.lot'&&node.organizationId==='org-a'))
 const lotEdge=snapshot.edges.find(edge=>edge.relationType==='consumed_inventory_lot')
 assert.equal(lotEdge.metadata.relationship.uses[0].cost,5000)
})

test('M31-F012: a foreign-only irrigation reference fails closed instead of leaking homonymous evidence',()=>{
 const state=baseState()
 state.irrigationSectors=state.irrigationSectors.filter(item=>item.organizationId==='org-b')
 assert.throws(()=>createCultivationPlantPassportFromState(state,{plantId:'plant-shared'}),/sector de riego pertenece a otra empresa|sector de riego no existe/)
})

test('M31-F012: a foreign-only consumed inventory lot fails closed',()=>{
 const state=baseState()
 state.inventoryLots=state.inventoryLots.filter(item=>item.organizationId==='org-b')
 assert.throws(()=>createCultivationPlantPassportFromState(state,{plantId:'plant-shared'}),/lote de inventario consumido pertenece a otra empresa|lote de inventario consumido no existe/)
})

test('M31-F012: cultivation Passport remains unchanged when no irrigation or MIRFE evidence exists',()=>{
 const state=baseState()
 for(const collection of['irrigationEmitters','irrigationSectors','irrigationAssignments','irrigationPulses','irrigationMeasurements','drainageMeasurements','formulations','tankPreparations','irrigationApplications','inventoryLots'])state[collection]=[]
 const passport=createCultivationPlantPassportFromState(state,{plantId:'plant-shared'})
 assert.equal(passport.relationships.some(item=>String(item.targetType||'').startsWith('irrigation.')||String(item.targetType||'').startsWith('mirfe.')),false)
 assert.equal(passport.indicators.some(item=>item.key==='irrigation_assignments'||item.key==='fertigation_applications'),false)
})
