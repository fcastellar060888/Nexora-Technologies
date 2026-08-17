import test from'node:test'
import assert from'node:assert/strict'
import{backfillMipeOwnership,findMipeRecord,mergeMipeState,mipeRecordOrganizationId,mipeRecordsForOrganization,mutateMipeState,ownMipeRecord,scopeMipeState}from'../src/domain/mipeTenancy.js'

function state(){return{
 companies:[{id:'org-a'},{id:'org-b'}],currentContext:{companyId:'org-a',siteId:'site-shared'},
 sites:[{id:'site-shared',organizationId:'org-a',companyId:'org-a'},{id:'site-shared',organizationId:'org-b',companyId:'org-b'}],
 houses:[{id:'house-shared',organizationId:'org-a',siteId:'site-shared'},{id:'house-shared',organizationId:'org-b',siteId:'site-shared'}],
 beds:[{id:'bed-shared',organizationId:'org-a',siteId:'site-shared',houseId:'house-shared'},{id:'bed-shared',organizationId:'org-b',siteId:'site-shared',houseId:'house-shared'}],
 plantPositions:[{id:'plant-shared',organizationId:'org-a',siteId:'site-shared',bedId:'bed-shared'},{id:'plant-shared',organizationId:'org-b',siteId:'site-shared',bedId:'bed-shared'}],
 grandmotherPlants:[{id:'material-a',organizationId:'org-a',siteId:'site-shared'}],motherPlants:[{id:'material-b',organizationId:'org-b',siteId:'site-shared'}],genetics:[],
 products:[{id:'product-shared',organizationId:'org-a',siteId:'site-shared',unit:'mL'},{id:'product-shared',organizationId:'org-b',siteId:'site-shared',unit:'mL'}],
 inventoryLots:[{id:'lot-shared',organizationId:'org-a',siteId:'site-shared',productId:'product-shared',quantity:10},{id:'lot-shared',organizationId:'org-b',siteId:'site-shared',productId:'product-shared',quantity:20}],
 inventoryMovements:[],costEntries:[],
 incidents:[{id:'incident-shared',organizationId:'org-a',name:'Ácaro A'},{id:'incident-shared',organizationId:'org-b',name:'Ácaro B'}],
 findings:[{id:'finding-shared',organizationId:'org-a',siteId:'site-shared',targetType:'POSITION',targetId:'plant-shared',plantPositionId:'plant-shared',incidentId:'incident-shared',status:'Detectado'},{id:'finding-shared',organizationId:'org-b',siteId:'site-shared',targetType:'POSITION',targetId:'plant-shared',plantPositionId:'plant-shared',incidentId:'incident-shared',status:'Detectado'}],
 treatments:[{id:'treatment-shared',organizationId:'org-a',siteId:'site-shared',findingId:'finding-shared',productId:'product-shared',status:'Programado'},{id:'treatment-shared',organizationId:'org-b',siteId:'site-shared',findingId:'finding-shared',productId:'product-shared',status:'Programado'}],
 mipeInterventions:[{id:'intervention-shared',organizationId:'org-a',siteId:'site-shared',findingId:'finding-shared',treatmentId:'treatment-shared'},{id:'intervention-shared',organizationId:'org-b',siteId:'site-shared',findingId:'finding-shared',treatmentId:'treatment-shared'}]
}}

test('M32-F002: same IDs remain isolated by organization through all MIPE collections',()=>{
 const s=state()
 for(const collection of['incidents','findings','treatments','mipeInterventions']){
  const a=mipeRecordsForOrganization(s,collection,'org-a'),b=mipeRecordsForOrganization(s,collection,'org-b')
  assert.equal(a.length,1,`${collection} org-a`)
  assert.equal(b.length,1,`${collection} org-b`)
  assert.equal(a[0].organizationId,'org-a')
  assert.equal(b[0].organizationId,'org-b')
 }
 assert.equal(findMipeRecord(s,'incidents','incident-shared').name,'Ácaro A')
 assert.equal(findMipeRecord(s,'treatments','treatment-shared').organizationId,'org-a')
})

test('M32-F002: an unowned finding over an ambiguous repeated Position fails closed',()=>{
 const s=state(),record={id:'finding-ambiguous',plantPositionId:'plant-shared',incidentId:'incident-shared'}
 assert.equal(mipeRecordOrganizationId(s,'findings',record),'')
 assert.equal(mipeRecordsForOrganization({...s,findings:[...s.findings,record]},'findings','org-a').some(item=>item.id==='finding-ambiguous'),false)
})

test('M32-F002: legacy findings infer ownership from an unequivocal Position or material plant',()=>{
 const s=state()
 s.plantPositions=[{id:'plant-a',organizationId:'org-a',siteId:'site-a',bedId:'bed-a'}]
 s.beds=[{id:'bed-a',organizationId:'org-a',siteId:'site-a',houseId:'house-a'}]
 s.houses=[{id:'house-a',organizationId:'org-a',siteId:'site-a'}]
 s.sites=[{id:'site-a',organizationId:'org-a',companyId:'org-a'},{id:'site-b',organizationId:'org-b',companyId:'org-b'}]
 const position={id:'f-position',plantPositionId:'plant-a',incidentId:'incident-shared'},material={id:'f-material',materialPlantId:'material-b',incidentId:'incident-shared'}
 assert.equal(mipeRecordOrganizationId(s,'findings',position),'org-a')
 assert.equal(mipeRecordOrganizationId(s,'findings',material),'org-b')
})

