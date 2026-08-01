import test from'node:test'
import assert from'node:assert/strict'
import{projectPassportDocuments,projectPassportTimeline,passportSourceValue}from'../src/core/passport/index.js'

test('normaliza documentos filtrados con contrato estable',()=>{
 const documents=projectPassportDocuments({attachments:[{id:'a-1',entityType:'plant',name:'Foto',type:'image/jpeg',size:'12',createdAt:'2026-08-01T00:00:00Z'},{id:'a-2',entityType:'lot'}],matches:item=>item.entityType==='plant'})
 assert.deepEqual(documents,[{id:'a-1',type:'image/jpeg',name:'Foto',size:12,dataUrl:'',createdAt:'2026-08-01T00:00:00.000Z'}])
 assert.equal(Object.isFrozen(documents[0]),true)
})

test('rechaza proyección documental sin predicado',()=>{
 assert.throws(()=>projectPassportDocuments({attachments:[]}),/función matches/)
})

test('compone Timeline canónico con respaldo heredado por objeto',()=>{
 const timeline=projectPassportTimeline({aggregateId:'plant-1',canonical:[{id:'canonical-1',aggregateId:'plant-1',occurredAt:'2026-08-02T00:00:00Z',title:'Canónico'},{id:'other',aggregateId:'plant-2',occurredAt:'2026-08-03T00:00:00Z',title:'Otro'}],legacy:[{id:'legacy-1',occurredAt:'2026-08-01T00:00:00Z',title:'Histórico'}]})
 assert.deepEqual(timeline.map(item=>item.id),['canonical-1','legacy-1'])
})

test('exige aggregateId y expone normalizadores compartidos',()=>{
 assert.throws(()=>projectPassportTimeline({}),/aggregateId/)
 assert.equal(passportSourceValue.text('  planta  '),'planta')
 assert.deepEqual(passportSourceValue.list(null),[])
 assert.equal(passportSourceValue.iso('invalid'),null)
})
