import{isDomainEvent}from'./eventContract.js'

export function createEventBus({onError=console.error,maxHistory=1000}={}){
 if(!Number.isInteger(maxHistory)||maxHistory<0)throw new Error('El límite de historial debe ser un entero no negativo')
 const subscriptions=new Map()
 const history=[]
 const knownEventIds=new Set()

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
  if(maxHistory===0)return
  history.push(event)
  knownEventIds.add(event.eventId)
  while(history.length>maxHistory){
   const removed=history.shift()
   if(removed)knownEventIds.delete(removed.eventId)
  }
 }

 async function publish(event){
  if(!isDomainEvent(event))throw new Error('No se puede publicar un evento inválido')
  if(knownEventIds.has(event.eventId))return{event,delivered:0,failed:0,duplicate:true}
  remember(event)
  const handlers=[...(subscriptions.get(event.name)||[]),...(subscriptions.get('*')||[])]
  const results=await Promise.allSettled(handlers.map(handler=>Promise.resolve().then(()=>handler(event))))
  results.forEach(result=>{if(result.status==='rejected')onError(result.reason,event)})
  return{event,delivered:handlers.length,failed:results.filter(x=>x.status==='rejected').length,duplicate:false}
 }

 function clear(){subscriptions.clear();history.length=0;knownEventIds.clear()}
 function getHistory({name,aggregateId,limit=100}={}){
  const safeLimit=Number.isFinite(Number(limit))?Math.max(0,Math.trunc(Number(limit))):100
  return history.filter(event=>(!name||event.name===name)&&(!aggregateId||event.aggregate.id===aggregateId)).slice(-safeLimit)
 }

 return Object.freeze({subscribe,publish,getHistory,clear})
}

export const eventBus=createEventBus()
