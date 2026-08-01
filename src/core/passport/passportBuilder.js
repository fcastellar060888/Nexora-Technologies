import{createPassport,isIntelligentObject}from'./passportContract.js'

const SECTION_KEYS=Object.freeze(['relationships','documents','indicators','risks','actions','timeline'])
const list=value=>Array.isArray(value)?value:[]

function normalizePlugin(plugin,index){
 if(typeof plugin==='function')return Object.freeze({id:`plugin-${index+1}`,project:plugin})
 if(!plugin||typeof plugin!=='object'||typeof plugin.project!=='function')throw new Error('Cada plugin del Passport debe exponer una función project')
 const id=String(plugin.id||'').trim()
 if(!id)throw new Error('Cada plugin del Passport debe tener un identificador')
 return Object.freeze({id,project:plugin.project})
}

export function createPassportBuilder({plugins=[]}={}){
 const registry=[]
 const ids=new Set()

 function use(plugin){
  const normalized=normalizePlugin(plugin,registry.length)
  if(ids.has(normalized.id))throw new Error(`El plugin ${normalized.id} ya está registrado`)
  registry.push(normalized)
  ids.add(normalized.id)
  return api
 }

 function build({object,state={},context={},base={}}={}){
  if(!isIntelligentObject(object))throw new Error('El builder requiere un Objeto Inteligente válido')
  const output={
   relationships:[...list(base.relationships)],documents:[...list(base.documents)],indicators:[...list(base.indicators)],
   risks:[...list(base.risks)],actions:[...list(base.actions)],timeline:[...list(base.timeline)],
   decisionContext:{...(base.decisionContext||{})}
  }
  for(const plugin of registry){
   const projection=plugin.project(Object.freeze({object,state,context}))||{}
   if(typeof projection!=='object'||Array.isArray(projection))throw new Error(`El plugin ${plugin.id} devolvió una proyección inválida`)
   for(const key of SECTION_KEYS)output[key].push(...list(projection[key]))
   if(projection.decisionContext){
    if(typeof projection.decisionContext!=='object'||Array.isArray(projection.decisionContext))throw new Error(`El plugin ${plugin.id} devolvió un contexto de decisión inválido`)
    Object.assign(output.decisionContext,projection.decisionContext)
   }
  }
  return createPassport({object,...output,generatedAt:base.generatedAt})
 }

 function listPlugins(){return Object.freeze(registry.map(plugin=>plugin.id))}
 const api=Object.freeze({use,build,listPlugins})
 plugins.forEach(use)
 return api
}
