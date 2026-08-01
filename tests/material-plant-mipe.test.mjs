import test from'node:test'
import assert from'node:assert/strict'
import{appendMaterialPlantFindings,createMaterialPlantFindingRecords,materialPlantFindingDetail,openBlockingMipeFindings,resolveMaterialPlantFinding,shouldSuggestMipeBlock}from'../src/domain/materialPlantMipe.js'

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

test('resolver el único bloqueo rehabilita la planta para corte',()=>{
 const blocked=appendMaterialPlantFindings({findings:[],materialPlantUnits:[],plantEvents:[]},[plants[0]],{type:'Botrytis',severity:'Crítica',restrictAvailability:true})
 const finding=blocked.findings[0]
 const result=resolveMaterialPlantFinding(blocked,{findingId:finding.id,status:'Resuelto',resolutionNotes:'Control confirmado',resolvedAt:'2026-08-02T10:00:00Z'})
 assert.equal(result.released,true)
 assert.equal(result.remainingBlockingFindings,0)
 assert.equal(result.state.findings[0].status,'Resuelto')
 assert.equal(result.state.materialPlantUnits[0].operationalAvailability,'Disponible para corte')
 assert.equal(result.state.plantEvents.at(-1).title,'Hallazgo MIPE resuelto y planta rehabilitada')
})

test('mantiene el bloqueo mientras exista otro hallazgo restrictivo abierto',()=>{
 let blocked=appendMaterialPlantFindings({findings:[],materialPlantUnits:[],plantEvents:[]},[plants[0]],{type:'Botrytis',severity:'Crítica',restrictAvailability:true})
 blocked=appendMaterialPlantFindings(blocked,[plants[0]],{type:'Ácaros',severity:'Crítica',restrictAvailability:true})
 assert.equal(openBlockingMipeFindings(blocked,plants[0].id).length,2)
 const result=resolveMaterialPlantFinding(blocked,{findingId:blocked.findings[0].id,status:'Resuelto'})
 assert.equal(result.released,false)
 assert.equal(result.remainingBlockingFindings,1)
 assert.equal(result.state.materialPlantUnits[0].operationalAvailability,'Bloqueada por MIPE')
 assert.equal(result.state.plantEvents.at(-1).title,'Hallazgo MIPE resuelto')
})

test('cerrar un hallazgo no restrictivo no modifica disponibilidad',()=>{
 const state={findings:createMaterialPlantFindingRecords([plants[0]],{type:'Deficiencia',severity:'Media'}),materialPlantUnits:[],plantEvents:[]}
 const result=resolveMaterialPlantFinding(state,{findingId:state.findings[0].id,status:'Falso positivo'})
 assert.equal(result.released,false)
 assert.equal(result.state.materialPlantUnits.length,0)
 assert.equal(result.state.findings[0].status,'Falso positivo')
})

test('la severidad crítica sugiere bloqueo sin volverlo irreversible',()=>{
 assert.equal(shouldSuggestMipeBlock('Crítica'),true)
 assert.equal(shouldSuggestMipeBlock('Alta'),false)
 const records=createMaterialPlantFindingRecords([plants[0]],{type:'Botrytis',severity:'Crítica',restrictAvailability:false})
 assert.equal(records[0].restrictsPropagation,false)
})

test('bloquea registros y cierres inválidos',()=>{
 assert.throws(()=>createMaterialPlantFindingRecords([],{type:'Botrytis'}),/Selecciona al menos una planta/)
 assert.throws(()=>createMaterialPlantFindingRecords(plants,{type:' '}),/obligatorio/)
 assert.throws(()=>createMaterialPlantFindingRecords(plants,{type:'Botrytis',reportedAt:'fecha inválida'}),/fecha/)
 assert.throws(()=>resolveMaterialPlantFinding({findings:[]},{findingId:'missing'}),/No se encontró/)
 assert.throws(()=>resolveMaterialPlantFinding({findings:[{id:'x',status:'Resuelto'}]},{findingId:'x'}),/ya está cerrado/)
})

test('genera detalle de auditoría legible para acciones masivas',()=>{
 assert.equal(materialPlantFindingDetail(plants,{type:'Botrytis',severity:'Crítica',restrictAvailability:true}),'2 plantas · Botrytis · Severidad Crítica · Bloqueo para corte')
})
