import test from'node:test'
import assert from'node:assert/strict'
import{expandPlantLot,listIndividualPlants,findIndividualPlant,createPlantPassportFromState}from'../src/core/passport/index.js'

const state={
 grandmotherPlants:[{id:'grand-lot-1',companyId:'company-1',siteId:'site-1',geneticId:'genetic-1',lotCode:'LAB-CAN1-001',quantity:2,status:'Activa',healthStatus:'Sana',createdAt:'2026-07-01T00:00:00.000Z'}],
 motherPlants:[{id:'mother-lot-1',companyId:'company-1',siteId:'site-1',geneticId:'genetic-1',grandmotherPlantId:'grand-lot-1',lotCode:'LM-CAN1-001',quantity:3,status:'Activa',healthStatus:'En seguimiento',createdAt:'2026-07-10T00:00:00.000Z'}]
}

test('expande un lote existente en identidades individuales estables sin alterar el dato fuente',()=>{
 const source=state.grandmotherPlants[0]
 const plants=expandPlantLot(source,{kind:'grandmother'})
 assert.equal(plants.length,2)
 assert.deepEqual(plants.map(item=>item.id),['grand-lot-1:001','grand-lot-1:002'])
 assert.deepEqual(plants.map(item=>item.code),['LAB-CAN1-001-001','LAB-CAN1-001-002'])
 assert.equal(plants[0].sourceLot,source)
 assert.equal(source.quantity,2)
 assert.equal(Object.isFrozen(plants),true)
 assert.equal(Object.isFrozen(plants[0]),true)
})

test('lista, filtra y localiza abuelas y madres individuales conservando compatibilidad por lote',()=>{
 const mothers=listIndividualPlants(state,{kind:'mother',siteId:'site-1',status:'Activa'})
 assert.equal(mothers.length,3)
 assert.equal(mothers[2].id,'mother-lot-1:003')
 assert.equal(findIndividualPlant(state,{kind:'mother',individualId:'mother-lot-1:002'})?.code,'LM-CAN1-001-002')
 assert.equal(findIndividualPlant(state,{kind:'mother',individualId:'missing'}),null)
})

test('crea una ficha universal individual con genealogía hacia el lote de abuelas',()=>{
 const passport=createPlantPassportFromState(state,{
  kind:'mother',
  individualId:'mother-lot-1:001',
  documents:[{id:'photo-1',type:'image'}],
  timeline:[{id:'event-1',title:'Inspección'}],
  actions:[{id:'mipe.record-finding',label:'Registrar hallazgo'}]
 })
 assert.equal(passport.object.objectId,'mother-lot-1:001')
 assert.equal(passport.object.objectType,'cultivation.mother')
 assert.equal(passport.object.identity.lotId,'mother-lot-1')
 assert.equal(passport.object.attributes.healthStatus,'En seguimiento')
 assert.equal(passport.object.metadata.compatibilityMode,'virtual-individual-from-lot-v1')
 assert.deepEqual(passport.relationships.map(item=>item.type),['descends_from','member_of_lot'])
 assert.equal(passport.relationships[0].targetId,'grand-lot-1')
 assert.equal(passport.documents[0].id,'photo-1')
 assert.equal(passport.timeline[0].id,'event-1')
})

test('usa una identidad organizacional compatible cuando los lotes antiguos no tienen empresa explícita',()=>{
 const legacy={grandmotherPlants:[{id:'legacy-1',lotCode:'LAB-LEGACY',quantity:1}],motherPlants:[]}
 const passport=createPlantPassportFromState(legacy,{kind:'grandmother',individualId:'legacy-1:001'})
 assert.equal(passport.object.organizationId,'local-installation')
 assert.equal(passport.object.siteId,null)
})

test('rechaza tipos desconocidos e identidades inexistentes',()=>{
 assert.throws(()=>listIndividualPlants(state,{kind:'clone'}),/grandmother o mother/)
 assert.throws(()=>createPlantPassportFromState(state,{kind:'mother',individualId:'missing'}),/No se encontró/)
})
