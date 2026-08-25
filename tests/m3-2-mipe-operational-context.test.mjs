import test from'node:test'
import assert from'node:assert/strict'
import{normalizeOperationalContext,operationalContextForPlant,operationalContextOptions,scopeOperationalState,transitionOperationalContext}from'../src/domain/operationalContext.js'

function baseState(){return{
 currentContext:{companyId:'org-a',siteId:'site-a1',houseId:'house-a1',bedId:'bed-a1',plantId:'plant-a1',geneticId:'gen-a',stage:'Floración',week:4,cycleId:'cycle-a'},
 companies:[{id:'org-a',name:'A'},{id:'org-b',name:'B'}],
 memberships:[{id:'m-a',companyId:'org-a',siteIds:['site-a1'],status:'active'},{id:'m-b',companyId:'org-b',siteIds:[],status:'active'}],
 sites:[
  {id:'site-a1',companyId:'org-a',organizationId:'org-a',name:'A1'},
  {id:'site-a2',companyId:'org-a',organizationId:'org-a',name:'A2'},
  {id:'site-b1',companyId:'org-b',organizationId:'org-b',name:'B1'}
 ],
 houses:[
  {id:'house-a1',organizationId:'org-a',siteId:'site-a1',name:'Nave A1'},
  {id:'house-a2',organizationId:'org-a',siteId:'site-a2',name:'Nave A2'},
  {id:'house-a1',organizationId:'org-b',siteId:'site-b1',name:'Nave B homónima'}
 ],
 beds:[
  {id:'bed-a1',organizationId:'org-a',houseId:'house-a1',name:'Cama A1'},
  {id:'bed-a2',organizationId:'org-a',houseId:'house-a2',name:'Cama A2'},
  {id:'bed-a1',organizationId:'org-b',houseId:'house-a1',name:'Cama B homónima'}
 ],
 plantPositions:[
  {id:'plant-a1',organizationId:'org-a',bedId:'bed-a1',siteId:'site-a1',geneticId:'gen-a',active:true},
  {id:'plant-a2',organizationId:'org-a',bedId:'bed-a2',siteId:'site-a2',geneticId:'gen-a',active:true},
  {id:'plant-a1',organizationId:'org-b',bedId:'bed-a1',siteId:'site-b1',geneticId:'gen-b',active:true}
 ],
 genetics:[{id:'gen-a',organizationId:'org-a',name:'GA'},{id:'gen-b',organizationId:'org-b',name:'GB'}],
 incidents:[{id:'inc-1',organizationId:'org-a',name:'Trips'},{id:'inc-1',organizationId:'org-b',name:'Trips B'}],
 findings:[
  {id:'finding-a',organizationId:'org-a',siteId:'site-a1',plantPositionId:'plant-a1',targetType:'POSITION',targetId:'plant-a1',incidentId:'inc-1',status:'Detectado'},
  {id:'finding-a2',organizationId:'org-a',siteId:'site-a2',plantPositionId:'plant-a2',targetType:'POSITION',targetId:'plant-a2',incidentId:'inc-1',status:'Detectado'},
  {id:'finding-a',organizationId:'org-b',siteId:'site-b1',plantPositionId:'plant-a1',targetType:'POSITION',targetId:'plant-a1',incidentId:'inc-1',status:'Detectado'}
 ],
 treatments:[],mipeInterventions:[],propagationBanks:[],propagationUnits:[],products:[],inventoryLots:[],inventoryMovements:[],workOrders:[],costEntries:[],grandmotherPlants:[],motherPlants:[],propagationBatches:[],mapElements:[],facilityAreas:[],operationalAreas:[],finishedGoods:[],finishedGoodsMovements:[],sales:[],customers:[],phaseTransitions:[],plantEvents:[]
}}

test('F010: restaura únicamente una cadena jerárquica válida y limpia descendientes stale',()=>{
 const state=baseState()
 const normalized=normalizeOperationalContext(state,{...state.currentContext,siteId:'site-a2',houseId:'house-a1',bedId:'bed-a1',plantId:'plant-a1'})
 assert.equal(normalized.companyId,'org-a')
 assert.equal(normalized.siteId,'')
 assert.equal(normalized.houseId,'')
 assert.equal(normalized.bedId,'')
 assert.equal(normalized.plantId,'')
})

