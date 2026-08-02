const text=value=>String(value??'').trim()
const list=value=>Array.isArray(value)?value:[]

export function createProjector({id,name=null,version=1,priority=0,dependencies=[],supports,project}){
 const projectorId=text(id)
 if(!projectorId)throw new Error('El proyector requiere id')
 if(!Number.isInteger(Number(version))||Number(version)<1)throw new Error('La versión del proyector debe ser un entero positivo')
 if(!Number.isFinite(Number(priority)))throw new Error('La prioridad del proyector debe ser numérica')
 if(typeof supports!=='function')throw new Error('El proyector requiere supports(event)')
 if(typeof project!=='function')throw new Error('El proyector requiere project(event, context)')
 const normalizedDependencies=[...new Set(list(dependencies).map(text).filter(Boolean))]
 if(normalizedDependencies.includes(projectorId))throw new Error('Un proyector no puede depender de sí mismo')
 return Object.freeze({
  id:projectorId,
  name:text(name)||projectorId,
  version:Number(version),
  priority:Number(priority),
  dependencies:Object.freeze(normalizedDependencies),
  supports,
  project
 })
}

export function isProjector(value){
 return Boolean(value&&text(value.id)&&Number.isInteger(value.version)&&Array.isArray(value.dependencies)&&typeof value.supports==='function'&&typeof value.project==='function')
}
