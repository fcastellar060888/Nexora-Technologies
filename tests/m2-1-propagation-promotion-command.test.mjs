import test from'node:test'
import assert from'node:assert/strict'
import{readFile}from'node:fs/promises'
import{POSITION_OCCUPANCY}from'../src/domain/facilityEngine.js'
import{PROPAGATION_PURPOSES}from'../src/domain/propagationPurpose.js'
import{executePropagationPromotionCommand,preparePropagationPromotion}from'../src/services/propagationPromotionCommand.js'

const fixture=()=>({
 companies:[{id:'org-a'},{id:'org-b'}],sites:[{id:'site-a',companyId:'org-a'},{id:'site-b',companyId:'org-b'}],currentContext:{companyId:'org-a',siteId:'site-a'},
 users:[{id:'u1',activeSession:true,active:true,remote:true}],roles:[{id:'grower',permissions:['manage_cultivation']}],memberships:[{id:'m1',userId:'u1',companyId:'org-a',roleId:'grower',siteIds:['site-a'],status:'active'}],
 propagationBatches:[
  {id:'same-batch',organizationId:'org-a',code:'LP-A',purpose:PROPAGATION_PURPOSES.PRODUCTION,entersProduction:true,siteId:'site-a',geneticId:'gen-1',sourcePlantId:'mother-a',activeQuantity:2,quantity:2,productionLotId:'prod-a'},
  {id:'same-batch',organizationId:'org-b',code:'LP-B',purpose:PROPAGATION_PURPOSES.PRODUCTION,entersProduction:true,siteId:'site-b',geneticId:'gen-1',sourcePlantId:'mother-b',activeQuantity:1,quantity:1,productionLotId:'prod-b'}
 ],
 propagationUnits:[
  {id:'u1',organizationId:'org-a',siteId:'site-a',batchId:'same-batch',code:'A-1',status:'Enraizado',directParentPlantId:'mother-a'},
  {id:'u2',organizationId:'org-a',siteId:'site-a',batchId:'same-batch',code:'A-2',status:'Enraizado',directParentPlantId:'mother-a'},
  {id:'u1',organizationId:'org-b',siteId:'site-b',batchId:'same-batch',code:'B-1',status:'Enraizado',directParentPlantId:'mother-b'}
 ],
 houses:[{id:'same-house',organizationId:'org-a',siteId:'site-a'},{id:'same-house',organizationId:'org-b',siteId:'site-b'}],
 beds:[{id:'same-bed',organizationId:'org-a',siteId:'site-a',houseId:'same-house',rows:1,plantsPerRow:2},{id:'same-bed',organizationId:'org-b',siteId:'site-b',houseId:'same-house',rows:1,plantsPerRow:1}],
 plantPositions:[
  {id:'same-bed-F1-P1',organizationId:'org-a',siteId:'site-a',bedId:'same-bed',row:1,position:1,active:false,status:'Vacía',occupancyState:POSITION_OCCUPANCY.EMPTY},
  {id:'same-bed-F1-P2',organizationId:'org-a',siteId:'site-a',bedId:'same-bed',row:1,position:2,active:false,status:'Vacía',occupancyState:POSITION_OCCUPANCY.EMPTY},
  {id:'same-bed-F1-P1',organizationId:'org-b',siteId:'site-b',bedId:'same-bed',row:1,position:1,active:false,status:'Vacía',occupancyState:POSITION_OCCUPANCY.EMPTY}
 ],
 motherPlants:[],grandmotherPlants:[],lotEvents:[]
})

const input=(overrides={})=>({commandId:'promote-1',occurredAt:'2026-08-15T04:00:00.000Z',batchId:'same-batch',unitIds:['u1','u2'],effectiveDate:'2026-08-15',houseId:'same-house',bedId:'same-bed',responsible:'Fer',...overrides})