test('M32-F002: backfill clones a legacy incident shared by findings of two tenants instead of assigning it arbitrarily',()=>{
 const s=state()
 s.incidents=[{id:'incident-legacy',name:'Mosca blanca'}]
 s.findings=[
  {id:'finding-a',organizationId:'org-a',siteId:'site-shared',incidentId:'incident-legacy'},
  {id:'finding-b',organizationId:'org-b',siteId:'site-shared',incidentId:'incident-legacy'}
 ]
 const migrated=backfillMipeOwnership(s),copies=migrated.incidents.filter(item=>item.id==='incident-legacy')
 assert.equal(copies.length,2)
 assert.deepEqual(copies.map(item=>item.organizationId).sort(),['org-a','org-b'])
 assert.equal(copies[0].name,'Mosca blanca')
})

test('M32-F002: backfill follows finding -> treatment -> intervention causality without using active tenant as a guess',()=>{
 const s=state()
 s.sites=[{id:'site-a',organizationId:'org-a',companyId:'org-a'},{id:'site-b',organizationId:'org-b',companyId:'org-b'}]
 s.findings=[{id:'finding-a',organizationId:'org-a',siteId:'site-a',incidentId:'incident-shared'},{id:'finding-b',organizationId:'org-b',siteId:'site-b',incidentId:'incident-shared'}]
 s.treatments=[{id:'treatment-a',findingId:'finding-a',productId:''},{id:'treatment-b',findingId:'finding-b',productId:''}]
 s.mipeInterventions=[{id:'intervention-a',findingId:'finding-a',treatmentId:'treatment-a'},{id:'intervention-b',findingId:'finding-b',treatmentId:'treatment-b'}]
 const migrated=backfillMipeOwnership(s)
 assert.equal(migrated.treatments.find(item=>item.id==='treatment-a').organizationId,'org-a')
 assert.equal(migrated.treatments.find(item=>item.id==='treatment-b').organizationId,'org-b')
 assert.equal(migrated.mipeInterventions.find(item=>item.id==='intervention-a').organizationId,'org-a')
 assert.equal(migrated.mipeInterventions.find(item=>item.id==='intervention-b').organizationId,'org-b')
})

test('M32-F002: contradictory explicit ownership and causal references become unreadable',()=>{
 const s=state(),corrupt={id:'bad-treatment',organizationId:'org-a',findingId:'foreign-finding',productId:'product-shared'}
 s.findings.push({id:'foreign-finding',organizationId:'org-b',siteId:'site-shared',incidentId:'incident-shared'})
 assert.equal(mipeRecordOrganizationId(s,'treatments',corrupt),'')
 assert.throws(()=>findMipeRecord({...s,treatments:[corrupt]},'treatments','bad-treatment'),/otra empresa|ownership inequívoco/)
})

test('M32-F002: scoped state exposes only active-tenant MIPE and physical references',()=>{
 const scoped=scopeMipeState(state(),'org-a')
 for(const collection of['sites','houses','beds','plantPositions','products','inventoryLots','incidents','findings','treatments','mipeInterventions']){
  assert.ok(scoped[collection].length>0,collection)
  assert.equal(scoped[collection].some(item=>item.organizationId==='org-b'),false,collection)
 }
})

test('M32-F002: merge mutates only active tenant and preserves foreign homonyms',()=>{
 const s=state(),base=scopeMipeState(s,'org-a'),candidate={...base,findings:base.findings.map(item=>({...item,status:'Seguimiento'})),treatments:[...base.treatments,{id:'treatment-new',findingId:'finding-shared',productId:'product-shared',siteId:'site-shared',status:'Programado'}]}
 const merged=mergeMipeState(s,base,candidate,'org-a')
 assert.equal(merged.findings.find(item=>item.organizationId==='org-a').status,'Seguimiento')
 assert.equal(merged.findings.find(item=>item.organizationId==='org-b').status,'Detectado')
 assert.equal(merged.treatments.find(item=>item.id==='treatment-new').organizationId,'org-a')
 assert.equal(merged.treatments.filter(item=>item.id==='treatment-shared').length,2)
})

test('M32-F002: ownMipeRecord rejects foreign references before stamping ownership',()=>{
 const s=state()
 s.incidents.push({id:'incident-only-b',organizationId:'org-b',name:'Foreign'})
 assert.throws(()=>ownMipeRecord(s,'findings',{id:'new-f',siteId:'site-shared',plantPositionId:'plant-shared',incidentId:'incident-only-b'},'org-a'),/incidencia pertenece a otra empresa/)
 s.products.push({id:'product-only-b',organizationId:'org-b',siteId:'site-shared'})
 assert.throws(()=>ownMipeRecord(s,'treatments',{id:'new-t',findingId:'finding-shared',productId:'product-only-b'},'org-a'),/producto pertenece a otra empresa/)
})

test('M32-F002: mutateMipeState cannot delete or overwrite the foreign homonym',()=>{
 const s=state(),next=mutateMipeState(s,tenant=>({...tenant,findings:tenant.findings.filter(item=>item.id!=='finding-shared')}))
 assert.equal(next.findings.some(item=>item.organizationId==='org-a'),false)
 assert.equal(next.findings.filter(item=>item.organizationId==='org-b').length,1)
})

test('M32-F002: duplicate identity inside one tenant fails closed',()=>{
 const s=state(),duplicate={...s.findings[0],notes:'duplicate'}
 s.findings.push(duplicate)
 assert.throws(()=>findMipeRecord(s,'findings','finding-shared'),/identidad duplicada/)
 const base=scopeMipeState(s,'org-a'),candidate={...base,findings:base.findings.map((item,index)=>index===0?{...item,status:'Seguimiento'}:item)}
 assert.throws(()=>mergeMipeState(s,base,candidate,'org-a'),/identidad duplicada|duplicado/)
})
