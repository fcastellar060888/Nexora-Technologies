import{enrichPassportProjection}from'./passportProjectionEnrichment.js'

const SECTION_KEYS=Object.freeze(['relationships','documents','indicators','risks','actions','timeline'])
const list=value=>Array.isArray(value)?value:[]

export function createProjectionPlugin({id,select=({context})=>context?.projection}={}){
 const pluginId=String(id||'').trim()
 if(!pluginId)throw new Error('El plugin de proyección requiere un identificador')
 if(typeof select!=='function')throw new Error(`El plugin ${pluginId} requiere una función select`)
 return Object.freeze({
  id:pluginId,
  project(input){
   const selected=select(input)||{}
   if(typeof selected!=='object'||Array.isArray(selected))throw new Error(`El plugin ${pluginId} recibió una proyección inválida`)
   const source=enrichPassportProjection(pluginId,input,selected)
   if(typeof source!=='object'||Array.isArray(source))throw new Error(`El plugin ${pluginId} recibió una proyección enriquecida inválida`)
   const projection={}
   for(const key of SECTION_KEYS)projection[key]=list(source[key])
   if(source.decisionContext!==undefined){
    if(source.decisionContext===null||typeof source.decisionContext!=='object'||Array.isArray(source.decisionContext))throw new Error(`El plugin ${pluginId} recibió un contexto de decisión inválido`)
    projection.decisionContext=source.decisionContext
   }
   return projection
  }
 })
}
