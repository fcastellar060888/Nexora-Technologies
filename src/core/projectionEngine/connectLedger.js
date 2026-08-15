const text=value=>String(value??'').trim()

function assertLedger(ledger){
 if(!ledger||typeof ledger.subscribe!=='function')throw new Error('Se requiere un Operational Ledger con subscribe(listener)')
}

function assertEngine(engine){
 if(!engine||typeof engine.execute!=='function')throw new Error('Se requiere un Projection Engine con execute(event, context)')
}

export function connectLedgerToProjectionEngine(ledger,engine,{context={},onResult=null,onError=null,onCallbackError=null}={}){
 assertLedger(ledger)
 assertEngine(engine)
 let connected=true,pending=0,processed=0,failed=0,callbackFailed=0,lastSequence=null,lastError=null,lastCallbackError=null
 let queue=Promise.resolve()
 const notifyResult=typeof onResult==='function'?onResult:null
 const notifyError=typeof onError==='function'?onError:null
 const notifyCallbackError=typeof onCallbackError==='function'?onCallbackError:null

 async function reportCallbackFailure(error,callback,entry){
  callbackFailed+=1
  lastCallbackError=text(error?.message)||`Error no identificado en ${callback}`
  if(!notifyCallbackError)return
  try{await notifyCallbackError(error,Object.freeze({callback,entry}))}catch{}
 }

 async function safelyNotify(callback,name,args,entry){
  if(!callback)return
  try{await callback(...args)}catch(error){await reportCallbackFailure(error,name,entry)}
 }

 async function processEntry(entry){
  try{
   const result=await engine.execute(entry.event,Object.freeze({...context,ledgerEntry:entry,ledgerSequence:entry.sequence,recordedAt:entry.recordedAt}))
   processed+=1
   lastSequence=entry.sequence
   lastError=null
   await safelyNotify(notifyResult,'onResult',[result,entry],entry)
  }catch(error){
   failed+=1
   lastSequence=entry.sequence
   lastError=text(error?.message)||'Error de integración Ledger → Projection Engine'
   await safelyNotify(notifyError,'onError',[error,entry],entry)
  }finally{pending-=1}
 }

 const unsubscribe=ledger.subscribe(entry=>{
  if(!connected)return
  pending+=1
  queue=queue.then(()=>processEntry(entry),()=>processEntry(entry))
 })

 async function flush(){await queue;return status()}
 function disconnect(){if(!connected)return false;connected=false;unsubscribe();return true}
 function status(){return Object.freeze({connected,pending,processed,failed,callbackFailed,lastSequence,lastError,lastCallbackError})}
 return Object.freeze({flush,disconnect,status})
}
