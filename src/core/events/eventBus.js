import{isDomainEvent}from'./eventContract.js'

export function createEventBus({onError=console.error}={}){
 const subscriptions=new Map()
 const history=[]

 function subscribe(eventName,handler){
  if(typeof handler!=='function')throw new Error('El suscriptor debe ser una función')
  const key=String(eventName||'').trim()
  if(!key)throw new Error('El nombre del evento es obligatorio')
  const handlers=subscriptions.get(key)||new Set()
  handlers.add(handler)
  subscriptions.set(key,handlers)
  return()=>{handlers.delete(handler);if(!handlers.size)subscriptions.delete(key)}
 }

 async function publish(event){
  if(!isDomainEvent(event))throw new Error('No se puede publicar un evento inválido')
  history.push(event)
  const handlers=[...(subscriptions.get(event.name)||[]),...(subscriptions.get('*')||[])]
  const results=await Promise.allSettled(handlers.map(handler=>Promise.resolve().then(()=>handler(event))))
  results.forEach(result=>{if(result.status==='rejected')onError(result.reason,event)})
  return{event,delivered:handlers.length,failed:results.filter(x=>x.status==='rejected').length}
 }

 function clear(){subscriptions.clear();history.length=0}
 function getHistory({name,aggregateId,limit=100}={}){
  return history.filter(event=>(!name||event.name===name)&&(!aggregateId||event.aggregate.id===aggregateId)).slice(-Math.max(0,limit))
 }

 return Object.freeze({subscribe,publish,getHistory,clear})
}

export const eventBus=createEventBus()
