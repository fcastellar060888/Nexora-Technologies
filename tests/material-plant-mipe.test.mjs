import test from'node:test'
import assert from'node:assert/strict'
import{appendMaterialPlantFindings,createMaterialPlantFindingRecords,materialPlantFindingDetail}from'../src/domain/materialPlantMipe.js'

const plants=[{id:'mother:1',plantType:'MOTHER',lotId:'lot-1',siteId:'site-1'},{id:'mother:2',plantType:'MOTHER',lotId:'lot-1',siteId:'site-1'}]

test('crea un hallazgo MIPE compatible por cada planta seleccionada',()=>{
 const records=createMaterialPlantFindingRecords(plants,{type:'Botrytis',severity:'Alta',notes:'Seguimiento inmediato',reportedAt:'2026-08-01T09:00:00Z'})
 assert.equal(records.length,2)
 assert.equal(records[0].materialPlantId,'mother:1')
 assert.equal(records[0].entityType,'materialPlant')
 assert.equal(records[0].plantId,'mother:1')
 assert.equal(records[0].status,'Abierto')
 assert.equal(records[0].severity,'Alta')
 assert.equal(records[0].reportedAt,'2026-08-01T09:00:00.000Z')
 assert.notEqual(records[0].id,records[1].id)
})

test('agrega hallazgos sin modificar ni reemplazar el historial existente',()=>{
 const state={findings:[{id:'legacy',type:'Ácaros'}],otherCollection:[{id:'safe'}]}
 const next=appendMaterialPlantFindings(state,[plants[0]],{type:'Deficiencia visual'})
 assert.equal(state.findings.length,1)
 assert.equal(next.findings.length,2)
 assert.deepEqual(next.otherCollection,state.otherCollection)
 assert.equal(next.findings[0].id,'legacy')
})

test('bloquea registros sin selección o sin tipo de hallazgo',()=>{
 assert.throws(()=>createMaterialPlantFindingRecords([],{type:'Botrytis'}),/Selecciona al menos una planta/)
 assert.throws(()=>createMaterialPlantFindingRecords(plants,{type:' '}),/obligatorio/)
 assert.throws(()=>createMaterialPlantFindingRecords(plants,{type:'Botrytis',reportedAt:'fecha inválida'}),/fecha/)
})

test('genera detalle de auditoría legible para acciones masivas',()=>{
 assert.equal(materialPlantFindingDetail(plants,{type:'Botrytis',severity:'Crítica'}),'2 plantas · Botrytis · Severidad Crítica')
})
