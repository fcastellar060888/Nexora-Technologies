import test from'node:test'
import assert from'node:assert/strict'
import{isOpenPassportFinding,projectPassportFindings,passportIndicator,passportRelationship}from'../src/core/passport/index.js'

test('normaliza hallazgos MIPE y conserva inmutabilidad',()=>{
 const findings=[{id:'f-1',type:'Ácaros',status:'Abierto',severity:'Alta',observation:'Revisar envés',reportDate:'2026-08-01'}]
 const projected=projectPassportFindings({findings,matches:item=>item.id==='f-1'})
 assert.equal(projected.length,1)
 assert.equal(projected[0].notes,'Revisar envés')
 assert.equal(projected[0].reportedAt,'2026-08-01T00:00:00.000Z')
 assert.equal(Object.isFrozen(projected),true)
 assert.equal(Object.isFrozen(projected[0]),true)
})

test('clasifica hallazgos abiertos y cerrados',()=>{
 assert.equal(isOpenPassportFinding({status:'Abierto'}),true)
 assert.equal(isOpenPassportFinding({status:'Resuelto'}),false)
 assert.equal(isOpenPassportFinding({status:'Falso positivo'}),false)
})

test('crea indicadores y relaciones canónicas',()=>{
 assert.deepEqual(passportIndicator('open_mipe_findings',2,'findings'),{key:'open_mipe_findings',value:2,unit:'findings'})
 assert.deepEqual(passportRelationship('located_in','organization.site','site-1','Villeta',{targetOrganizationId:'org-1'}),{type:'located_in',targetType:'organization.site',targetId:'site-1',targetOrganizationId:'org-1',label:'Villeta'})
})

test('rechaza configuraciones incompletas',()=>{
 assert.throws(()=>projectPassportFindings({findings:[]}),/predicado matches/)
 assert.throws(()=>passportIndicator('',1,'count'),/requiere una clave/)
 assert.throws(()=>passportRelationship('located_in','','site-1'),/requiere tipo/)
})