test('M21-F007/F008: production promotion occupies canonical positions without creating new geometry',async()=>{
 let state=fixture(),events=[]
 const originalIds=state.plantPositions.filter(item=>item.organizationId==='org-a').map(item=>item.id)
 const commit=recipe=>{state=recipe(state)}
 const result=await executePropagationPromotionCommand(state,input(),{commit,publishEvent:async event=>events.push(event)})
 assert.equal(result.target,'PRODUCTION')
 const own=state.plantPositions.filter(item=>item.organizationId==='org-a')
 assert.deepEqual(own.map(item=>item.id),originalIds)
 assert.ok(own.every(item=>item.active&&item.status==='Activa'&&item.occupancyState===POSITION_OCCUPANCY.OCCUPIED))
 assert.deepEqual(own.map(item=>item.sourcePropagationUnitId),['u1','u2'])
 assert.deepEqual(state.propagationUnits.filter(item=>item.organizationId==='org-a').map(item=>item.plantPositionId),originalIds)
 assert.deepEqual(events.map(event=>event.name),['core.operation.requested','propagation.batch.promoted'])
})

test('M21-F007: cross-tenant duplicate ids resolve only within the active organization',()=>{
 const prepared=preparePropagationPromotion(fixture(),input(),{commandId:'promote-1',occurredAt:'2026-08-15T04:00:00.000Z'})
 assert.equal(prepared.batch.organizationId,'org-a')
 assert.ok(prepared.units.every(unit=>unit.organizationId==='org-a'))
 assert.ok(prepared.positions.every(position=>position.organizationId==='org-a'))
 assert.equal(prepared.destinationId,'prod-a')
})

test('M21-F008: insufficient canonical capacity fails before any commit',()=>{
 const state=fixture();state.plantPositions=state.plantPositions.filter(item=>item.organizationId!=='org-a'||item.position===1)
 assert.throws(()=>preparePropagationPromotion(state,input(),{commandId:'capacity'}),/solo tiene 1 posiciones canónicas libres/)
})

test('M21-F007: retry with same promotion command is state-idempotent',async()=>{
 let state=fixture(),events=[]
 const commit=recipe=>{state=recipe(state)}
 await executePropagationPromotionCommand(state,input(),{commit,publishEvent:async event=>events.push(event)})
 const before=structuredClone(state)
 const retry=await executePropagationPromotionCommand(state,input(),{commit,publishEvent:async event=>events.push(event)})
 assert.equal(retry.retry,true)
 assert.deepEqual(state,before)
 assert.equal(events.length,2)
})

test('M21-F007/F008: concurrent occupation aborts commit after durable intent',async()=>{
 const state=fixture(),events=[]
 await assert.rejects(()=>executePropagationPromotionCommand(state,input({unitIds:['u1']}),{
  publishEvent:async event=>events.push(event),
  commit:recipe=>recipe({...state,plantPositions:state.plantPositions.map(item=>item.organizationId==='org-a'&&item.id==='same-bed-F1-P1'?{...item,active:true,status:'Activa',occupancyState:POSITION_OCCUPANCY.OCCUPIED,sourcePropagationUnitId:'other'}:item)})
 }),/capacidad física cambió/)
 assert.equal(events[0].name,'core.operation.requested')
})

test('M21-F007: permission deny and already-promoted selection fail closed',async()=>{
 const denied=fixture();denied.roles=[{id:'viewer',permissions:[]}];let commits=0
 await assert.rejects(()=>executePropagationPromotionCommand(denied,input({unitIds:['u1']}),{commit:()=>{commits++},publishEvent:async()=>{}}),/permiso/)
 assert.equal(commits,0)
 const state=fixture();state.propagationUnits=state.propagationUnits.map(unit=>unit.organizationId==='org-a'&&unit.id==='u1'?{...unit,status:'Promovido',promotedAt:'2026-08-14',promotionCommandId:'other'}:unit)
 assert.throws(()=>preparePropagationPromotion(state,input({unitIds:['u1']}),{commandId:'new'}),/ya promovidos/)
})

test('M21-F007/F008 re-audit: promotion panel delegates to command and does not call legacy mutation',async()=>{
 const panel=await readFile(new URL('../src/components/RootedCuttingPromotionPanel.jsx',import.meta.url),'utf8')
 assert.match(panel,/executePropagationPromotionCommand/)
 assert.doesNotMatch(panel,/promotePropagationUnits/)
 assert.doesNotMatch(panel,/update\(store=>/)
 assert.match(panel,/posiciones canónicas libres/)
})
