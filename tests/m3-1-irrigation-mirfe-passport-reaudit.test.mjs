import test from'node:test'
import assert from'node:assert/strict'
import{projectPlantIrrigationMirfe}from'../src/core/passport/irrigationMirfePassportProjection.js'

function projectionState(){return{
 sites:[{id:'site-a',organizationId:'org-a',companyId:'org-a'}],
 houses:[{id:'house-a',organizationId:'org-a',siteId:'site-a'}],
 beds:[{id:'bed-a',organizationId:'org-a',siteId:'site-a',houseId:'house-a'}],
 irrigationEmitters:[{id:'emitter-a',organizationId:'org-a',siteId:'site-a',kind:'RING'}],
 irrigationSectors:[{id:'sector-a',organizationId:'org-a',siteId:'site-a',houseId:'house-a'}],
 irrigationAssignments:[{id:'assignment-a',organizationId:'org-a',siteId:'site-a',sectorId:'sector-a',emitterId:'emitter-a',targetType:'BED',targetId:'bed-a',validFrom:'2026-08-01T00:00:00.000Z',validTo:'2026-08-31T23:59:59.999Z'}],
 irrigationPulses:[],irrigationMeasurements:[],drainageMeasurements:[],irrigationApplications:[],tankPreparations:[],formulations:[],inventoryLots:[],products:[]
}}
const input={plant:{id:'plant-a',createdAt:'2026-08-05T00:00:00.000Z'},location:{bed:{id:'bed-a'},house:{id:'house-a'},site:{id:'site-a'}},organizationId:'org-a'}

test('M31-F012 re-audit: duplicate active-tenant irrigation identities fail closed',()=>{
 const state=projectionState(),pulse={id:'pulse-dup',organizationId:'org-a',siteId:'site-a',sectorId:'sector-a',startedAt:'2026-08-10T12:00:00.000Z',actualVolumeLiters:10}
 state.irrigationPulses=[pulse,{...pulse,actualVolumeLiters:11}]
 assert.throws(()=>projectPlantIrrigationMirfe(state,input),/identidad duplicada/)
})

test('M31-F012 re-audit: evidence outside plant and assignment causal windows is excluded',()=>{
 const state=projectionState()
 state.irrigationPulses=[
  {id:'pulse-before-plant',organizationId:'org-a',siteId:'site-a',sectorId:'sector-a',startedAt:'2026-08-03T12:00:00.000Z',actualVolumeLiters:7},
  {id:'pulse-valid',organizationId:'org-a',siteId:'site-a',sectorId:'sector-a',startedAt:'2026-08-10T12:00:00.000Z',actualVolumeLiters:12}
 ]
 state.irrigationApplications=[
  {id:'app-before-plant',organizationId:'org-a',siteId:'site-a',houseId:'house-a',preparationId:'missing-prep',createdAt:'2026-08-03T12:00:00.000Z',volumeL:50},
  {id:'app-after-window',organizationId:'org-a',siteId:'site-a',houseId:'house-a',preparationId:'missing-prep',createdAt:'2026-09-02T12:00:00.000Z',volumeL:50}
 ]
 const projection=projectPlantIrrigationMirfe(state,input)
 assert.deepEqual(projection.summary.pulseIds,['pulse-valid'])
 assert.equal(projection.summary.actualIrrigationVolumeLiters,12)
 assert.deepEqual(projection.summary.applicationIds,[])
})
