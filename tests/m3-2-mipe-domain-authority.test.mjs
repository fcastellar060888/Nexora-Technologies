import test from'node:test'
import assert from'node:assert/strict'
import{
 MIPE_FINDING_STATUSES,MIPE_INTERVENTION_TYPES,MIPE_TARGET_TYPES,MIPE_TREATMENT_STATUSES,
 assertMipeReferenceScope,calculateMipeTreatmentQuantity,createMipeFinding,createMipeFindingFromReferences,createMipeIncident,createMipeIntervention,createMipeTreatment,mipeInventoryUnitForDose
}from'../src/domain/mipeAuthority.js'

const incident=(organizationId='org-a',id='incident-shared')=>createMipeIncident({id,organizationId,name:`Incidencia ${organizationId}`,kind:'PEST',scientificName:'Example pest'})
const target=(organizationId='org-a',siteId='site-a',id='plant-shared')=>({id,organizationId,siteId})
const finding=(organizationId='org-a',siteId='site-a',id='finding-shared')=>createMipeFindingFromReferences({id,targetType:MIPE_TARGET_TYPES.POSITION,severity:4,status:MIPE_FINDING_STATUSES.DETECTED,reportedAt:'2026-08-10T12:00:00.000Z',followUpAt:'2026-08-12T12:00:00.000Z',responsibleId:'user-a',notes:'Ácaros visibles'}, {incident:incident(organizationId),target:target(organizationId,siteId)})
const product=(organizationId='org-a',siteId='site-a',id='product-shared')=>({id,organizationId,siteId,name:`Producto ${organizationId}`,unit:'mL',doseMin:100,doseMax:250,doseUnit:'mL/100 L',reentryHours:12,withdrawalDays:3,cost:2})

test('M32-F001: incident and finding identities may repeat across tenants without becoming the same authority',()=>{
 const a=finding('org-a','site-a','finding-shared'),b=finding('org-b','site-b','finding-shared')
 assert.equal(a.id,b.id)
 assert.equal(a.organizationId,'org-a')
 assert.equal(b.organizationId,'org-b')
 assert.notDeepEqual(a,b)
 assert.equal(Object.isFrozen(a),true)
 assert.equal(Object.isFrozen(a.evidenceIds),true)
})

test('M32-F001: finding composition rejects a cross-tenant incident',()=>{
 assert.throws(()=>createMipeFindingFromReferences({id:'f1',targetType:MIPE_TARGET_TYPES.POSITION,severity:2,reportedAt:'2026-08-10T12:00:00.000Z'},{incident:incident('org-b'),target:target('org-a')}),/misma organización/)
})

test('M32-F001: canonical finding validates target, severity, time and immutable evidence',()=>{
 const value=createMipeFinding({id:'f1',organizationId:'org-a',siteId:'site-a',targetType:MIPE_TARGET_TYPES.MATERIAL_PLANT,targetId:'mother-1',incidentId:'inc-1',severity:3,status:MIPE_FINDING_STATUSES.EVALUATING,reportedAt:'2026-08-10T12:00:00.000Z',followUpAt:'2026-08-11T12:00:00.000Z',evidenceIds:['photo-1','photo-1','photo-2']})
 assert.deepEqual(value.evidenceIds,['photo-1','photo-2'])
 assert.throws(()=>createMipeFinding({...value,id:'bad-severity',severity:5}),/severity/)
 assert.throws(()=>createMipeFinding({...value,id:'bad-time',followUpAt:'2026-08-09T12:00:00.000Z'}),/followUpAt/)
 assert.throws(()=>createMipeFinding({...value,id:'bad-target',targetType:'BED'}),/catálogo canónico/)
})

test('M32-F001: treatment quantity and inventory unit are canonical for all supported dose units',()=>{
 assert.equal(calculateMipeTreatmentQuantity(2,'mL/L',500),1000)
 assert.equal(calculateMipeTreatmentQuantity(1.5,'g/L',100),150)
 assert.equal(calculateMipeTreatmentQuantity(200,'mL/100 L',500),1000)
 assert.equal(calculateMipeTreatmentQuantity(50,'g/100 L',200),100)
 assert.equal(mipeInventoryUnitForDose('mL/100 L'),'mL')
 assert.equal(mipeInventoryUnitForDose('g/L'),'g')
})

test('M32-F001: treatment inherits tenant/site from finding and freezes the product execution snapshot',()=>{
 const f=finding(),p=product()
 const value=createMipeTreatment({id:'t1',dose:200,doseUnit:'mL/100 L',mixVolumeLiters:500,scheduledFor:'2026-08-11T08:00:00.000Z',createdAt:'2026-08-10T13:00:00.000Z',responsibleId:'user-a'}, {finding:f,product:p})
 assert.equal(value.organizationId,'org-a')
 assert.equal(value.siteId,'site-a')
 assert.equal(value.findingId,f.id)
 assert.equal(value.productId,p.id)
 assert.equal(value.totalQuantity,1000)
 assert.equal(value.inventoryUnit,'mL')
 assert.equal(value.status,MIPE_TREATMENT_STATUSES.SCHEDULED)
 assert.equal(value.productSnapshot.reentryHours,12)
 assert.equal(value.productSnapshot.withdrawalDays,3)
 assert.equal(Object.isFrozen(value.productSnapshot),true)
})

