import test from'node:test'
import assert from'node:assert/strict'
import{createCultivationPlantPassportFromState}from'../src/core/passport/cultivationPlantPassport.js'
import{createMaterialPlantPassportFromState}from'../src/core/passport/materialPlantPassport.js'

function state(){
 const finding=(id,targetType,targetId)=>({id,organizationId:'org-a',siteId:'site-a',targetType,targetId,...(targetType==='POSITION'?{plantPositionId:targetId}:{materialPlantId:targetId}),incidentId:'incident-a',severity:2,status:'Seguimiento',reportedAt:'2026-08-17T10:00:00.000Z',mipeHistory:[{id:`${id}:created`,type:'CREATED',from:null,to:'Detectado',occurredAt:'2026-08-17T10:00:00.000Z',actor:{id:'u1',name:'Operario'},metadata:{}},{id:`${id}:follow`,type:'TRANSITION',transition:'START_FOLLOW_UP',from:'En tratamiento',to:'Seguimiento',occurredAt:'2026-08-17T11:00:00.000Z',actor:{id:'u1',name:'Operario'},metadata:{}}],mipeHistoryVersion:2})
 const treatment=(id,findingId)=>({id,organizationId:'org-a',siteId:'site-a',findingId,productId:'product-a',lotId:'inventory-lot-a',status:'Ejecutado',dose:1,doseUnit:'mL/L',mixVolume:10,totalQuantity:10,inventoryUnit:'mL',executedAt:'2026-08-17T11:30:00.000Z',reentryUntil:'2026-08-17T23:30:00.000Z',harvestRestrictedUntil:'2026-08-19T11:30:00.000Z',productSnapshot:{name:'Producto congelado',unit:'mL',doseUnit:'mL/L',reentryHours:12,withdrawalDays:2,cost:7}})
 return{
  currentContext:{companyId:'org-a',siteId:'site-a'},companies:[{id:'org-a',name:'A'}],
  sites:[{id:'site-a',organizationId:'org-a',companyId:'org-a',name:'Sede A'}],houses:[{id:'house-a',organizationId:'org-a',siteId:'site-a',name:'Nave A'}],beds:[{id:'bed-a',organizationId:'org-a',houseId:'house-a',name:'Cama A'}],
  plantPositions:[{id:'plant-a',organizationId:'org-a',bedId:'bed-a',code:'P-A',status:'Activa',createdAt:'2026-08-17T09:00:00.000Z'}],
  grandmotherPlants:[{id:'gm-lot-a',organizationId:'org-a',siteId:'site-a',lotCode:'GM-A',quantity:1,geneticId:'gen-a',status:'Activa',createdAt:'2026-08-17T08:00:00.000Z'}],motherPlants:[],
  materialPlantUnits:[{id:'material-a',organizationId:'org-a',plantType:'GRANDMOTHER',unitIndex:0,lotId:'gm-lot-a',siteId:'site-a',geneticId:'gen-a',code:'GM-A-A001',status:'Activa',healthStatus:'Sana',operationalAvailability:'Disponible para corte',createdAt:'2026-08-17T08:00:00.000Z',updatedAt:'2026-08-17T08:00:00.000Z'}],materialPlantIdentityRegistry:{},
  genetics:[{id:'gen-a',organizationId:'org-a',name:'Gen A'}],incidents:[{id:'incident-a',organizationId:'org-a',name:'Botritis',active:true}],
  findings:[finding('finding-pos','POSITION','plant-a'),finding('finding-mat','MATERIAL_PLANT','material-a')],
  products:[{id:'product-a',organizationId:'org-a',name:'PRODUCTO VIVO RENOMBRADO',unit:'mL'}],inventoryLots:[{id:'inventory-lot-a',organizationId:'org-a',siteId:'site-a',productId:'product-a',lotNumber:'LOT-A',quantity:90}],
  treatments:[treatment('treatment-pos','finding-pos'),treatment('treatment-mat','finding-mat')],mipeInterventions:[],
  attachments:[],timelineEntries:[],plantEvents:[],propagationUnits:[],propagationBatches:[],growingMediumAssignments:[],growingMediumBatches:[],growingMediumProducts:[],growingMediumFormulas:[],growingMediumReusePolicies:[],growingMediumReuseCycles:[]
 }
}

function assertTrace(passport,treatmentId){
 const targetTypes=new Set(passport.relationships.map(item=>item.targetType))
 for(const expected of['mipe.finding','mipe.incident','mipe.treatment','inventory.product','inventory.lot','mipe.restriction'])assert.ok(targetTypes.has(expected),`Falta ${expected}`)
 const treatment=passport.relationships.find(item=>item.targetType==='mipe.treatment'&&item.targetId===treatmentId)
 assert.equal(treatment.label,'Producto congelado')
 const product=passport.relationships.find(item=>item.targetType==='inventory.product')
 assert.equal(product.label,'Producto congelado')
 assert.ok(passport.timeline.some(item=>item.id===`mipekg:treatment:${treatmentId}`&&item.title==='Producto congelado'))
 assert.ok(passport.relationships.every(item=>item.targetOrganizationId==='org-a'))
}

test('F011: Passport de Position integra Knowledge Graph MIPE y reemplaza el nombre mutable del Treatment',()=>{
 const passport=createCultivationPlantPassportFromState(state(),{plantId:'plant-a'})
 assertTrace(passport,'treatment-pos')
 assert.equal(passport.timeline.some(item=>item.id==='treatment:treatment-pos'),false)
})

test('F011: Passport de Madre/Abuela integra el mismo Knowledge Graph causal',()=>{
 const passport=createMaterialPlantPassportFromState(state(),{unitId:'material-a'})
 assertTrace(passport,'treatment-mat')
 assert.equal(passport.object.objectType,'cultivation.materialplant')
})
