import{createProjectionEngine as createVolatileProjectionEngine}from'./projectionEngine.js'
import{createProjectionCheckpointStore,isProjectionCheckpointStore}from'./projectionCheckpointStore.js'

const text=value=>String(value??'').trim()
const frozenList=value=>Object.freeze([...value])
const eventIdOf=event=>text(event?.eventId??event?.id)

function registrySignature(engine){return engine.listProjectors().map(item=>`${item.id}@${item.version}`).sort().join('|')}
function checkpointKey(engine,eventId){return `projection:${eventId}:${registrySignature(engine)}`}
function projectorCheckpointKey(eventId,projectorId,version){return `projector:${text(eventId)}:${text(projectorId)}@${Number(version)}`}
function skippedResult(engine,eventId,reason){
 const results=engine.listProjectors().map(projector=>Object.freeze({projectorId:projector.id,version:projector.version,status:'skipped',reason}))
 return Object.freeze({eventId,mode:'live',executedAt:new Date().toISOString(),results:frozenList(results)})
}
function confirm(store,key){
 const claim=store.claim(key)
 if(!claim)return
 try{store.complete(claim)}catch(error){store.release(claim);throw error}
}

export function createPersistentProjectionEngine({checkpointStore,...options}={}){
 if(checkpointStore===undefined)throw new Error('El Projection Engine persistente requiere checkpointStore explícito; usa createVolatileProjectionEngine solo para pruebas o diagnóstico')
 if(!isProjectionCheckpointStore(checkpointStore))throw new Error('Se requiere un Projection Checkpoint Store válido')
 const engine=createVolatileProjectionEngine(options)
 async function execute(event,context={}){
  const eventId=eventIdOf(event)
  if(!eventId)throw new Error('El evento requiere eventId o id')
  const key=checkpointKey(engine,eventId)
  const locallyProcessed=engine.listProjectors().some(projector=>engine.hasProcessed(eventId,projector.id,projector.version))
  if(checkpointStore.has(key))return locallyProcessed?engine.execute(event,context):skippedResult(engine,eventId,'persistent-checkpoint')
  const claim=checkpointStore.claim(key)
  if(!claim)return skippedResult(engine,eventId,'checkpoint-claimed')
  try{
   const result=await engine.execute(event,context)
   const incomplete=result.results.some(item=>item.status==='failed'||item.status==='blocked')
   if(incomplete)checkpointStore.release(claim)
   else{
    for(const item of result.results)if(item.status==='succeeded'||item.reason==='already-processed')confirm(checkpointStore,projectorCheckpointKey(eventId,item.projectorId,item.version))
    checkpointStore.complete(claim)
   }
   return result
  }catch(error){checkpointStore.release(claim);throw error}
 }
 function hasProcessed(eventId,projectorId,version){
  if(engine.hasProcessed(eventId,projectorId,version))return true
  const registered=engine.getProjector(projectorId)
  if(!registered||registered.version!==Number(version))return false
  return checkpointStore.has(projectorCheckpointKey(eventId,projectorId,version))
 }
 function snapshot(){const current=engine.snapshot();return Object.freeze({...current,checkpoints:checkpointStore.snapshot()})}
 return Object.freeze({...engine,execute,hasProcessed,snapshot,checkpointStore})
}

export{createProjectionCheckpointStore,isProjectionCheckpointStore}
