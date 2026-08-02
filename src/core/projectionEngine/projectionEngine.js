import{isProjector}from'./projectorContract.js'

const text=value=>String(value??'').trim()
const eventIdOf=event=>text(event?.eventId??event?.id)
const errorMessage=error=>text(error?.message)||'Error de proyección no identificado'

function orderedProjectors(projectors){
 const byId=new Map(projectors.map(projector=>[projector.id,projector]))
 for(const projector of projectors){
  for(const dependency of projector.dependencies)if(!byId.has(dependency))throw new Error(`Dependencia no registrada: ${dependency}`)
 }
 const visiting=new Set(),visited=new Set(),result=[]
 const visit=projector=>{
  if(visited.has(projector.id))return
  if(visiting.has(projector.id))throw new Error(`Ciclo de dependencias detectado en ${projector.id}`)
  visiting.add(projector.id)
  const dependencies=projector.dependencies.map(id=>byId.get(id)).sort((a,b)=>b.priority-a.priority||a.id.localeCompare(b.id))
  for(const dependency of dependencies)visit(dependency)
  visiting.delete(projector.id)
  visited.add(projector.id)
  result.push(projector)
 }
 for(const projector of [...projectors].sort((a,b)=>b.priority-a.priority||a.id.localeCompare(b.id)))visit(projector)
 return result
}

export function createProjectionEngine(){
 const projectors=new Map(),processed=new Set()
 function registerProjector(projector){
  if(!isProjector(projector))throw new Error('Se requiere un proyector válido')
  const existing=projectors.get(projector.id)
  if(existing&&existing!==projector)throw new Error(`El proyector ${projector.id} ya está registrado`)
  const candidate=new Map(projectors)
  candidate.set(projector.id,projector)
  orderedProjectors([...candidate.values()])
  projectors.set(projector.id,projector)
  return projector
 }
 function unregisterProjector(projectorId){return projectors.delete(text(projectorId))}
 function getProjector(projectorId){return projectors.get(text(projectorId))??null}
 function listProjectors(){return Object.freeze(orderedProjectors([...projectors.values()]))}
 async function execute(event,context={}){
  const eventId=eventIdOf(event)
  if(!eventId)throw new Error('El evento requiere eventId o id')
  const results=[],statusByProjector=new Map()
  for(const projector of orderedProjectors([...projectors.values()])){
   const blockedBy=projector.dependencies.filter(id=>['failed','blocked'].includes(statusByProjector.get(id)))
   if(blockedBy.length){
    const result=Object.freeze({projectorId:projector.id,version:projector.version,status:'blocked',reason:'dependency-failed',blockedBy:Object.freeze([...blockedBy])})
    results.push(result)
    statusByProjector.set(projector.id,'blocked')
    continue
   }
   const key=`${eventId}:${projector.id}:${projector.version}`
   if(processed.has(key)){
    results.push(Object.freeze({projectorId:projector.id,version:projector.version,status:'skipped',reason:'already-processed'}))
    statusByProjector.set(projector.id,'succeeded')
    continue
   }
   try{
    if(!await projector.supports(event,context)){
     results.push(Object.freeze({projectorId:projector.id,version:projector.version,status:'skipped',reason:'unsupported'}))
     statusByProjector.set(projector.id,'skipped')
     continue
    }
    const output=await projector.project(event,Object.freeze({...context,projectorId:projector.id,projectorVersion:projector.version}))
    processed.add(key)
    results.push(Object.freeze({projectorId:projector.id,version:projector.version,status:'succeeded',output}))
    statusByProjector.set(projector.id,'succeeded')
   }catch(error){
    results.push(Object.freeze({projectorId:projector.id,version:projector.version,status:'failed',error:errorMessage(error)}))
    statusByProjector.set(projector.id,'failed')
   }
  }
  return Object.freeze({eventId,results:Object.freeze(results)})
 }
 function hasProcessed(eventId,projectorId,version){return processed.has(`${text(eventId)}:${text(projectorId)}:${Number(version)}`)}
 function snapshot(){return Object.freeze({projectors:listProjectors(),processed:Object.freeze([...processed].sort())})}
 return Object.freeze({registerProjector,unregisterProjector,getProjector,listProjectors,execute,hasProcessed,snapshot})
}
