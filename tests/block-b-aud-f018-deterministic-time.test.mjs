import test from'node:test'
import assert from'node:assert/strict'
import{createIntelligentObject,createPassport,DETERMINISTIC_TIMESTAMP}from'../src/core/passport/passportContract.js'
import{createPassportBuilder}from'../src/core/passport/passportBuilder.js'
import{createMaterialPlantPassportFromState}from'../src/core/passport/materialPlantPassport.js'
import{createCultivationPlantPassportFromState}from'../src/core/passport/cultivationPlantPassport.js'
import{createPlantPassportFromState}from'../src/core/passport/plantIdentity.js'
import{replayLedger}from'../src/core/projectionEngine/replayLedger.js'

test('AUD-F018: Passport deriva generatedAt del objeto y no del reloj actual',()=>{
 const object=createIntelligentObject({objectType:'test.object',objectId:'o-1',organizationId:'org-1',label:'Objeto',createdAt:'2026-01-01T00:00:00.000Z',updatedAt:'2026-02-03T04:05:06.000Z'})
 const first=createPassport({object})
 const second=createPassport({object})
 assert.deepEqual(second,first)
 assert.equal(first.generatedAt,'2026-02-03T04:05:06.000Z')
})

test('AUD-F018: el builder entrega a plugins una fecha de proyección estable',()=>{
 let observed=''
 const builder=createPassportBuilder({plugins:[{id:'clock-proof',project:({context})=>{observed=context.projectionTime;return{decisionContext:{projectionTime:context.projectionTime}}}}]})
 const object=createIntelligentObject({objectType:'test.object',objectId:'o-2',organizationId:'org-1',label:'Objeto',createdAt:'2026-01-01T00:00:00.000Z',updatedAt:'2026-03-01T00:00:00.000Z'})
 const passport=builder.build({object})
 assert.equal(observed,'2026-03-01T00:00:00.000Z')
 assert.equal(passport.generatedAt,observed)
 assert.equal(passport.decisionContext.projectionTime,observed)
})

test('AUD-F018: material vegetal sin fechas usa un fallback estable',()=>{
 const state={
  currentContext:{companyId:'org-1'},sites:[],genetics:[],attachments:[],findings:[],plantEvents:[],timelineEntries:[],motherPlants:[],propagationBatches:[],
  grandmotherPlants:[{id:'lot-1',lotCode:'LAB-1',quantity:1}],
  materialPlantUnits:[{id:'life-1',lotId:'lot-1',plantType:'GRANDMOTHER',unitIndex:0,code:'LAB-1-A001'}]
 }
 const first=createMaterialPlantPassportFromState(state,{unitId:'life-1'})
 const second=createMaterialPlantPassportFromState(state,{unitId:'life-1'})
 assert.deepEqual(second,first)
 assert.equal(first.object.createdAt,DETERMINISTIC_TIMESTAMP)
 assert.equal(first.generatedAt,DETERMINISTIC_TIMESTAMP)
})

test('AUD-F018: planta productiva sin fechas no cambia entre proyecciones',()=>{
 const state={
  plantPositions:[{id:'p-1',code:'P-1',companyId:'org-1'}],beds:[],houses:[],sites:[],companies:[],propagationUnits:[],propagationBatches:[],motherPlants:[],grandmotherPlants:[],attachments:[],findings:[],plantEvents:[],treatments:[],timelineEntries:[],incidents:[],products:[],genetics:[]
 }
 const first=createCultivationPlantPassportFromState(state,{plantId:'p-1'})
 const second=createCultivationPlantPassportFromState(state,{plantId:'p-1'})
 assert.deepEqual(second,first)
 assert.equal(first.object.createdAt,DETERMINISTIC_TIMESTAMP)
 assert.equal(first.generatedAt,DETERMINISTIC_TIMESTAMP)
})

test('AUD-F018: la fachada histórica no consulta el reloj al faltar fechas',()=>{
 const state={grandmotherPlants:[{id:'legacy-lot',lotCode:'LEG-1',quantity:1,companyId:'org-1'}],motherPlants:[]}
 const first=createPlantPassportFromState(state,{kind:'grandmother',individualId:'legacy-lot:001'})
 const second=createPlantPassportFromState(state,{kind:'grandmother',individualId:'legacy-lot:001'})
 assert.deepEqual(second,first)
 assert.equal(first.object.createdAt,DETERMINISTIC_TIMESTAMP)
 assert.equal(first.object.updatedAt,DETERMINISTIC_TIMESTAMP)
 assert.equal(first.generatedAt,DETERMINISTIC_TIMESTAMP)
})

test('AUD-F018: replay fija projectionTime desde recordedAt para cada entrada',async()=>{
 const contexts=[]
 const entry={sequence:7,recordedAt:'2026-05-06T07:08:09.000Z',event:{eventId:'evt-7',occurredAt:'2026-05-01T00:00:00.000Z'}}
 const ledger={find:()=>[entry]}
 const engine={replay:async(_event,context)=>{contexts.push(context);return{ok:true}}}
 const first=await replayLedger(ledger,engine)
 const second=await replayLedger(ledger,engine)
 assert.equal(first.succeeded,1)
 assert.equal(second.succeeded,1)
 assert.equal(contexts[0].projectionTime,'2026-05-06T07:08:09.000Z')
 assert.equal(contexts[1].projectionTime,contexts[0].projectionTime)
 assert.equal(Object.isFrozen(contexts[0]),true)
})

test('AUD-F018: replay rechaza evidencia temporal inválida sin ejecutar el proyector',async()=>{
 let calls=0
 const ledger={find:()=>[{sequence:1,recordedAt:'fecha-invalida',event:{eventId:'evt-1'}}]}
 const engine={replay:async()=>{calls+=1}}
 const report=await replayLedger(ledger,engine,{stopOnError:true})
 assert.equal(calls,0)
 assert.equal(report.failed,1)
 assert.match(report.results[0].error,/fecha determinista válida/)
})
