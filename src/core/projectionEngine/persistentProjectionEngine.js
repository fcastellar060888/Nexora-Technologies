import{createProjectionEngine as createVolatileProjectionEngine}from'./projectionEngine.js'
import{createProjectionCheckpointStore,isProjectionCheckpointStore}from'./projectionCheckpointStore.js'

const text=value=>String(value??'').trim()
const frozenList=value=>Object.freeze([...value])
const eventIdOf=event=>text(event?.eventId??event?.id)

function registrySignature(engine){return engine.listProjectors().map(item=>`${item.id}@${item.version}`).sort().join('|')}
function checkpointKey(engine,eventId){return `projection:${eventId}:${registrySignature(engine)}`}
function skippedResult(engine,eventId,reason){
 const results=engine.listProjectors().map(projector=>Object.freeze({projectorId:projector.id,version:projector.version,status:'skipped',reason}))
 return Object.freeze({eventId,mode:'live',executedAt:new Date().toISOString(),results:frozenList(results)})
}

export function createPersistentProjectionEngine({checkpointStore=createProjectionCheckpointStore(),...options}={}){
 if(!isProjectionCheckpointStore(checkpointStore))throw new Error('Se requiere un Projection Checkpoint Store válido')
 const engine=createVolatileProjectionEngine(options)
 async function execute(event,context={}){
  const eventId=eventIdOf(event)
  if(!eventId)throw new Error('El evento requiere eventId o id')
  const key=checkpointKey(engine,eventId)
  if(checkpointStore.has(key))return skippedResult(engine,eventId,'persistent-checkpoint')
  const claim=checkpointStore.claim(key)
  if(!claim)return skippedResult(engine,eventId,'checkpoint-claimed')
  try{
   const result=await engine.execute(event,context)
   const incomplete=result.results.some(item=>item.status==='failed'||item.status==='blocked')
   if(incomplete)checkpointStore.release(claim)
   else checkpointStore.complete(claim)
   return result
  }catch(error){checkpointStore.release(claim);throw error}
 }
 function hasProcessed(eventId,projectorId,version){
  if(engine.hasProcessed(eventId,projectorId,version))return true
  const registered=engine.getProjector(projectorId)
  if(!registered||registered.version!==Number(version))return false
  return checkpointStore.has(checkpointKey(engine,text(eventId)))
 }
 function snapshot(){const current=engine.snapshot();return Object.freeze({...current,checkpoints:checkpointStore.snapshot()})}
 return Object.freeze({...engine,execute,hasProcessed,snapshot,checkpointStore})
}

export{createProjectionCheckpointStore,isProjectionCheckpointStore}
