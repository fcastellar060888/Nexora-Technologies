const errorText=value=>String(value?.error||value?.message||value||'Error desconocido de almacenamiento')

export function createPersistenceRuntime(){
 return Object.freeze({status:'ready',dirty:false,lastSavedAt:'',lastAttemptAt:'',lastError:'',consecutiveFailures:0,lastResult:null})
}

export function recordPersistenceResult(runtime,result,{attemptedAt=new Date().toISOString()}={}){
 const current=runtime||createPersistenceRuntime()
 if(result?.ok){
  return Object.freeze({
   status:'ready',dirty:false,lastSavedAt:attemptedAt,lastAttemptAt:attemptedAt,lastError:'',consecutiveFailures:0,lastResult:Object.freeze({...result})
  })
 }
 return Object.freeze({
  status:'error',dirty:true,lastSavedAt:current.lastSavedAt||'',lastAttemptAt:attemptedAt,lastError:errorText(result),consecutiveFailures:Number(current.consecutiveFailures||0)+1,lastResult:Object.freeze({...result,ok:false,error:errorText(result)})
 })
}
