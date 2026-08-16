import test from'node:test'
import assert from'node:assert/strict'
import{hydraulics}from'../src/domain/irrigation.js'
import{createFertigationFormula,createFertigationPreparation}from'../src/domain/irrigationMirfe.js'
import{MAX_IRRIGATION_TANK_CAPACITY_LITERS,planIrrigationTankLoads}from'../src/domain/irrigationTankPlanning.js'

test('M31-F007: capacidad máxima y frecuencia entera fallan cerrado',()=>{
 assert.equal(MAX_IRRIGATION_TANK_CAPACITY_LITERS,1000)
 assert.throws(()=>planIrrigationTankLoads({pulseVolumeLiters:100,applicationsPerDay:1,tankCapacityLiters:1001}),/no puede superar 1000 L/)
 assert.throws(()=>planIrrigationTankLoads({pulseVolumeLiters:100,applicationsPerDay:1.5,tankCapacityLiters:1000}),/entero positivo/)
 assert.throws(()=>planIrrigationTankLoads({pulseVolumeLiters:100,applicationsPerDay:1,tankCapacityLiters:0}),/mayor que cero/)
 assert.throws(()=>planIrrigationTankLoads({pulseVolumeLiters:1,applicationsPerDay:10001,tankCapacityLiters:1000}),/no puede superar 10000/)
 assert.throws(()=>planIrrigationTankLoads({pulseVolumeLiters:10000001,applicationsPerDay:1,tankCapacityLiters:1000}),/no puede superar 10000 preparaciones/)
})

test('M31-F007: cada aplicación se divide en cargas ejecutables sin superar el tanque',()=>{
 const result=planIrrigationTankLoads({planId:'plan-1',pulseVolumeLiters:1200,applicationsPerDay:2,tankCapacityLiters:1000})
 assert.equal(result.dailyVolumeLiters,2400)
 assert.equal(result.preparationsPerApplication,2)
 assert.equal(result.preparationCount,4)
 assert.deepEqual(result.loadSchedule.map(item=>item.volumeLiters),[1000,200,1000,200])
 assert.deepEqual(result.loadSchedule.map(item=>[item.applicationSequence,item.loadSequence]),[[1,1],[1,2],[2,1],[2,2]])
 assert.equal(result.loadSchedule[0].id,'plan-1:application:1:load:1')
 assert.ok(result.loadSchedule.every(item=>item.volumeLiters<=result.tankCapacityLiters&&item.status==='PLANNED'))
 assert.ok(Object.isFrozen(result)&&Object.isFrozen(result.loadSchedule)&&Object.isFrozen(result.loadSchedule[0]))
})

test('M31-F007: no agrega cargas atravesando fronteras de aplicación',()=>{
 const result=hydraulics([{activePlants:1,drippers:1,flow:400}],3,60,1000,{planId:'plan-2'})
 assert.equal(result.pulse,400)
 assert.equal(result.daily,1200)
 assert.equal(result.loads,3)
 assert.deepEqual(result.loadSchedule.map(item=>item.volumeLiters),[400,400,400])
 assert.deepEqual(result.preparationFrequency,{basis:'PER_APPLICATION',applicationsPerDay:3,preparationsPerApplication:1,preparationsPerDay:3})
})

test('M31-F007: una preparación parcial escala la fórmula sin cambiar concentración',()=>{
 const formula=createFertigationFormula({id:'formula-1',organizationId:'org-a',siteId:'site-1',name:'Vegetativo',stage:'Vegetativo',geneticId:'g-1',volumeLiters:1000,items:[{productId:'np-1',tank:'A',grams:500}],createdAt:'2026-08-16T16:00:00.000Z'})
 const preparation=createFertigationPreparation({id:'prep-1',volumeLiters:400,irrigationPlanId:'plan-1',loadId:'load-1',applicationSequence:1,loadSequence:1,createdAt:'2026-08-16T16:01:00.000Z'},formula)
 assert.equal(preparation.volumeLiters,400)
 assert.equal(preparation.items[0].requiredGrams,200)
 assert.equal(preparation.formulaVersion,1)
 assert.equal(preparation.irrigationPlanId,'plan-1')
 assert.throws(()=>createFertigationPreparation({id:'too-large',volumeLiters:1001,createdAt:'2026-08-16T16:01:00.000Z'},formula),/no puede superar 1000 L/)
})
