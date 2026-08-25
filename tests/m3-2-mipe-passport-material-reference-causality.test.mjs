import test from'node:test'
import assert from'node:assert/strict'
import{createMaterialPlantPassportFromState}from'../src/core/passport/materialPlantPassport.js'
import{legacyMaterialPlantId,MATERIAL_PLANT_TYPES}from'../src/domain/materialPlantIdentity.js'

function base(){const grandmother={id:'gm-a',organizationId:'org-a',siteId:'site-a',lotCode:'GM-A',quantity:1,geneticId:'gen-a',status:'Activa',createdAt:'2026-08-17T08:00:00.000Z'};return{
 currentContext:{companyId:'org-a',siteId:'site-a'},companies:[{id:'org-a'},{id:'org-b'}],
 sites:[{id:'site-a',organizationId:'org-a',companyId:'org-a',name:'Sede A'},{id:'site-b',organizationId:'org-b',companyId:'org-b',name:'Sede B'}],
 genetics:[{id:'gen-a',organizationId:'org-a',name:'Gen A'},{id:'gen-b',organizationId:'org-b',name:'Gen B'}],
 grandmotherPlants:[grandmother],motherPlants:[],materialPlantUnits:[],materialPlantIdentityRegistry:{},
 propagationBatches:[],findings:[],incidents:[],treatments:[],mipeInterventions:[],products:[],inventoryLots:[],plantEvents:[],timelineEntries:[],attachments:[],
 irrigationApplications:[],irrigationCorrections:[],irrigationHistory:[],tankPreparations:[],workOrders:[],inventoryMovements:[],costEntries:[],formulations:[],nutrientProducts:[],mirfePrograms:[],mirfeMonitoring:[],mirfeReinforcements:[],waterAnalyses:[]
}}

test('F011 Passport material: referencias canónicas de sede/genética se proyectan tenant-aware',()=>{
 const state=base(),id=legacyMaterialPlantId({lot:state.grandmotherPlants[0],plantType:MATERIAL_PLANT_TYPES.GRANDMOTHER,unitIndex:0}),passport=createMaterialPlantPassportFromState(state,{unitId:id})
 assert.equal(passport.object.organizationId,'org-a')
 assert.equal(passport.object.siteId,'site-a')
 assert.equal(passport.object.attributes.geneticName,'Gen A')
 assert.ok(passport.relationships.some(item=>item.targetType==='organization.site'&&item.targetId==='site-a'))
})

test('F011 Passport material: genética duplicada same-tenant falla cerrado',()=>{
 const state=base(),id=legacyMaterialPlantId({lot:state.grandmotherPlants[0],plantType:MATERIAL_PLANT_TYPES.GRANDMOTHER,unitIndex:0});state.genetics.push({id:'gen-a',organizationId:'org-a',name:'Duplicada'})
 assert.throws(()=>createMaterialPlantPassportFromState(state,{unitId:id}),/genética.*ambigua/i)
})

test('F011 Passport material: parentPlantId extranjero no se proyecta como linaje local',()=>{
 const state=base(),foreignLot={id:'gm-b',organizationId:'org-b',siteId:'site-b',lotCode:'GM-B',quantity:1,geneticId:'gen-b',status:'Activa',createdAt:'2026-08-17T08:00:00.000Z'},foreignId='foreign-parent';state.grandmotherPlants.push(foreignLot);state.materialPlantUnits.push({id:foreignId,organizationId:'org-b',plantType:'GRANDMOTHER',unitIndex:0,lotId:'gm-b',siteId:'site-b',geneticId:'gen-b',status:'Activa',createdAt:'2026-08-17T08:00:00.000Z'});state.motherPlants.push({id:'mother-a',organizationId:'org-a',siteId:'site-a',lotCode:'M-A',quantity:1,geneticId:'gen-a',parentPlantId:foreignId,status:'Activa',createdAt:'2026-08-17T09:00:00.000Z'});const motherId=legacyMaterialPlantId({lot:state.motherPlants[0],plantType:MATERIAL_PLANT_TYPES.MOTHER,unitIndex:0})
 assert.throws(()=>createMaterialPlantPassportFromState(state,{unitId:motherId}),/parentPlantId|empresa activa|organización activa/i)
})

test('F011 Passport material: homónimo extranjero de sede no contamina la sede local',()=>{
 const state=base(),id=legacyMaterialPlantId({lot:state.grandmotherPlants[0],plantType:MATERIAL_PLANT_TYPES.GRANDMOTHER,unitIndex:0});state.sites.push({id:'site-a',organizationId:'org-b',companyId:'org-b',name:'Sede extranjera homónima'})
 const passport=createMaterialPlantPassportFromState(state,{unitId:id})
 const relation=passport.relationships.find(item=>item.targetType==='organization.site'&&item.targetId==='site-a')
 assert.equal(relation.targetOrganizationId,'org-a')
 assert.equal(relation.label,'Sede A')
})
