import{isProjector}from'./projectorContract.js'

const text=value=>String(value??'').trim()
const eventIdOf=event=>text(event?.eventId??event?.id)
const errorMessage=error=>text(error?.message)||'Error de proyección no identificado'
const sleep=ms=>ms>0?new Promise(resolve=>setTimeout(resolve,ms)):Promise.resolve()

function orderedProjectors(projectors){
 const byId=new Map(projectors.map(projector=>[projector.id,projector]))
 for(const projector of projectors)for(const dependency of projector.dependencies)if(!byId.has(dependency))throw new Error(`Dependencia no registrada: ${dependency}`)
 const visiting=new Set(),visited=new Set(),result=[]
 const visit=projector=>{
  if(visited.has(projector.id))return
  if(visiting.has(projector.id))throw new Error(`Ciclo de dependencias detectado en ${projector.id}`)
  visiting.add(projector.id)
  for(const dependency of projector.dependencies.map(id=>byId.get(id)).sort((a,b)=>b.priority-a.priority||a.id.localeCompare(b.id)))visit(dependency)
  visiting.delete(projector.id);visited.add(projector.id);result.push(projector)
 }
 for(const projector of [...projectors].sort((a,b)=>b.priority-a.priority||a.id.localeCompare(b.id)))visit(projector)
 return result
}

function withTimeout(promise,timeoutMs){
 if(!timeoutMs)return promise
 return Promise.race([promise,new Promise((_,reject)=>setTimeout(()=>reject(new Error(`Tiempo de espera agotado después de ${timeoutMs} ms`)),timeoutMs))])
}

async function runProjector(projector,event,context){
 let lastError=null
 for(let attempt=1;attempt<=projector.policy.maxAttempts;attempt++){
  try{
   const output=await withTimeout(Promise.resolve(projector.project(event,Object.freeze({...context,projectorId:projector.id,projectorVersion:projector.version,attempt}))),projector.policy.timeoutMs)
   return {ok:true,output,attempts:attempt}
  }catch(error){
   lastError=error
   if(attempt<projector.policy.maxAttempts)await sleep(projector.policy.retryDelayMs)
  }
 }
 return {ok:false,error:lastError,attempts:projector.policy.maxAttempts}
}

export function createProjectionEngine(){
 const projectors=new Map(),processed=new Set()
 function registerProjector(projector){
  if(!isProjector(projector))throw new Error('Se requiere un proyector válido')
  const existing=projectors.get(projector.id)
  if(existing&&existing!==projector)throw new Error(`El proyector ${projector.id} ya está registrado`)
  const candidate=new Map(projectors);candidate.set(projector.id,projector);orderedProjectors([...candidate.values()]);projectors.set(projector.id,projector);return projector
 }
 function unregisterProjector(projectorId){return projectors.delete(text(projectorId))}
 function getProjector(projectorId){return projectors.get(text(projectorId))??null}
 function listProjectors(){return Object.freeze(orderedProjectors([...projectors.values()]))}
 async function execute(event,context={}){
  const eventId=eventIdOf(event)
  if(!eventId)throw new Error('El evento requiere eventId o id')
  const results=[],statusByProjector=new Map();let stopAll=false
  for(const projector of orderedProjectors([...projectors.values()])){
   if(stopAll){results.push(Object.freeze({projectorId:projector.id,version:projector.version,status:'blocked',reason:'execution-stopped'}));statusByProjector.set(projector.id,'blocked');continue}
   const blockedBy=projector.dependencies.filter(id=>['failed','blocked'].includes(statusByProjector.get(id)))
   if(blockedBy.length){results.push(Object.freeze({projectorId:projector.id,version:projector.version,status:'blocked',reason:'dependency-failed',blockedBy:Object.freeze([...blockedBy])}));statusByProjector.set(projector.id,'blocked');continue}
   const key=`${eventId}:${projector.id}:${projector.version}`
   if(processed.has(key)){results.push(Object.freeze({projectorId:projector.id,version:projector.version,status:'skipped',reason:'already-processed'}));statusByProjector.set(projector.id,'succeeded');continue}
   try{
    if(!await projector.supports(event,context)){results.push(Object.freeze({projectorId:projector.id,version:projector.version,status:'skipped',reason:'unsupported'}));statusByProjector.set(projector.id,'skipped');continue}
    const run=await runProjector(projector,event,context)
    if(run.ok){processed.add(key);results.push(Object.freeze({projectorId:projector.id,version:projector.version,status:'succeeded',attempts:run.attempts,output:run.output}));statusByProjector.set(projector.id,'succeeded');continue}
    results.push(Object.freeze({projectorId:projector.id,version:projector.version,status:'failed',attempts:run.attempts,error:errorMessage(run.error)}));statusByProjector.set(projector.id,'failed')
    if(projector.policy.failStrategy==='stop-all')stopAll=true
    if(projector.policy.failStrategy==='continue')statusByProjector.set(projector.id,'continued-failure')
   }catch(error){
    results.push(Object.freeze({projectorId:projector.id,version:projector.version,status:'failed',attempts:1,error:errorMessage(error)}));statusByProjector.set(projector.id,'failed')
    if(projector.policy.failStrategy==='stop-all')stopAll=true
    if(projector.policy.failStrategy==='continue')statusByProjector.set(projector.id,'continued-failure')
   }
  }
  return Object.freeze({eventId,results:Object.freeze(results)})
 }
 function hasProcessed(eventId,projectorId,version){return processed.has(`${text(eventId)}:${text(projectorId)}:${Number(version)}`)}
 function snapshot(){return Object.freeze({projectors:listProjectors(),processed:Object.freeze([...processed].sort())})}
 return Object.freeze({registerProjector,unregisterProjector,getProjector,listProjectors,execute,hasProcessed,snapshot})
}
