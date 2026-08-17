import test from'node:test'
import assert from'node:assert/strict'
import{archiveMipeIncidentRecord,assertExecutableMipeProductSnapshot,assertMipeIncidentUsable,createExecutableMipeProductSnapshot,createMipeIncidentCatalogRecord}from'../src/domain/mipeCatalogAuthority.js'

const product={id:'product-a',organizationId:'org-a',siteId:'site-a',name:'BioControl',category:'MIPE',activeIngredient:'Azadiractina',manufacturer:'Lab A',registrationNumber:'ICA-001',unit:'mL',doseMin:1,doseMax:3,doseUnit:'mL/L',reentryHours:12,withdrawalDays:2,cost:4,validFrom:'2026-01-01T00:00:00Z',validUntil:'2026-12-31T23:59:59Z',technicalRevision:2,active:true}

test('M32-F007: executable product snapshot freezes complete technical evidence',()=>{
 const snapshot=createExecutableMipeProductSnapshot(product,{organizationId:'org-a',siteId:'site-a',at:'2026-08-17T12:00:00Z',requestedDoseUnit:'mL/L'})
 assert.equal(snapshot.id,'product-a')
 assert.equal(snapshot.registrationNumber,'ICA-001')
 assert.equal(snapshot.technicalRevision,2)
 assert.equal(snapshot.reentryHours,12)
 assert.equal(snapshot.withdrawalDays,2)
 assert.equal(snapshot.cost,4)
 assert.equal(snapshot.source,'mipe-product-profile')
 assert.throws(()=>{snapshot.cost=999},TypeError)
})

test('M32-F007: foreign inactive expired and non-MIPE products fail closed',()=>{
 assert.throws(()=>createExecutableMipeProductSnapshot(product,{organizationId:'org-b',siteId:'site-a',at:'2026-08-17T12:00:00Z'}),/otra empresa/)
 assert.throws(()=>createExecutableMipeProductSnapshot({...product,active:false},{organizationId:'org-a',siteId:'site-a',at:'2026-08-17T12:00:00Z'}),/inactivo/)
 assert.throws(()=>createExecutableMipeProductSnapshot(product,{organizationId:'org-a',siteId:'site-a',at:'2027-01-01T00:00:00Z'}),/ya no está vigente/)
 assert.throws(()=>createExecutableMipeProductSnapshot({...product,category:'MIRFE'},{organizationId:'org-a',siteId:'site-a',at:'2026-08-17T12:00:00Z'}),/catálogo MIPE/)
})

test('M32-F007: requested dose unit must match the technical profile',()=>{
 assert.throws(()=>createExecutableMipeProductSnapshot(product,{organizationId:'org-a',siteId:'site-a',at:'2026-08-17T12:00:00Z',requestedDoseUnit:'mL/100 L'}),/no coincide/)
 assert.throws(()=>createExecutableMipeProductSnapshot({...product,unit:'g'},{organizationId:'org-a',siteId:'site-a',at:'2026-08-17T12:00:00Z'}),/debe ser mL/)
})

test('M32-F007: treatment execution validates dose and snapshot validity without reading live product',()=>{
 const snapshot=createExecutableMipeProductSnapshot(product,{organizationId:'org-a',siteId:'site-a',at:'2026-08-17T12:00:00Z'})
 assert.equal(assertExecutableMipeProductSnapshot(snapshot,{at:'2026-08-18T12:00:00Z',dose:2,doseUnit:'mL/L'}),true)
 assert.throws(()=>assertExecutableMipeProductSnapshot(snapshot,{at:'2026-08-18T12:00:00Z',dose:4,doseUnit:'mL/L'}),/supera/)
 assert.throws(()=>assertExecutableMipeProductSnapshot(snapshot,{at:'2027-01-01T00:00:00Z',dose:2,doseUnit:'mL/L'}),/ya no está vigente/)
})

test('M32-F007: incident archive preserves identity and appends immutable lifecycle evidence',()=>{
 const incident=createMipeIncidentCatalogRecord({id:'incident-a',organizationId:'org-a',name:'Botrytis',category:'Enfermedad',risk:'Alto',createdAt:'2026-08-17T10:00:00Z'})
 assert.equal(assertMipeIncidentUsable(incident,{organizationId:'org-a',at:'2026-08-17T11:00:00Z'}),true)
 const archived=archiveMipeIncidentRecord(incident,{organizationId:'org-a',commandId:'archive-a',actor:{id:'u1',name:'Agrónomo'},occurredAt:'2026-08-17T12:00:00Z',reason:'Catálogo reemplazado'})
 assert.equal(archived.id,'incident-a')
 assert.equal(archived.active,false)
 assert.equal(archived.lifecycleHistory.length,1)
 assert.equal(archived.lifecycleHistory[0].type,'ARCHIVED')
 assert.throws(()=>assertMipeIncidentUsable(archived,{organizationId:'org-a',at:'2026-08-17T13:00:00Z'}),/archivada/)
 const replay=archiveMipeIncidentRecord(archived,{organizationId:'org-a',commandId:'archive-a',actor:{id:'u1'},occurredAt:'2026-08-17T09:00:00Z'})
 assert.equal(replay.lifecycleHistory.length,1)
})

test('M32-F007: incident validity window is enforced for new findings',()=>{
 const future=createMipeIncidentCatalogRecord({id:'future',organizationId:'org-a',name:'Evento futuro',category:'Otro',risk:'Bajo',validFrom:'2026-09-01T00:00:00Z',createdAt:'2026-08-17T10:00:00Z'})
 assert.throws(()=>assertMipeIncidentUsable(future,{organizationId:'org-a',at:'2026-08-17T11:00:00Z'}),/todavía no está vigente/)
})
