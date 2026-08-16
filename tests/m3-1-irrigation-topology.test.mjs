import test from'node:test'
import assert from'node:assert/strict'
import{IRRIGATION_CALCULATION_MODES,irrigationHydraulicsForPlan}from'../src/domain/irrigationTopology.js'
import{IRRIGATION_EMITTER_KINDS,IRRIGATION_TARGET_TYPES,createIrrigationAssignment,createIrrigationEmitter,createIrrigationSector}from'../src/domain/irrigationMirfe.js'
import{scopeIrrigationMirfeState}from'../src/domain/irrigationMirfeTenancy.js'

const organizationId='org-a',foreignOrganizationId='org-b',siteId='site-1',houseId='house-1',geneticId='g-1',validFrom='2026-08-15T00:00:00.000Z'

function emitter(id,kind,flow,{organization=organizationId,outlets=1,stakes=1,plantsPerEmitter=1,controllerDeviceId='controller-1'}={}){
 return createIrrigationEmitter({id,organizationId:organization,siteId,name:id,kind,flowLitersPerHour:flow,outletCount:outlets,stakesPerPlant:stakes,plantsPerEmitter,controllerDeviceId})
}

function sector(id,{organization=organizationId,controller=true}={}){
 return createIrrigationSector({id,organizationId:organization,siteId,name:id,houseId,metadata:{controller}})
}

function assignment(id,emitterId,sectorId,targetType,targetId,plantsServed,{organization=organizationId,emitterCount=1,validTo=null}={}){
 return createIrrigationAssignment({id,organizationId:organization,siteId,emitterId,sectorId,targetType,targetId,plantsServed,emitterCount,validFrom,validTo})
}

function fixture(){
 const beds=[
  {id:'bed-direct',organizationId,siteId,houseId,geneticId,activePlants:2},
  {id:'bed-shared',organizationId,siteId,houseId,geneticId,activePlants:2},
  {id:'bed-multi',organizationId,siteId,houseId,geneticId,activePlants:1}
 ]
 const plantPositions=[
  {id:'position-ring',organizationId,siteId,bedId:'bed-direct',geneticId,active:true,status:'Activa'},
  {id:'position-stake',organizationId,siteId,bedId:'bed-direct',geneticId,active:true,status:'Activa'},
  {id:'position-shared-1',organizationId,siteId,bedId:'bed-shared',geneticId,active:true,status:'Activa'},
  {id:'position-shared-2',organizationId,siteId,bedId:'bed-shared',geneticId,active:true,status:'Activa'},
  {id:'position-multi',organizationId,siteId,bedId:'bed-multi',geneticId,active:true,status:'Activa'}
 ]
 const activeEmitters=[
  emitter('emitter-ring',IRRIGATION_EMITTER_KINDS.RING,2),
  emitter('emitter-stake',IRRIGATION_EMITTER_KINDS.STAKE,4,{outlets:4,stakes:4,controllerDeviceId:''}),
  emitter('emitter-shared',IRRIGATION_EMITTER_KINDS.SHARED,4,{outlets:4,stakes:2,plantsPerEmitter:2}),
  emitter('emitter-multi',IRRIGATION_EMITTER_KINDS.MULTI,2)
 ]
 const foreignEmitters=activeEmitters.map(item=>emitter(item.id,item.kind,99,{organization:foreignOrganizationId,outlets:item.outletCount,stakes:item.stakesPerPlant,plantsPerEmitter:item.plantsPerEmitter}))
 const activeSectors=[sector('sector-automatic'),sector('sector-manual')]
 const foreignSectors=activeSectors.map(item=>sector(item.id,{organization:foreignOrganizationId}))
 const activeAssignments=[
  assignment('assignment-ring','emitter-ring','sector-automatic',IRRIGATION_TARGET_TYPES.POSITION,'position-ring',1),
  assignment('assignment-stake','emitter-stake','sector-manual',IRRIGATION_TARGET_TYPES.POSITION,'position-stake',1),
  assignment('assignment-shared','emitter-shared','sector-automatic',IRRIGATION_TARGET_TYPES.BED,'bed-shared',2),
  assignment('assignment-multi','emitter-multi','sector-automatic',IRRIGATION_TARGET_TYPES.POSITION,'position-multi',1,{emitterCount:2})
 ]
 const foreignAssignments=activeAssignments.map(item=>assignment(item.id,item.emitterId,item.sectorId,item.targetType,item.targetId,item.plantsServed,{organization:foreignOrganizationId,emitterCount:item.emitterCount}))
 return{
  companies:[{id:organizationId},{id:foreignOrganizationId}],currentContext:{companyId:organizationId},
  sites:[{id:siteId,organizationId:foreignOrganizationId},{id:siteId,organizationId}],
  houses:[{id:houseId,organizationId:foreignOrganizationId,siteId},{id:houseId,organizationId,siteId}],
  genetics:[{id:geneticId,organizationId:foreignOrganizationId},{id:geneticId,organizationId}],
  beds:[...beds.map(item=>({...item,organizationId:foreignOrganizationId,activePlants:999})),...beds],
  plantPositions:[...plantPositions.map(item=>({...item,organizationId:foreignOrganizationId})),...plantPositions],
  propagationBanks:[],propagationUnits:[],
  irrigationEmitters:[...foreignEmitters,...activeEmitters],irrigationSectors:[...foreignSectors,...activeSectors],irrigationAssignments:[...foreignAssignments,...activeAssignments]
 }
}

const input={organizationId,siteId,houseId,geneticId,at:'2026-08-16T12:00:00.000Z',apps:3,minutes:60,tank:1000,legacyRows:[{activePlants:999,drippers:99,flow:99}]}

