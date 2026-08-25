import test from'node:test'
import assert from'node:assert/strict'
import{operationalContextForPlant,operationalContextOptions,scopeOperationalState}from'../src/domain/operationalContext.js'

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
 treatments:[],mipeInterventions:[],genetics:[],propagationBanks:[],propagationUnits:[],products:[],
 inventoryLots:[{id:'lot-1',organizationId:'org-a',siteId:'site-1'},{id:'lot-2',organizationId:'org-a',siteId:'site-2'}],
 inventoryMovements:[{id:'move-1',organizationId:'org-a',lotId:'lot-1'},{id:'move-2',organizationId:'org-a',lotId:'lot-2'},{id:'move-invalid',organizationId:'org-a',lotId:'missing-lot'}],
 tankPreparations:[{id:'prep-1',organizationId:'org-a',siteId:'site-1'},{id:'prep-2',organizationId:'org-a',siteId:'site-2'}],
 workOrders:[
  {id:'wo-1',organizationId:'org-a',siteId:'site-1'},
  {id:'wo-2',organizationId:'org-a',siteId:'site-2'},
  {id:'wo-prep-1',organizationId:'org-a',preparationId:'prep-1'},
  {id:'wo-prep-2',organizationId:'org-a',preparationId:'prep-2'},
  {id:'wo-conflict',organizationId:'org-a',siteId:'site-1',preparationId:'prep-2'},
  {id:'wo-invalid',organizationId:'org-a',preparationId:'missing-prep'},
  {id:'wo-global',organizationId:'org-a'}
 ],
 costEntries:[],grandmotherPlants:[],motherPlants:[],propagationBatches:[],
 mapElements:[{id:'map-1',organizationId:'org-a',houseId:'house-1'},{id:'map-2',organizationId:'org-a',houseId:'house-2'},{id:'map-invalid',organizationId:'org-a',houseId:'missing-house'}],
 facilityAreas:[],operationalAreas:[],finishedGoods:[],finishedGoodsMovements:[],sales:[],customers:[],phaseTransitions:[],
 plantEvents:[{id:'event-1',organizationId:'org-a',siteId:'site-1',plantId:'plant-1'},{id:'event-2',organizationId:'org-a',siteId:'site-2',plantId:'plant-2'},{id:'event-conflict',organizationId:'org-a',siteId:'site-1',plantId:'plant-2'}]
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

test('F010: Todas las sedes aplica el mismo scope autorizado a geografía directa e indirecta',()=>{
 const current=state(),scoped=scopeOperationalState(current,current.currentContext)
 assert.deepEqual(scoped.workOrders.map(item=>item.id),['wo-1','wo-prep-1','wo-global'])
 assert.deepEqual(scoped.inventoryMovements.map(item=>item.id),['move-1'])
 assert.deepEqual(scoped.mapElements.map(item=>item.id),['map-1'])
 assert.deepEqual(scoped.plantEvents.map(item=>item.id),['event-1'])
})

test('F010: referencias geográficas inexistentes fallan cerrado y no convierten registros en globales',()=>{
 const current=state(),scoped=scopeOperationalState(current,current.currentContext)
 assert.equal(scoped.workOrders.some(item=>item.id==='wo-invalid'),false)
 assert.equal(scoped.inventoryMovements.some(item=>item.id==='move-invalid'),false)
 assert.equal(scoped.mapElements.some(item=>item.id==='map-invalid'),false)
})

test('F010: pistas geográficas contradictorias fallan cerrado incluso con acceso a ambas sedes',()=>{
 const current=state();current.memberships[0].siteIds=[]
 const scoped=scopeOperationalState(current,current.currentContext)
 assert.equal(scoped.workOrders.some(item=>item.id==='wo-conflict'),false)
 assert.equal(scoped.plantEvents.some(item=>item.id==='event-conflict'),false)
 assert.ok(scoped.workOrders.some(item=>item.id==='wo-global'))
 assert.ok(scoped.workOrders.some(item=>item.id==='wo-prep-2'))
})

test('F010: dos campos de identidad de planta distintos fallan cerrado aunque resuelvan dentro del tenant',()=>{
 const current=state();current.memberships[0].siteIds=[]
 current.plantEvents.push({id:'event-two-plants',organizationId:'org-a',plantId:'plant-1',plantPositionId:'plant-2'})
 const scoped=scopeOperationalState(current,current.currentContext)
 assert.equal(scoped.plantEvents.some(item=>item.id==='event-two-plants'),false)
})

test('F010: un hallazgo con planta y siteId contradictorios se excluye aunque ambas sedes estén autorizadas',()=>{
 const current=state();current.memberships[0].siteIds=[]
 current.findings.push({id:'finding-conflict',organizationId:'org-a',siteId:'site-1',plantPositionId:'plant-2',targetType:'POSITION',targetId:'plant-2',incidentId:'inc-1',status:'Detectado'})
 const scoped=scopeOperationalState(current,current.currentContext)
 assert.equal(scoped.findings.some(item=>item.id==='finding-conflict'),false)
})

test('F010: una planta con ancestry declarada contradictoria queda fuera del scope y no puede convertirse en contexto',()=>{
 const current=state();current.memberships[0].siteIds=[];current.plantPositions[1].siteId='site-1'
 const scoped=scopeOperationalState(current,current.currentContext)
 assert.equal(scoped.plantPositions.some(item=>item.id==='plant-2'),false)
 assert.throws(()=>operationalContextForPlant(current,'plant-2'),/jerarquía canónica consistente/i)
})

test('F010: identidad geográfica duplicada dentro del tenant falla cerrado',()=>{
 const current=state();current.mapElements=[]
 current.houses.push({...current.houses[0],name:'Duplicada'})
 assert.throws(()=>scopeOperationalState(current,current.currentContext),/identidad duplicada/i)
})

test('F010: múltiples usuarios con activeSession fallan cerrado en vez de escoger el primero',()=>{
 const current=state();current.users[1].activeSession=true
 assert.throws(()=>operationalContextOptions(current,current.currentContext),/sesión activa es ambigua/i)
})

test('F010: registro legacy sin organizationId conserva inferencia por sede cuando el owner es inequívoco',()=>{
 const current=state();current.companies.push({id:'org-b'});current.sites.push({id:'site-b',organizationId:'org-b',companyId:'org-b'});current.mapElements.push({id:'legacy-unique',siteId:'site-1'})
 const scoped=scopeOperationalState(current,current.currentContext)
 assert.equal(scoped.mapElements.some(item=>item.id==='legacy-unique'),true)
})

test('F010: registro legacy con siteId homónimo cross-tenant falla cerrado',()=>{
 const current=state();current.companies.push({id:'org-b'});current.sites.push({id:'site-1',organizationId:'org-b',companyId:'org-b'});current.mapElements.push({id:'legacy-ambiguous',siteId:'site-1'})
 const scoped=scopeOperationalState(current,current.currentContext)
 assert.equal(scoped.mapElements.some(item=>item.id==='legacy-ambiguous'),false)
})
