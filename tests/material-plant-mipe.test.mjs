import test from'node:test'
import assert from'node:assert/strict'
import{appendMaterialPlantFindings,createMaterialPlantFindingRecords,materialPlantFindingDetail,shouldSuggestMipeBlock}from'../src/domain/materialPlantMipe.js'

const plants=[{id:'mother:1',plantType:'MOTHER',lotId:'lot-1',siteId:'site-1',unitIndex:0,code:'M-001'},{id:'mother:2',plantType:'MOTHER',lotId:'lot-1',siteId:'site-1',unitIndex:1,code:'M-002'}]

test('crea un hallazgo MIPE compatible por cada planta seleccionada',()=>{
 const records=createMaterialPlantFindingRecords(plants,{type:'Botrytis',severity:'Alta',notes:'Seguimiento inmediato',reportedAt:'2026-08-01T09:00:00Z'})
 assert.equal(records.length,2);assert.equal(records[0].materialPlantId,'mother:1');assert.equal(records[0].entityType,'materialPlant');assert.equal(records[0].plantId,'mother:1');assert.equal(records[0].status,'Abierto');assert.equal(records[0].severity,'Alta');assert.equal(records[0].reportedAt,'2026-08-01T09:00:00.000Z');assert.equal(records[0].restrictsPropagation,false);assert.notEqual(records[0].id,records[1].id)
})

test('agrega hallazgos sin modificar ni reemplazar el historial existente',()=>{
 const state={findings:[{id:'legacy',type:'Ácaros'}],otherCollection:[{id:'safe'}]}
 const next=appendMaterialPlantFindings(state,[plants[0]],{type:'Deficiencia visual'})
 assert.equal(state.findings.length,1);assert.equal(next.findings.length,2);assert.deepEqual(next.otherCollection,state.otherCollection);assert.equal(next.findings[0].id,'legacy');assert.equal(next.materialPlantUnits,undefined)
})

test('un hallazgo confirmado puede bloquear propagación y deja Timeline individual',()=>{
 const state={findings:[],materialPlantUnits:[],plantEvents:[]}
 const next=appendMaterialPlantFindings(state,plants,{type:'Botrytis',severity:'Crítica',restrictAvailability:true})
 assert.equal(next.findings.length,2)
 assert.ok(next.findings.every(item=>item.restrictsPropagation===true&&item.operationalAction==='Bloqueada por MIPE'))
 assert.equal(next.materialPlantUnits.length,2)
 assert.ok(next.materialPlantUnits.every(item=>item.operationalAvailability==='Bloqueada por MIPE'))
 assert.equal(next.plantEvents.length,2)
 assert.ok(next.plantEvents.every(item=>item.title==='Planta bloqueada por MIPE'&&item.source==='mipe-operational-rule'))
})

test('la severidad crítica sugiere bloqueo sin volverlo irreversible',()=>{
 assert.equal(shouldSuggestMipeBlock('Crítica'),true)
 assert.equal(shouldSuggestMipeBlock('Alta'),false)
 const records=createMaterialPlantFindingRecords([plants[0]],{type:'Botrytis',severity:'Crítica',restrictAvailability:false})
 assert.equal(records[0].restrictsPropagation,false)
})

test('bloquea registros sin selección o sin tipo de hallazgo',()=>{
 assert.throws(()=>createMaterialPlantFindingRecords([],{type:'Botrytis'}),/Selecciona al menos una planta/)
 assert.throws(()=>createMaterialPlantFindingRecords(plants,{type:' '}),/obligatorio/)
 assert.throws(()=>createMaterialPlantFindingRecords(plants,{type:'Botrytis',reportedAt:'fecha inválida'}),/fecha/)
})

test('genera detalle de auditoría legible para acciones masivas',()=>{
 assert.equal(materialPlantFindingDetail(plants,{type:'Botrytis',severity:'Crítica',restrictAvailability:true}),'2 plantas · Botrytis · Severidad Crítica · Bloqueo para corte')
})
