import test from'node:test'
import assert from'node:assert/strict'
import{operationalContextOptions,scopeOperationalState}from'../src/domain/operationalContext.js'

function state(){return{
 currentContext:{companyId:'org-a',siteId:'',houseId:'',bedId:'',plantId:''},
 companies:[{id:'org-a'}],
 users:[{id:'u1',active:true,activeSession:true},{id:'u2',active:true,activeSession:false}],
 memberships:[
  {id:'m1',userId:'u1',companyId:'org-a',siteIds:['site-1'],status:'active'},
  {id:'m2',userId:'u2',companyId:'org-a',siteIds:['site-2'],status:'active'}
 ],
 sites:[{id:'site-1',organizationId:'org-a',companyId:'org-a'},{id:'site-2',organizationId:'org-a',companyId:'org-a'}],
 houses:[{id:'house-1',organizationId:'org-a',siteId:'site-1'},{id:'house-2',organizationId:'org-a',siteId:'site-2'}],
 beds:[{id:'bed-1',organizationId:'org-a',houseId:'house-1'},{id:'bed-2',organizationId:'org-a',houseId:'house-2'}],
 plantPositions:[{id:'plant-1',organizationId:'org-a',bedId:'bed-1'},{id:'plant-2',organizationId:'org-a',bedId:'bed-2'}],
 incidents:[{id:'inc-1',organizationId:'org-a'}],
 findings:[
  {id:'finding-1',organizationId:'org-a',siteId:'site-1',plantPositionId:'plant-1',targetType:'POSITION',targetId:'plant-1',incidentId:'inc-1',status:'Detectado'},
  {id:'finding-2',organizationId:'org-a',siteId:'site-2',plantPositionId:'plant-2',targetType:'POSITION',targetId:'plant-2',incidentId:'inc-1',status:'Detectado'}
 ],
 treatments:[],mipeInterventions:[],genetics:[],propagationBanks:[],propagationUnits:[],products:[],inventoryLots:[],inventoryMovements:[],
 workOrders:[
  {id:'wo-1',organizationId:'org-a',siteId:'site-1'},
  {id:'wo-2',organizationId:'org-a',siteId:'site-2'},
  {id:'wo-global',organizationId:'org-a'}
 ],
 costEntries:[],grandmotherPlants:[],motherPlants:[],propagationBatches:[],
 mapElements:[
  {id:'map-1',organizationId:'org-a',houseId:'house-1'},
  {id:'map-2',organizationId:'org-a',houseId:'house-2'}
 ],
 facilityAreas:[],operationalAreas:[],finishedGoods:[],finishedGoodsMovements:[],sales:[],customers:[],phaseTransitions:[],
 plantEvents:[
  {id:'event-1',organizationId:'org-a',siteId:'site-1',plantId:'plant-1'},
  {id:'event-2',organizationId:'org-a',siteId:'site-2',plantId:'plant-2'}
 ]
}}

test('F010: contexto usa memberships del usuario con sesión activa, no las de otros usuarios almacenados',()=>{
 const current=state(),options=operationalContextOptions(current,current.currentContext)
 assert.deepEqual(options.sites.map(item=>item.id),['site-1'])
})

test('F010: Todas las sedes significa todas las sedes autorizadas, no todo el tenant',()=>{
 const current=state(),scoped=scopeOperationalState(current,current.currentContext)
 assert.deepEqual(scoped.sites.map(item=>item.id),['site-1'])
 assert.deepEqual(scoped.houses.map(item=>item.id),['house-1'])
 assert.deepEqual(scoped.beds.map(item=>item.id),['bed-1'])
 assert.deepEqual(scoped.plantPositions.map(item=>item.id),['plant-1'])
 assert.deepEqual(scoped.findings.map(item=>item.id),['finding-1'])
})

test('F010: Todas las sedes aplica el mismo scope autorizado a colecciones geográficas directas e indirectas',()=>{
 const current=state(),scoped=scopeOperationalState(current,current.currentContext)
 assert.deepEqual(scoped.workOrders.map(item=>item.id),['wo-1','wo-global'])
 assert.deepEqual(scoped.mapElements.map(item=>item.id),['map-1'])
 assert.deepEqual(scoped.plantEvents.map(item=>item.id),['event-1'])
})

test('F010: múltiples usuarios con activeSession fallan cerrado en vez de escoger el primero',()=>{
 const current=state();current.users[1].activeSession=true
 assert.throws(()=>operationalContextOptions(current,current.currentContext),/sesión activa es ambigua/i)
})
