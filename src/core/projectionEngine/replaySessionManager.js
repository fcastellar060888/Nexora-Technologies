import{replayLedger}from'./replayLedger.js'

const text=value=>String(value??'').trim()
const terminal=new Set(['completed','cancelled','failed'])
const freeze=value=>Object.freeze({...value})

export function createReplaySessionManager(ledger,engine,{now=()=>Date.now(),idFactory=()=>crypto.randomUUID()}={}){
 if(!ledger||typeof ledger.find!=='function')throw new Error('Se requiere un Operational Ledger válido')
 if(!engine||typeof engine.replay!=='function')throw new Error('Se requiere un Projection Engine válido')
 if(typeof now!=='function')throw new Error('now debe ser una función')
 if(typeof idFactory!=='function')throw new Error('idFactory debe ser una función')
 const sessions=new Map()
 const timestamp=()=>new Date(now()).toISOString()
 const snapshot=session=>freeze({sessionId:session.sessionId,status:session.status,createdAt:session.createdAt,startedAt:session.startedAt,finishedAt:session.finishedAt,selected:session.selected,processed:session.processed,succeeded:session.succeeded,failed:session.failed,remaining:session.remaining,lastSequence:session.lastSequence,error:session.error,filters:session.filters})

 function getSession(sessionId){const session=sessions.get(text(sessionId));return session?snapshot(session):null}
 function listSessions(){return Object.freeze([...sessions.values()].map(snapshot).sort((a,b)=>a.createdAt.localeCompare(b.createdAt)))}
 function cancelSession(sessionId){
  const session=sessions.get(text(sessionId))
  if(!session||terminal.has(session.status)||session.controller.signal.aborted)return false
  session.status='cancelling'
  session.controller.abort()
  return true
 }
 function start(options={}){
  const sessionId=text(idFactory())
  if(!sessionId)throw new Error('La sesión de replay requiere un identificador')
  if(sessions.has(sessionId))throw new Error(`La sesión ${sessionId} ya existe`)
  const controller=new AbortController(),createdAt=timestamp()
  const userOnResult=typeof options.onResult==='function'?options.onResult:()=>{}
  const userOnError=typeof options.onError==='function'?options.onError:()=>{}
  const filters=freeze({organizationId:options.organizationId??null,siteId:options.siteId??null,eventName:options.eventName??null,aggregateType:options.aggregateType??null,aggregateId:options.aggregateId??null,from:options.from??null,to:options.to??null,fromSequence:options.fromSequence??null,toSequence:options.toSequence??null,limit:options.limit??Number.MAX_SAFE_INTEGER})
  const session={sessionId,status:'pending',createdAt,startedAt:null,finishedAt:null,selected:null,processed:0,succeeded:0,failed:0,remaining:null,lastSequence:null,error:null,filters,controller,completion:null}
  sessions.set(sessionId,session)
  session.completion=(async()=>{
   session.status='running';session.startedAt=timestamp()
   try{
    const report=await replayLedger(ledger,engine,{...options,signal:controller.signal,context:{...(options.context??{}),replaySessionId:sessionId},onResult:(result,entry)=>{session.processed+=1;session.succeeded+=1;session.lastSequence=entry.sequence;userOnResult(result,entry,snapshot(session))},onError:(error,entry)=>{session.processed+=1;session.failed+=1;session.lastSequence=entry.sequence;userOnError(error,entry,snapshot(session))}})
    session.selected=report.selected;session.processed=report.processed;session.succeeded=report.succeeded;session.failed=report.failed;session.remaining=report.remaining;session.lastSequence=report.toSequence
    session.status=report.cancelled?'cancelled':'completed';session.finishedAt=timestamp()
    return freeze({...snapshot(session),report})
   }catch(error){
    session.status='failed';session.error=text(error?.message)||'Error de sesión de replay';session.finishedAt=timestamp()
    throw error
   }
  })()
  return Object.freeze({sessionId,completion:session.completion,cancel:()=>cancelSession(sessionId),status:()=>getSession(sessionId)})
 }
 return Object.freeze({start,getSession,listSessions,cancelSession})
}
