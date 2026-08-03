import{isProjector}from'./projectorContract.js'

const text=value=>String(value??'').trim()
const eventIdOf=event=>text(event?.eventId??event?.id)
const errorMessage=error=>text(error?.message)||'Error de proyección no identificado'
const sleep=ms=>ms>0?new Promise(resolve=>setTimeout(resolve,ms)):Promise.resolve()
const frozenList=value=>Object.freeze([...value])

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

function timeoutError(timeoutMs){const error=new Error(`Tiempo de espera agotado después de ${timeoutMs} ms`);error.name='ProjectionTimeoutError';return error}

function createExecutionLease(timeoutMs){
 const controller=new AbortController();let active=true,timer=null
 const assertActive=()=>{if(!active||controller.signal.aborted)throw controller.signal.reason instanceof Error?controller.signal.reason:new Error('La ejecución del proyector ya no está activa');return true}
 const commit=effect=>{if(typeof effect!=='function')throw new Error('commit requiere una función de efecto');assertActive();return effect()}
 const abort=reason=>{if(!active)return false;active=false;if(timer!==null)clearTimeout(timer);controller.abort(reason);return true}
 const complete=()=>{if(!active)return false;active=false;if(timer!==null)clearTimeout(timer);return true}
 const timeoutPromise=timeoutMs?new Promise((_,reject)=>{timer=setTimeout(()=>{const error=timeoutError(timeoutMs);abort(error);reject(error)},timeoutMs)}):null
 return Object.freeze({signal:controller.signal,assertActive,commit,abort,complete,timeoutPromise})
}

async function runProjector(projector,event,context){
 let lastError=null
 for(let attempt=1;attempt<=projector.policy.maxAttempts;attempt++){
  const lease=createExecutionLease(projector.policy.timeoutMs)
  const attemptContext=Object.freeze({...context,projectorId:projector.id,projectorVersion:projector.version,attempt,signal:lease.signal,assertActive:lease.assertActive,commit:lease.commit})
  try{
   const projection=Promise.resolve().then(()=>projector.project(event,attemptContext))
   const output=lease.timeoutPromise?await Promise.race([projection,lease.timeoutPromise]):await projection
   lease.assertActive();lease.complete();return {ok:true,output,attempts:attempt}
  }catch(error){lastError=error;lease.abort(error);if(attempt<projector.policy.maxAttempts)await sleep(projector.policy.retryDelayMs)}
 }
 return {ok:false,error:lastError,attempts:projector.policy.maxAttempts}
}

function emptyMetrics(projector){return {projectorId:projector.id,version:projector.version,processed:0,succeeded:0,failed:0,blocked:0,skipped:0,retried:0,timedOut:0,totalDurationMs:0,avgDurationMs:0,maxDurationMs:0,lastExecution:null,lastSuccess:null,lastFailure:null}}

