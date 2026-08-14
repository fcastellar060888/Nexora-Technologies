import test from'node:test'
import assert from'node:assert/strict'
import{createCultivationPlantPassportFromState}from'../src/core/passport/cultivationPlantPassport.js'
import{createMaterialPlantPassportFromState}from'../src/core/passport/materialPlantPassport.js'
import{listIndividualPlants}from'../src/core/passport/plantIdentity.js'
import{materialPlantUnitById,projectMaterialPlantUnits,MATERIAL_PLANT_TYPES}from'../src/domain/materialPlantIdentity.js'

const empty=()=>({genetics:[],attachments:[],findings:[],treatments:[],incidents:[],products:[],plantEvents:[],timelineEntries:[],propagationUnits:[],propagationBatches:[],grandmotherPlants:[],motherPlants:[],materialPlantUnits:[]})

test('M11-F008/F010: cultivation Passport resolves same plantId inside active tenant only',()=>{
 const state={...empty(),currentContext:{companyId:'org-b'},companies:[{id:'org-a'},{id:'org-b'}],sites:[{id:'site-a',companyId:'org-a',name:'A'},{id:'site-b',companyId:'org-b',name:'B'}],houses:[{id:'house-1',siteId:'site-a',_organizationId:'org-a',name:'Nave A'},{id:'house-1',siteId:'site-b',_organizationId:'org-b',name:'Nave B'}],beds:[{id:'bed-1',houseId:'house-1',_organizationId:'org-a',name:'Cama A'},{id:'bed-1',houseId:'house-1',_organizationId:'org-b',name:'Cama B'}],plantPositions:[{id:'plant-1',bedId:'bed-1',organizationId:'org-a',code:'A-001'},{id:'plant-1',bedId:'bed-1',organizationId:'org-b',code:'B-001'}]}
 const passport=createCultivationPlantPassportFromState(state,{plantId:'plant-1'})
 assert.equal(passport.object.organizationId,'org-b')
 assert.equal(passport.object.label,'B-001')
 assert.ok(passport.relationships.some(item=>item.targetType==='organization.site'&&item.targetId==='site-b'))
 assert.ok(passport.relationships.every(item=>item.targetOrganizationId==='org-b'))
})

test('M11-F007: ambiguous legacy lot cannot become local-installation inside multi-company state',()=>{
 const state={...empty(),currentContext:{companyId:'org-a'},companies:[{id:'org-a'},{id:'org-b'}],sites:[],motherPlants:[{id:'same-lot',quantity:1}]}
 assert.throws(()=>listIndividualPlants(state,{kind:'mother'}),/multiempresa/)
})

test('M11-F009/F010: same material unit legacy id can exist in different organizations and resolves by active tenant',()=>{
 const state={...empty(),currentContext:{companyId:'org-b'},companies:[{id:'org-a'},{id:'org-b'}],sites:[{id:'site-a',companyId:'org-a'},{id:'site-b',companyId:'org-b'}],motherPlants:[{id:'same-lot',organizationId:'org-a',siteId:'site-a',lotCode:'A',quantity:1},{id:'same-lot',organizationId:'org-b',siteId:'site-b',lotCode:'B',quantity:1}]}
 const units=projectMaterialPlantUnits(state)
 assert.equal(units.length,2)
 assert.equal(units[0].id,units[1].id)
 const active=materialPlantUnitById(state,'material-plant:MOTHER:same-lot:1')
 assert.equal(active.organizationId,'org-b')
 assert.equal(active.code,'B-M001')
})

test('M11-F009: virtual compatibility facade points to durable material identity when available',()=>{
 const state={...empty(),currentContext:{companyId:'org-a'},companies:[{id:'org-a'}],sites:[{id:'site-a',companyId:'org-a'}],motherPlants:[{id:'m1',organizationId:'org-a',siteId:'site-a',lotCode:'M-1',quantity:1}],materialPlantUnits:[{id:'uuid-durable-1',organizationId:'org-a',lotId:'m1',plantType:MATERIAL_PLANT_TYPES.MOTHER,unitIndex:0,code:'M-1-M001'}]}
 const plants=listIndividualPlants(state,{kind:'mother'})
 assert.equal(plants[0].id,'uuid-durable-1')
 assert.equal(plants[0].legacyId,'m1:001')
 assert.equal(plants[0].canonicalSource,'materialPlantUnits')
})

test('M11-F010: material Passport excludes foreign-tenant evidence sharing the same unit id',()=>{
 const unitId='material-plant:MOTHER:same-lot:1'
 const state={...empty(),currentContext:{companyId:'org-b'},companies:[{id:'org-a'},{id:'org-b'}],sites:[{id:'site-a',companyId:'org-a'},{id:'site-b',companyId:'org-b'}],motherPlants:[{id:'same-lot',organizationId:'org-a',siteId:'site-a',lotCode:'A',quantity:1},{id:'same-lot',organizationId:'org-b',siteId:'site-b',lotCode:'B',quantity:1}],findings:[{id:'fa',organizationId:'org-a',materialPlantId:unitId,type:'Extranjero',status:'Abierto',reportedAt:'2026-08-14T00:00:00.000Z'},{id:'fb',organizationId:'org-b',materialPlantId:unitId,type:'Propio',status:'Abierto',reportedAt:'2026-08-14T00:00:00.000Z'}]}
 const passport=createMaterialPlantPassportFromState(state,{unitId})
 assert.equal(passport.object.organizationId,'org-b')
 assert.equal(passport.risks.filter(item=>item.type==='mipe.finding').length,1)
 assert.match(passport.risks.find(item=>item.type==='mipe.finding').label,/Propio/)
})