test('M31-F004: la vista operativa proyecta solo topología del tenant activo',()=>{
 const view=scopeIrrigationMirfeState(fixture())
 assert.equal(view.irrigationEmitters.length,4)
 assert.equal(view.irrigationSectors.length,2)
 assert.equal(view.irrigationAssignments.length,4)
 assert.ok(view.irrigationEmitters.every(item=>item.organizationId===organizationId))
})

test('M31-F004: RING, STAKE, SHARED y MULTI calculan por emisor físico sin contaminarse entre tenants',()=>{
 const result=irrigationHydraulicsForPlan(fixture(),input)
 assert.equal(result.calculationMode,IRRIGATION_CALCULATION_MODES.CANONICAL_TOPOLOGY)
 assert.equal(result.plants,5)
 assert.equal(result.emitterCount,5)
 assert.equal(result.flow,14)
 assert.equal(result.pulse,14)
 assert.equal(result.daily,42)
 assert.equal(result.perPlantFlowLitersPerHour,2.8)
 assert.equal(result.assignmentCount,4)
 assert.equal(result.sectorCount,2)
 assert.deepEqual(result.topologySnapshot.assignmentIds,['assignment-ring','assignment-stake','assignment-shared','assignment-multi'])
 assert.equal(result.topologySnapshot.rows.find(row=>row.assignmentId==='assignment-stake').controlMode,'MANUAL')
 assert.equal(result.topologySnapshot.rows.find(row=>row.assignmentId==='assignment-ring').controlMode,'AUTOMATIC')
})

test('M31-F004: filtro por sector recalcula plantas, emitters y volumen exclusivamente',()=>{
 const result=irrigationHydraulicsForPlan(fixture(),{...input,sectorId:'sector-automatic'})
 assert.equal(result.plants,4)
 assert.equal(result.emitterCount,4)
 assert.equal(result.flow,10)
 assert.equal(result.daily,30)
 assert.equal(result.sectorCount,1)
})

test('M31-F004: sin topología configurada conserva cálculo legacy explícito',()=>{
 const state={companies:[{id:organizationId}],currentContext:{companyId:organizationId},sites:[{id:siteId,organizationId}],houses:[{id:houseId,organizationId,siteId}],genetics:[{id:geneticId,organizationId}],irrigationAssignments:[]}
 const result=irrigationHydraulicsForPlan(state,{...input,legacyRows:[{activePlants:10,drippers:1,flow:2}]})
 assert.equal(result.calculationMode,IRRIGATION_CALCULATION_MODES.LEGACY_BEDS)
 assert.equal(result.plants,10)
 assert.equal(result.flow,20)
 assert.equal(result.topologySnapshot,null)
})

test('M31-F004: referencia disponible solo en otro tenant falla cerrado',()=>{
 const state=fixture()
 state.irrigationEmitters=state.irrigationEmitters.filter(item=>item.organizationId===foreignOrganizationId||item.id!=='emitter-ring')
 assert.throws(()=>irrigationHydraulicsForPlan(state,input),/emisor no existe/)
})

test('M31-F004: capacidad de plantas y salidas/estacas se valida antes del cálculo',()=>{
 const state=fixture()
 state.irrigationEmitters=state.irrigationEmitters.map(item=>item.organizationId===organizationId&&item.id==='emitter-shared'?emitter('emitter-shared',IRRIGATION_EMITTER_KINDS.SHARED,4,{outlets:2,stakes:2,plantsPerEmitter:2}):item)
 assert.throws(()=>irrigationHydraulicsForPlan(state,input),/salidas\/estacas/)
})

test('M31-F004: mezclar Assignment de cama y Position evita doble conteo',()=>{
 const state=fixture()
 state.irrigationEmitters.push(emitter('emitter-bed',IRRIGATION_EMITTER_KINDS.SHARED,4,{outlets:2,plantsPerEmitter:2}))
 state.irrigationAssignments.push(assignment('assignment-bed','emitter-bed','sector-automatic',IRRIGATION_TARGET_TYPES.BED,'bed-direct',2))
 assert.throws(()=>irrigationHydraulicsForPlan(state,input),/mezcla Assignment de cama y Position/)
})

test('M31-F004: una topología existente sin vigencia no cae silenciosamente al legacy',()=>{
 const state=fixture()
 state.irrigationAssignments=state.irrigationAssignments.filter(item=>item.organizationId===organizationId).slice(0,1).map(item=>({...item,validTo:'2026-08-15T01:00:00.000Z'}))
 assert.throws(()=>irrigationHydraulicsForPlan(state,input),/no tiene Assignments vigentes/)
})

test('M31-F004: bandeja valida capacidad, unidades activas y genética',()=>{
 const state=fixture()
 state.irrigationEmitters=[emitter('emitter-tray',IRRIGATION_EMITTER_KINDS.SHARED,6,{outlets:3,plantsPerEmitter:3})]
 state.irrigationSectors=[createIrrigationSector({id:'sector-tray',organizationId,siteId,name:'Propagación'})]
 state.propagationBanks=[{id:'bank-1',organizationId,siteId,active:true,trays:[{id:'tray-1',quantity:1,cellsPerTray:30}]}]
 state.propagationUnits=[1,2,3].map(index=>({id:`unit-${index}`,organizationId,siteId,bankId:'bank-1',trayId:'tray-1',geneticId,status:'Activo'}))
 state.irrigationAssignments=[assignment('assignment-tray','emitter-tray','sector-tray',IRRIGATION_TARGET_TYPES.TRAY,'tray-1',3)]
 const result=irrigationHydraulicsForPlan(state,{...input,houseId:'',apps:1,minutes:10})
 assert.equal(result.plants,3)
 assert.equal(result.flow,6)
 assert.equal(result.pulse,1)
})