test('F010: membership siteIds limita opciones y un site no autorizado falla cerrado',()=>{
 const state=baseState(),options=operationalContextOptions(state,state.currentContext)
 assert.deepEqual(options.sites.map(item=>item.id),['site-a1'])
 const normalized=normalizeOperationalContext(state,{...state.currentContext,siteId:'site-a2',houseId:'house-a2',bedId:'bed-a2',plantId:'plant-a2'})
 assert.equal(normalized.companyId,'org-a')
 assert.equal(normalized.siteId,'')
 assert.equal(normalized.houseId,'')
 assert.equal(normalized.bedId,'')
 assert.equal(normalized.plantId,'')
})

test('F010: cambiar un ancestro limpia todos sus descendientes antes de normalizar',()=>{
 const state=baseState()
 const site=transitionOperationalContext(state,{siteId:''})
 assert.equal(site.siteId,'')
 assert.equal(site.houseId,'')
 assert.equal(site.bedId,'')
 assert.equal(site.plantId,'')
 const house=transitionOperationalContext(state,{houseId:''})
 assert.equal(house.siteId,'site-a1')
 assert.equal(house.houseId,'')
 assert.equal(house.bedId,'')
 assert.equal(house.plantId,'')
 const bed=transitionOperationalContext(state,{bedId:''})
 assert.equal(bed.houseId,'house-a1')
 assert.equal(bed.bedId,'')
 assert.equal(bed.plantId,'')
})

test('F010: IDs homónimos cross-tenant se resuelven exclusivamente dentro de la empresa activa',()=>{
 const state=baseState(),context=normalizeOperationalContext(state,state.currentContext)
 assert.deepEqual(context,{...state.currentContext})
 const scoped=scopeOperationalState(state,context)
 assert.equal(scoped.houses.length,1)
 assert.equal(scoped.houses[0].organizationId,'org-a')
 assert.equal(scoped.beds.length,1)
 assert.equal(scoped.beds[0].organizationId,'org-a')
 assert.equal(scoped.plantPositions.length,1)
 assert.equal(scoped.plantPositions[0].organizationId,'org-a')
 assert.deepEqual(scoped.findings.map(item=>item.id),['finding-a'])
 assert.ok(scoped.findings.every(item=>item.organizationId==='org-a'))
})

test('F010: contexto de planta deriva Plant→Bed→House→Site sin confiar en el ID de URL',()=>{
 const state=baseState(),context=operationalContextForPlant(state,'plant-a1')
 assert.equal(context.companyId,'org-a')
 assert.equal(context.siteId,'site-a1')
 assert.equal(context.houseId,'house-a1')
 assert.equal(context.bedId,'bed-a1')
 assert.equal(context.plantId,'plant-a1')
})

test('F010: una planta fuera del site scope de la membresía no puede convertirse en contexto activo',()=>{
 const state=baseState()
 assert.throws(()=>operationalContextForPlant(state,'plant-a2'),/fuera del alcance|no se encontró/i)
})

test('F010: empresa solicitada fuera de memberships no conserva descendientes extranjeros',()=>{
 const state=baseState();state.memberships=[state.memberships[0]]
 const context=normalizeOperationalContext(state,{companyId:'org-b',siteId:'site-b1',houseId:'house-a1',bedId:'bed-a1',plantId:'plant-a1'})
 assert.equal(context.companyId,'org-a')
 assert.equal(context.siteId,'')
 assert.equal(context.houseId,'')
 assert.equal(context.bedId,'')
 assert.equal(context.plantId,'')
})

test('F010: identidad duplicada dentro del mismo tenant falla cerrado',()=>{
 const state=baseState();state.houses.push({...state.houses[0],name:'Duplicada A'})
 assert.throws(()=>normalizeOperationalContext(state,state.currentContext),/duplicada/i)
})

test('F010: scope hasta planta no incorpora hallazgos de otra cama, sede o tenant',()=>{
 const state=baseState(),scoped=scopeOperationalState(state,state.currentContext)
 assert.deepEqual(scoped.sites.map(item=>item.id),['site-a1'])
 assert.deepEqual(scoped.houses.map(item=>item.id),['house-a1'])
 assert.deepEqual(scoped.beds.map(item=>item.id),['bed-a1'])
 assert.deepEqual(scoped.plantPositions.map(item=>item.id),['plant-a1'])
 assert.deepEqual(scoped.findings.map(item=>item.id),['finding-a'])
})
