import{isDomainEvent}from'./eventContract.js'

const errorText=error=>String(error?.message||error||'Error de suscriptor no identificado')
const fingerprint=event=>JSON.stringify(event)

export function createEventBus({onError=console.error,maxHistory=1000}={}){
 if(!Number.isInteger(maxHistory)||maxHistory<0)throw new Error('El límite de historial debe ser un entero no negativo')
 if(typeof onError!=='function')throw new Error('onError debe ser una función')
 const subscriptions=new Map()
 const history=[]
 const completedEvents=new Map()
 const pendingFailures=new Map()
 const inFlight=new Map()
 const activeDeliveries=new Set()

 function subscribe(eventName,handler){
  if(typeof handler!=='function')throw new Error('El suscriptor debe ser una función')
  const key=String(eventName||'').trim()
  if(!key)throw new Error('El nombre del evento es obligatorio')
  const handlers=subscriptions.get(key)||new Set()
  handlers.add(handler)
  subscriptions.set(key,handlers)
  return()=>{handlers.delete(handler);if(!handlers.size)subscriptions.delete(key)}
 }

 function remember(event){
  completedEvents.set(event.eventId,fingerprint(event))
  if(maxHistory===0)return
  history.push(event)
  while(history.length>maxHistory)history.shift()
 }

 function assertSameIdentity(event,storedFingerprint){
  if(storedFingerprint!==fingerprint(event))throw new Error(`El eventId ${event.eventId} ya existe con un contenido diferente`)
 }
 function duplicateResult(event,{inFlight=false}={}){return Object.freeze({event,delivered:0,failed:0,duplicate:true,inFlight,retry:false,pending:false,errors:Object.freeze([])})}
 function handlersFor(event){return[...(subscriptions.get(event.name)||[]),...(subscriptions.get('*')||[])]}
 function report(error,event){try{onError(error,event)}catch{/* La telemetría no altera la entrega ni el reintento. */}}

 async function deliver(event,handlers,{retry=false}={}){
  let results
  activeDeliveries.add(event.eventId)
  try{results=await Promise.allSettled(handlers.map(handler=>Promise.resolve().then(()=>handler(event))))}
  finally{activeDeliveries.delete(event.eventId)}
  const failedHandlers=[]
  results.forEach((result,index)=>{
   if(result.status==='rejected'){
    failedHandlers.push(handlers[index])
    report(result.reason,event)
   }
  })
  if(failedHandlers.length){
   pendingFailures.set(event.eventId,Object.freeze({event,handlers:Object.freeze(failedHandlers),fingerprint:fingerprint(event)}))
  }else{
   pendingFailures.delete(event.eventId)
   remember(event)
  }
  return Object.freeze({event,delivered:handlers.length,failed:failedHandlers.length,duplicate:false,retry,pending:failedHandlers.length>0,errors:Object.freeze(results.filter(result=>result.status==='rejected').map(result=>errorText(result.reason)))})
 }

 async function publish(event){
  if(!isDomainEvent(event))throw new Error('No se puede publicar un evento inválido')
  const completedFingerprint=completedEvents.get(event.eventId)
  if(completedFingerprint){assertSameIdentity(event,completedFingerprint);return duplicateResult(event)}
  const active=inFlight.get(event.eventId)
  if(active){
   assertSameIdentity(event,active.fingerprint)
   if(activeDeliveries.has(event.eventId))return duplicateResult(event,{inFlight:true})
   return active.promise
  }
  const pending=pendingFailures.get(event.eventId)
  if(pending)assertSameIdentity(event,pending.fingerprint)
  const handlers=pending?[...pending.handlers]:handlersFor(event)
  const execution=deliver(event,handlers,{retry:Boolean(pending)}).finally(()=>inFlight.delete(event.eventId))
  inFlight.set(event.eventId,{fingerprint:fingerprint(event),promise:execution})
  return execution
 }

 function clear(){subscriptions.clear();history.length=0;completedEvents.clear();pendingFailures.clear();inFlight.clear();activeDeliveries.clear()}
 function getHistory({name,aggregateId,limit=100}={}){
  const safeLimit=Number.isFinite(Number(limit))?Math.max(0,Math.trunc(Number(limit))):100
  return history.filter(event=>(!name||event.name===name)&&(!aggregateId||event.aggregate.id===aggregateId)).slice(-safeLimit)
 }
 function getPendingFailures(){return Object.freeze([...pendingFailures.values()].map(item=>Object.freeze({event:item.event,failedHandlers:item.handlers.length})))}

 return Object.freeze({subscribe,publish,getHistory,getPendingFailures,clear})
}

export const eventBus=createEventBus()
