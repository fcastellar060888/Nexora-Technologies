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
 identity:{code:'VIL-N1-C1-F1-P1',origin:{lotId:'lot-1'}},
 attributes:{week:5,geneticId:'genetic-1',metrics:{vpd:1.2}}
})

test('crea un Objeto Inteligente estable, versionado e inmutable en profundidad',()=>{
 assert.equal(plant.objectType,'cultivation.plant')
 assert.equal(plant.version,1)
 assert.equal(plant.identity.code,'VIL-N1-C1-F1-P1')
 assert.equal(Object.isFrozen(plant),true)
 assert.equal(Object.isFrozen(plant.identity),true)
 assert.equal(Object.isFrozen(plant.identity.origin),true)
 assert.equal(Object.isFrozen(plant.attributes.metrics),true)
 assert.throws(()=>{plant.identity.origin.lotId='altered'},TypeError)
 assert.equal(isIntelligentObject(plant),true)
})

test('rechaza objetos sin identidad organizacional o nomenclatura estable',()=>{
 assert.throws(()=>createIntelligentObject({objectType:'Planta Productiva',objectId:'1',organizationId:'company',label:'Planta'}),/nomenclatura estable/)
 assert.throws(()=>createIntelligentObject({objectType:'cultivation.plant',objectId:'1',organizationId:'',label:'Planta'}),/empresa/)
})

test('la validación no completa silenciosamente campos contractuales faltantes',()=>{
 const{version,...withoutVersion}=plant
 const{status,...withoutStatus}=plant
 const{identity,...withoutIdentity}=plant
 assert.equal(isIntelligentObject(plant),true)
 assert.equal(isIntelligentObject(withoutVersion),false)
 assert.equal(isIntelligentObject(withoutStatus),false)
 assert.equal(isIntelligentObject(withoutIdentity),false)
})

test('exige coherencia temporal del objeto',()=>{
 assert.throws(()=>createIntelligentObject({objectType:'cultivation.plant',objectId:'1',organizationId:'company',label:'Planta',createdAt:'2026-08-02T00:00:00.000Z',updatedAt:'2026-08-01T00:00:00.000Z'}),/no puede ser anterior/)
})

test('compone un Passport profundamente inmutable',()=>{
 const passport=createPassport({
  object:plant,
  relationships:[{type:'descends_from',targetType:'propagation.mother',targetId:'mother-1',targetOrganizationId:'company-001',metadata:{confidence:1}}],
  documents:[{id:'photo-1',type:'image'}],
  indicators:[{key:'days_in_phase',value:18,unit:'days',details:{source:'timeline'}}],
  risks:[{key:'open_mipe_findings',severity:'high',value:1}],
  actions:[{id:'mipe.record-finding',label:'Registrar hallazgo'}],
  timeline:[{eventId:'event-1',name:'cultivation.plant.inspected'}],
  decisionContext:{priority:'high',reason:'Hallazgo sanitario abierto',model:{version:1}}
 })
 assert.equal(passport.passportId,'company-001:cultivation.plant:plant-001')
 assert.equal(passport.relationships.length,1)
 assert.equal(passport.actions[0].id,'mipe.record-finding')
 assert.equal(passport.decisionContext.priority,'high')
 assert.equal(Object.isFrozen(passport),true)
 assert.equal(Object.isFrozen(passport.relationships[0].metadata),true)
 assert.equal(Object.isFrozen(passport.indicators[0].details),true)
 assert.equal(Object.isFrozen(passport.decisionContext.model),true)
 assert.throws(()=>{passport.relationships[0].metadata.confidence=0},TypeError)
})

test('deduplica únicamente proyecciones estructuralmente idénticas',()=>{
 const relationship={type:'descends_from',targetType:'propagation.mother',targetId:'mother-1',targetOrganizationId:'company-001'}
 const indicator={key:'days_in_phase',value:18}
 const passport=createPassport({
  object:plant,
  relationships:[relationship,{...relationship}],
  documents:[{id:'photo-1',type:'image'},{type:'image',id:'photo-1'}],
  indicators:[indicator,{...indicator}],
  risks:[{id:'risk-1',severity:'high'},{severity:'high',id:'risk-1'}],
  actions:[{id:'action-1',label:'Acción'},{label:'Acción',id:'action-1'}],
  timeline:[{eventId:'event-1',name:'inspected'},{name:'inspected',eventId:'event-1'}]
 })
 assert.equal(passport.relationships.length,1)
 assert.equal(passport.documents.length,1)
 assert.equal(passport.indicators.length,1)
 assert.equal(passport.risks.length,1)
 assert.equal(passport.actions.length,1)
 assert.equal(passport.timeline.length,1)
})

test('AUD-F020: rechaza proyecciones contradictorias con la misma identidad',()=>{
 const cases=[
  {indicators:[{key:'days_in_phase',value:18},{key:'days_in_phase',value:19}]},
  {documents:[{id:'photo-1',type:'image'},{id:'photo-1',type:'pdf'}]},
  {risks:[{id:'risk-1',severity:'low'},{id:'risk-1',severity:'high'}]},
  {actions:[{id:'action-1',label:'Uno'},{id:'action-1',label:'Dos'}]},
  {timeline:[{eventId:'event-1',name:'created'},{eventId:'event-1',name:'updated'}]},
  {relationships:[
   {type:'located_in',targetType:'facility.site',targetId:'site-1',targetOrganizationId:'company-001',metadata:{source:'a'}},
   {type:'located_in',targetType:'facility.site',targetId:'site-1',targetOrganizationId:'company-001',metadata:{source:'b'}}
  ]}
 ]
 for(const value of cases)assert.throws(()=>createPassport({object:plant,...value}),/proyecciones contradictorias/)
})

test('impide relaciones cruzadas entre empresas',()=>{
 assert.throws(()=>createPassport({
  object:plant,
  relationships:[{type:'related_to',targetType:'cultivation.plant',targetId:'plant-2',targetOrganizationId:'company-002'}]
 }),/otra empresa/)
})

test('exige identidad en acciones y contrato mínimo en relaciones e indicadores',()=>{
 assert.throws(()=>createPassport({object:plant,actions:[{label:'Acción sin ID'}]}),/requiere identidad/)
 assert.throws(()=>createPassport({object:plant,relationships:[{type:'located_in',targetId:'site-1'}]}),/tipo del destino/)
 assert.throws(()=>createPassport({object:plant,indicators:[{value:1}]}),/clave del indicador/)
})

test('expone una referencia común para Digital Twin, Ledger y Knowledge Graph',()=>{
 assert.deepEqual(passportObjectRef(createPassport({object:plant})),{
  objectType:'cultivation.plant',
  objectId:'plant-001',
  organizationId:'company-001',
  siteId:'site-001'
 })
 assert.equal(passportObjectRef({object:{objectType:'cultivation.plant'}}),null)
})