export function createProjectionEngine({historyLimit=1000,now=()=>Date.now()}={}){
 if(!Number.isInteger(Number(historyLimit))||Number(historyLimit)<1)throw new Error('historyLimit debe ser un entero positivo')
 if(typeof now!=='function')throw new Error('now debe ser una función')
 const projectors=new Map(),processed=new Set(),history=[],metrics=new Map();let executionSequence=0
 const timestamp=()=>new Date(now()).toISOString()
 function registerProjector(projector){
  if(!isProjector(projector))throw new Error('Se requiere un proyector válido')
  const existing=projectors.get(projector.id)
  if(existing&&existing!==projector)throw new Error(`El proyector ${projector.id} ya está registrado`)
  const candidate=new Map(projectors);candidate.set(projector.id,projector);orderedProjectors([...candidate.values()]);projectors.set(projector.id,projector)
  if(!metrics.has(projector.id))metrics.set(projector.id,emptyMetrics(projector))
  return projector
 }
 function unregisterProjector(projectorId){
  const id=text(projectorId)
  if(!projectors.has(id))return false
  const dependents=[...projectors.values()].filter(projector=>projector.dependencies.includes(id)).map(projector=>projector.id).sort()
  if(dependents.length)throw new Error(`${id} todavía es requerido por: ${dependents.join(', ')}`)
  return projectors.delete(id)
 }
 function getProjector(projectorId){return projectors.get(text(projectorId))??null}
 function listProjectors(){return frozenList(orderedProjectors([...projectors.values()]))}
 function record(eventId,projector,result,startedMs,finishedMs,mode){
  const durationMs=Math.max(0,finishedMs-startedMs),startedAt=new Date(startedMs).toISOString(),finishedAt=new Date(finishedMs).toISOString()
  executionSequence+=1
  const execution=Object.freeze({executionId:`${eventId}:${projector.id}:${projector.version}:${executionSequence}`,eventId,projectorId:projector.id,projectorVersion:projector.version,mode,startedAt,finishedAt,durationMs,attempts:result.attempts??0,status:result.status,reason:result.reason??null,error:result.error??null,blockedBy:result.blockedBy??Object.freeze([]),failStrategy:projector.policy.failStrategy,timeoutMs:projector.policy.timeoutMs,timedOut:Boolean(result.error?.startsWith('Tiempo de espera agotado'))})
  history.push(execution);if(history.length>Number(historyLimit))history.splice(0,history.length-Number(historyLimit))
  const current=metrics.get(projector.id)??emptyMetrics(projector),next={...current,processed:current.processed+1,totalDurationMs:current.totalDurationMs+durationMs,maxDurationMs:Math.max(current.maxDurationMs,durationMs),lastExecution:finishedAt}
  if(result.status==='succeeded'){next.succeeded++;next.lastSuccess=finishedAt}else if(result.status==='failed'){next.failed++;next.lastFailure=finishedAt}else if(result.status==='blocked')next.blocked++;else if(result.status==='skipped')next.skipped++
  if((result.attempts??0)>1)next.retried+=result.attempts-1
  if(execution.timedOut)next.timedOut++
  next.avgDurationMs=next.processed?next.totalDurationMs/next.processed:0;metrics.set(projector.id,next)
 }
 async function run(event,context,mode){
  const eventId=eventIdOf(event);if(!eventId)throw new Error('El evento requiere eventId o id')
  const replayMode=mode==='replay',results=[],statusByProjector=new Map();let stopAll=false
  const executionContext=Object.freeze({...context,projectionMode:mode})
  for(const projector of orderedProjectors([...projectors.values()])){
   const startedMs=now();let result
   if(stopAll){result=Object.freeze({projectorId:projector.id,version:projector.version,status:'blocked',reason:'execution-stopped'});statusByProjector.set(projector.id,'blocked')}
   else{
    const blockedBy=projector.dependencies.filter(id=>['failed','blocked'].includes(statusByProjector.get(id)))
    if(blockedBy.length){result=Object.freeze({projectorId:projector.id,version:projector.version,status:'blocked',reason:'dependency-failed',blockedBy:frozenList(blockedBy)});statusByProjector.set(projector.id,'blocked')}
    else{
     const key=`${eventId}:${projector.id}:${projector.version}`
     if(!replayMode&&processed.has(key)){result=Object.freeze({projectorId:projector.id,version:projector.version,status:'skipped',reason:'already-processed'});statusByProjector.set(projector.id,'succeeded')}
     else try{
      if(!await projector.supports(event,executionContext)){result=Object.freeze({projectorId:projector.id,version:projector.version,status:'skipped',reason:'unsupported'});statusByProjector.set(projector.id,'skipped')}
      else{
       const execution=await runProjector(projector,event,executionContext)
       if(execution.ok){if(!replayMode)processed.add(key);result=Object.freeze({projectorId:projector.id,version:projector.version,status:'succeeded',attempts:execution.attempts,output:execution.output});statusByProjector.set(projector.id,'succeeded')}
       else{result=Object.freeze({projectorId:projector.id,version:projector.version,status:'failed',attempts:execution.attempts,error:errorMessage(execution.error)});statusByProjector.set(projector.id,'failed');if(projector.policy.failStrategy==='stop-all')stopAll=true;if(projector.policy.failStrategy==='continue')statusByProjector.set(projector.id,'continued-failure')}
      }
     }catch(error){result=Object.freeze({projectorId:projector.id,version:projector.version,status:'failed',attempts:1,error:errorMessage(error)});statusByProjector.set(projector.id,'failed');if(projector.policy.failStrategy==='stop-all')stopAll=true;if(projector.policy.failStrategy==='continue')statusByProjector.set(projector.id,'continued-failure')}
    }
   }
   results.push(result);record(eventId,projector,result,startedMs,now(),mode)
  }
  return Object.freeze({eventId,mode,executedAt:timestamp(),results:frozenList(results)})
 }
 const execute=(event,context={})=>run(event,context,'live'),replay=(event,context={})=>run(event,context,'replay')
 function hasProcessed(eventId,projectorId,version){return processed.has(`${text(eventId)}:${text(projectorId)}:${Number(version)}`)}
 function getHistory({projectorId=null,eventId=null,mode=null,limit=historyLimit}={}){return frozenList(history.filter(item=>(!projectorId||item.projectorId===text(projectorId))&&(!eventId||item.eventId===text(eventId))&&(!mode||item.mode===text(mode))).slice(-Math.max(0,Number(limit)||0)))}
 function getMetrics(projectorId=null){if(projectorId){const item=metrics.get(text(projectorId));return item?Object.freeze({...item}):null}return frozenList([...metrics.values()].map(item=>Object.freeze({...item})).sort((a,b)=>a.projectorId.localeCompare(b.projectorId)))}
 function health(){const all=[...metrics.values()],totals=all.reduce((sum,item)=>({processed:sum.processed+item.processed,failed:sum.failed+item.failed,blocked:sum.blocked+item.blocked,timedOut:sum.timedOut+item.timedOut}),{processed:0,failed:0,blocked:0,timedOut:0});const failureRate=totals.processed?totals.failed/totals.processed:0,status=failureRate>=.5||totals.timedOut>=3?'critical':totals.failed||totals.blocked||totals.timedOut?'degraded':'healthy';return Object.freeze({status,failureRate,totals:Object.freeze(totals),projectors:getMetrics(),historySize:history.length,historyLimit:Number(historyLimit)})}
 function snapshot(){return Object.freeze({projectors:listProjectors(),processed:frozenList([...processed].sort()),history:getHistory(),metrics:getMetrics(),health:health(),executionSequence})}
 return Object.freeze({registerProjector,unregisterProjector,getProjector,listProjectors,execute,replay,hasProcessed,getHistory,getMetrics,health,snapshot})
}
