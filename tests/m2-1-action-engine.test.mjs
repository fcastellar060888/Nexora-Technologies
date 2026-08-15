import test from'node:test'
import assert from'node:assert/strict'
import{readFile}from'node:fs/promises'
import{createActionEngine,defineAction}from'../src/core/actions/index.js'
import{createPlantActionEngine,PlantActions}from'../src/services/plantActionEngine.js'

const target={type:'material-plant',id:'plant-1',organizationId:'org-a',siteId:'site-a',snapshot:{status:'Activa'}}

test('M21-F009: Action Engine registers, resolves and filters reusable actions',()=>{
 const engine=createActionEngine()
 const stop=engine.register(defineAction({id:'plant.inspect',label:'Inspeccionar',targetTypes:['material-plant'],execute:async()=>({ok:true})}))
 engine.register(defineAction({id:'batch.promote',label:'Promover',targetTypes:['propagation-batch'],execute:async()=>({ok:true})}))
 assert.equal(engine.status().registeredActions,2)
 assert.deepEqual(engine.list({targetType:'material-plant'}).map(item=>item.id),['plant.inspect'])
 assert.equal(engine.get('plant.inspect')?.label,'Inspeccionar')
 assert.throws(()=>engine.register(defineAction({id:'plant.inspect',label:'Duplicada',execute:async()=>({})})),/ya está registrada/)
 stop();assert.equal(engine.get('plant.inspect'),null)
})

test('M21-F009: authorization and validation fail before executor side effects',async()=>{
 let executions=0
 const denied=createActionEngine();denied.register(defineAction({id:'plant.cut',label:'Cortar',targetTypes:['material-plant'],authorize:()=>false,execute:async()=>{executions++;return{ok:true}}}))
 await assert.rejects(()=>denied.execute('plant.cut',{target}),/permiso/)
 const invalid=createActionEngine();invalid.register(defineAction({id:'plant.cut',label:'Cortar',targetTypes:['material-plant'],validate:()=> 'La planta no está disponible',execute:async()=>{executions++;return{ok:true}}}))
 await assert.rejects(()=>invalid.execute('plant.cut',{target}),/no está disponible/)
 assert.equal(executions,0)
})

test('M21-F009: executor receives immutable isolated target and input',async()=>{
 const engine=createActionEngine(),input={quantity:2,nested:{purpose:'production'}}
 engine.register(defineAction({id:'plant.cut',label:'Cortar',targetTypes:['material-plant'],execute:async envelope=>{
  assert.ok(Object.isFrozen(envelope.target)&&Object.isFrozen(envelope.input)&&Object.isFrozen(envelope.input.nested))
  assert.notEqual(envelope.input,input)
  return{accepted:envelope.input.quantity}
 }}))
 const result=await engine.execute('plant.cut',{target,input})
 assert.equal(result.actionId,'plant.cut');assert.equal(result.result.accepted,2)
 assert.ok(Object.isFrozen(result.result));assert.equal(input.nested.purpose,'production')
})

test('M21-F009: unknown action, wrong target and undefined result fail closed',async()=>{
 const engine=createActionEngine();engine.register(defineAction({id:'plant.inspect',label:'Inspeccionar',targetTypes:['material-plant'],execute:async()=>undefined}))
 await assert.rejects(()=>engine.execute('missing',{target}),/no existe/)
 await assert.rejects(()=>engine.execute('plant.inspect',{target:{...target,type:'propagation-batch'}}),/no aplica/)
 await assert.rejects(()=>engine.execute('plant.inspect',{target}),/no devolvió un resultado/)
 assert.throws(()=>defineAction({id:'',label:'X',execute:()=>({})}),/identificador/)
 assert.throws(()=>defineAction({id:'x',label:'X'}),/execute/)
})

test('M21-F009/F010: plant catalog exposes cut and promotion as central actions',()=>{
 const state={companies:[{id:'org-a'}],currentContext:{companyId:'org-a',siteId:'site-a'},users:[],roles:[],memberships:[]}
 const engine=createPlantActionEngine(state,{})
 assert.deepEqual(engine.list().map(item=>item.id).sort(),[PlantActions.CREATE_PROPAGATION_BATCH,PlantActions.PROMOTE_PROPAGATION_UNITS].sort())
 assert.deepEqual(engine.list({targetType:'material-plant'}).map(item=>item.id),[PlantActions.CREATE_PROPAGATION_BATCH])
 assert.deepEqual(engine.list({targetType:'propagation-batch'}).map(item=>item.id),[PlantActions.PROMOTE_PROPAGATION_UNITS])
})

test('M21-F009/F010 re-audit: propagation React surfaces consume action registry, not domain commands',async()=>{
 const cut=await readFile(new URL('../src/components/PurposeAwarePropagationForm.jsx',import.meta.url),'utf8')
 const promotion=await readFile(new URL('../src/components/RootedCuttingPromotionPanel.jsx',import.meta.url),'utf8')
 for(const source of[cut,promotion]){assert.match(source,/executePlantAction/);assert.match(source,/PlantActions/);assert.doesNotMatch(source,/from'\.\.\/services\/propagation(?:Batch|Promotion)Command/)}
 assert.match(cut,/CREATE_PROPAGATION_BATCH/)
 assert.match(promotion,/PROMOTE_PROPAGATION_UNITS/)
})
