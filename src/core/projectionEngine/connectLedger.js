const text=value=>String(value??'').trim()

function assertLedger(ledger){
 if(!ledger||typeof ledger.subscribe!=='function')throw new Error('Se requiere un Operational Ledger con subscribe(listener)')
}

function assertEngine(engine){
 if(!engine||typeof engine.execute!=='function')throw new Error('Se requiere un Projection Engine con execute(event, context)')
}

export function connectLedgerToProjectionEngine(ledger,engine,{context={},onResult=null,onError=null}={}){
 assertLedger(ledger)
 assertEngine(engine)
 let connected=true,pending=0,processed=0,failed=0,lastSequence=null,lastError=null
 let queue=Promise.resolve()
 const notifyResult=typeof onResult==='function'?onResult:()=>{}
 const notifyError=typeof onError==='function'?onError:()=>{}

 const unsubscribe=ledger.subscribe(entry=>{
  if(!connected)return
  pending+=1
  queue=queue.then(async()=>{
   try{
    const result=await engine.execute(entry.event,Object.freeze({...context,ledgerEntry:entry,ledgerSequence:entry.sequence,recordedAt:entry.recordedAt}))
    processed+=1
    lastSequence=entry.sequence
    lastError=null
    notifyResult(result,entry)
   }catch(error){
    failed+=1
    lastSequence=entry.sequence
    lastError=text(error?.message)||'Error de integración Ledger → Projection Engine'
    notifyError(error,entry)
   }finally{pending-=1}
  })
 })

 async function flush(){await queue;return status()}
 function disconnect(){if(!connected)return false;connected=false;unsubscribe();return true}
 function status(){return Object.freeze({connected,pending,processed,failed,lastSequence,lastError})}
 return Object.freeze({flush,disconnect,status})
}
