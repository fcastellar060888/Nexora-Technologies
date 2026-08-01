import test from'node:test'
import assert from'node:assert/strict'
import{createIntelligentObject,createPassport,isIntelligentObject,passportObjectRef}from'../src/core/passport/index.js'

const plant=createIntelligentObject({
 objectType:'cultivation.plant',
 objectId:'plant-001',
 organizationId:'company-001',
 siteId:'site-001',
 label:'VIL-N1-C1-F1-P1',
 status:'flowering',
 identity:{code:'VIL-N1-C1-F1-P1'},
 attributes:{week:5,geneticId:'genetic-1'}
})

test('crea un Objeto Inteligente estable, versionado e inmutable',()=>{
 assert.equal(plant.objectType,'cultivation.plant')
 assert.equal(plant.version,1)
 assert.equal(plant.identity.code,'VIL-N1-C1-F1-P1')
 assert.equal(Object.isFrozen(plant),true)
 assert.equal(Object.isFrozen(plant.identity),true)
 assert.equal(isIntelligentObject(plant),true)
})

test('rechaza objetos sin identidad organizacional o nomenclatura estable',()=>{
 assert.throws(()=>createIntelligentObject({objectType:'Planta Productiva',objectId:'1',organizationId:'company',label:'Planta'}),/nomenclatura estable/)
 assert.throws(()=>createIntelligentObject({objectType:'cultivation.plant',objectId:'1',organizationId:'',label:'Planta'}),/empresa/)
})

test('compone un Passport con relaciones, indicadores, riesgos, acciones e historial',()=>{
 const passport=createPassport({
  object:plant,
  relationships:[{type:'descends_from',targetType:'propagation.mother',targetId:'mother-1'}],
  documents:[{id:'photo-1',type:'image'}],
  indicators:[{key:'days_in_phase',value:18,unit:'days'}],
  risks:[{key:'open_mipe_findings',severity:'high',value:1}],
  actions:[{id:'mipe.record-finding',label:'Registrar hallazgo'}],
  timeline:[{eventId:'event-1',name:'cultivation.plant.inspected'}],
  decisionContext:{priority:'high',reason:'Hallazgo sanitario abierto'}
 })
 assert.equal(passport.passportId,'company-001:cultivation.plant:plant-001')
 assert.equal(passport.relationships.length,1)
 assert.equal(passport.actions[0].id,'mipe.record-finding')
 assert.equal(passport.decisionContext.priority,'high')
 assert.equal(Object.isFrozen(passport),true)
})

test('expone una referencia común para Digital Twin, Ledger y Knowledge Graph',()=>{
 assert.deepEqual(passportObjectRef(createPassport({object:plant})),{
  objectType:'cultivation.plant',
  objectId:'plant-001',
  organizationId:'company-001',
  siteId:'site-001'
 })
})