test('M32-F001: treatment rejects foreign product, foreign site and invalid product dose/unit',()=>{
 const f=finding()
 assert.throws(()=>createMipeTreatment({id:'t1',dose:200,doseUnit:'mL/100 L',mixVolumeLiters:500},{finding:f,product:product('org-b','site-b')}),/misma organización/)
 assert.throws(()=>createMipeTreatment({id:'t2',dose:200,doseUnit:'mL/100 L',mixVolumeLiters:500},{finding:f,product:product('org-a','site-b')}),/misma sede/)
 assert.throws(()=>createMipeTreatment({id:'t3',dose:300,doseUnit:'mL/100 L',mixVolumeLiters:500},{finding:f,product:product()}),/supera la dosis máxima/)
 assert.throws(()=>createMipeTreatment({id:'t4',dose:200,doseUnit:'g/100 L',mixVolumeLiters:500},{finding:f,product:product()}),/unidad de inventario/)
})

test('M32-F001: treatment references can repeat IDs across tenants without cross-contamination',()=>{
 const a=createMipeTreatment({id:'treatment-shared',dose:200,doseUnit:'mL/100 L',mixVolumeLiters:500},{finding:finding('org-a','site-a'),product:product('org-a','site-a')})
 const b=createMipeTreatment({id:'treatment-shared',dose:200,doseUnit:'mL/100 L',mixVolumeLiters:500},{finding:finding('org-b','site-b'),product:product('org-b','site-b')})
 assert.equal(a.id,b.id)
 assert.equal(a.organizationId,'org-a')
 assert.equal(b.organizationId,'org-b')
 assert.equal(a.productSnapshot.name,'Producto org-a')
 assert.equal(b.productSnapshot.name,'Producto org-b')
})

test('M32-F001: treatment intervention requires the treatment to belong to the same finding and tenant',()=>{
 const f=finding(),t=createMipeTreatment({id:'t1',dose:200,doseUnit:'mL/100 L',mixVolumeLiters:500},{finding:f,product:product()})
 const value=createMipeIntervention({id:'i1',type:MIPE_INTERVENTION_TYPES.TREATMENT,performedAt:'2026-08-11T09:00:00.000Z',nextReviewAt:'2026-08-12T09:00:00.000Z',outcome:'Aplicado sin novedad'}, {finding:f,treatment:t})
 assert.equal(value.organizationId,'org-a')
 assert.equal(value.findingId,'finding-shared')
 assert.equal(value.treatmentId,'t1')
 assert.equal(Object.isFrozen(value),true)
 const foreign=createMipeTreatment({id:'t1',dose:200,doseUnit:'mL/100 L',mixVolumeLiters:500},{finding:finding('org-b','site-b'),product:product('org-b','site-b')})
 assert.throws(()=>createMipeIntervention({id:'i2',type:MIPE_INTERVENTION_TYPES.TREATMENT},{finding:f,treatment:foreign}),/misma organización/)
})

test('M32-F001: follow-up intervention is independent from a treatment but cannot go backwards in time',()=>{
 const f=finding()
 const value=createMipeIntervention({id:'follow-1',type:MIPE_INTERVENTION_TYPES.FOLLOW_UP,performedAt:'2026-08-12T09:00:00.000Z',nextReviewAt:'2026-08-13T09:00:00.000Z',outcome:'Disminución de incidencia'}, {finding:f})
 assert.equal(value.treatmentId,'')
 assert.equal(value.type,MIPE_INTERVENTION_TYPES.FOLLOW_UP)
 assert.throws(()=>createMipeIntervention({id:'follow-bad',type:MIPE_INTERVENTION_TYPES.FOLLOW_UP,performedAt:'2026-08-12T09:00:00.000Z',nextReviewAt:'2026-08-11T09:00:00.000Z'},{finding:f}),/nextReviewAt/)
 assert.throws(()=>createMipeIntervention({id:'treatment-missing',type:MIPE_INTERVENTION_TYPES.TREATMENT},{finding:f}),/requiere Treatment/)
})

test('M32-F001: generic reference-scope guard fails closed across organization or site',()=>{
 assert.equal(assertMipeReferenceScope({organizationId:'org-a',siteId:'site-a'},{organizationId:'org-a',siteId:'site-a'}),true)
 assert.throws(()=>assertMipeReferenceScope({organizationId:'org-a',siteId:'site-a'},{organizationId:'org-b',siteId:'site-a'}),/misma organización/)
 assert.throws(()=>assertMipeReferenceScope({organizationId:'org-a',siteId:'site-a'},{organizationId:'org-a',siteId:'site-b'}),/misma sede/)
})
