const text=value=>String(value??'').trim()
const DETERMINISTIC_TIMESTAMP='1970-01-01T00:00:00.000Z'

function assertLedger(ledger){
 if(!ledger||typeof ledger.find!=='function')throw new Error('Se requiere un Operational Ledger con find(filters)')
}

function assertEngine(engine){
 if(!engine||typeof engine.replay!=='function')throw new Error('Se requiere un Projection Engine con replay(event, context)')
}

function sequence(value,label){
 if(value===null||value===undefined||value==='')return null
 const number=Number(value)
 if(!Number.isInteger(number)||number<0)throw new Error(`${label} debe ser un entero no negativo`)
 return number
}

function projectionTimeFor(entry){
 const candidate=entry?.recordedAt??entry?.event?.occurredAt??DETERMINISTIC_TIMESTAMP
 const parsed=Date.parse(candidate)
 if(Number.isNaN(parsed))throw new Error('La entrada del Ledger no tiene una fecha determinista válida para replay')
 return new Date(parsed).toISOString()
}

export async function replayLedger(ledger,engine,{organizationId=null,siteId=null,eventName=null,aggregateType=null,aggregateId=null,from=null,to=null,fromSequence=null,toSequence=null,limit=Number.MAX_SAFE_INTEGER,context={},onResult=null,onError=null,stopOnError=false,signal=null}={}){
 assertLedger(ledger)
 assertEngine(engine)
 if(signal!==null&&typeof signal?.aborted!=='boolean')throw new Error('signal debe ser una AbortSignal válida')
 const firstSequence=sequence(fromSequence,'fromSequence'),lastSequence=sequence(toSequence,'toSequence')
 if(firstSequence!==null&&lastSequence!==null&&firstSequence>lastSequence)throw new Error('fromSequence no puede ser mayor que toSequence')
 const max=Number(limit)
 if(!Number.isInteger(max)||max<0)throw new Error('limit debe ser un entero no negativo')
 const entries=ledger.find({organizationId:organizationId||undefined,siteId:siteId||undefined,eventName:eventName||undefined,aggregateType:aggregateType||undefined,aggregateId:aggregateId||undefined,from:from||undefined,to:to||undefined,order:'asc',limit:Number.MAX_SAFE_INTEGER})
  .filter(entry=>(firstSequence===null||entry.sequence>=firstSequence)&&(lastSequence===null||entry.sequence<=lastSequence))
  .slice(0,max)
 const notifyResult=typeof onResult==='function'?onResult:()=>{}
 const notifyError=typeof onError==='function'?onError:()=>{}
 const results=[]
 let succeeded=0,failed=0,cancelled=false
 for(const entry of entries){
  if(signal?.aborted){cancelled=true;break}
  try{
   const projectionTime=projectionTimeFor(entry)
   const replayContext=Object.freeze({...context,replay:true,projectionTime,ledgerEntry:entry,ledgerSequence:entry.sequence,recordedAt:entry.recordedAt})
   const result=await engine.replay(entry.event,replayContext)
   results.push(Object.freeze({entry,result,error:null}))
   succeeded+=1
   notifyResult(result,entry)
  }catch(error){
   const message=text(error?.message)||'Error durante replay del Ledger'
   results.push(Object.freeze({entry,result:null,error:message}))
   failed+=1
   notifyError(error,entry)
   if(stopOnError)break
  }
 }
 if(signal?.aborted&&results.length<entries.length)cancelled=true
 return Object.freeze({mode:'replay',selected:entries.length,processed:results.length,succeeded,failed,cancelled,remaining:Math.max(0,entries.length-results.length),fromSequence:entries[0]?.sequence??null,toSequence:results.at(-1)?.entry?.sequence??null,results:Object.freeze(results)})
}
