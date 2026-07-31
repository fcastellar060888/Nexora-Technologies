import{domainEventToTimelineEntry}from'./timelineProjection.js'

const text=value=>String(value||'').toLocaleLowerCase('es')

export function createTimelineEngine({maxEntries=2000}={}){
 const entries=[]
 const listeners=new Set()
 let unsubscribe=null

 function notify(){listeners.forEach(listener=>{try{listener()}catch{/* Un observador visual no bloquea el Timeline. */}})}
 function subscribe(listener){
  if(typeof listener!=='function')throw new Error('El observador del Timeline debe ser una función')
  listeners.add(listener)
  return()=>listeners.delete(listener)
 }

 function record(entry){
  if(!entry?.id)throw new Error('La entrada del timeline requiere identificador')
  if(entries.some(item=>item.id===entry.id))return entry
  entries.push(Object.freeze({...entry}))
  entries.sort((a,b)=>Date.parse(a.occurredAt)-Date.parse(b.occurredAt))
  if(entries.length>maxEntries)entries.splice(0,entries.length-maxEntries)
  notify()
  return entry
 }

 function recordEvent(event){return record(domainEventToTimelineEntry(event))}

 function query({
  organizationId,
  siteId,
  aggregateType,
  aggregateId,
  eventName,
  category,
  actorId,
  correlationId,
  from,
  to,
  search,
  order='desc',
  limit=100
 }={}){
  const fromTime=from?Date.parse(from):null
  const toTime=to?Date.parse(to):null
  const needle=text(search)
  const result=entries.filter(entry=>{
   const time=Date.parse(entry.occurredAt)
   return(!organizationId||entry.organizationId===organizationId)
    &&(!siteId||entry.siteId===siteId)
    &&(!aggregateType||entry.aggregateType===aggregateType)
    &&(!aggregateId||entry.aggregateId===aggregateId)
    &&(!eventName||entry.eventName===eventName)
    &&(!category||entry.category===category)
    &&(!actorId||entry.actorId===actorId)
    &&(!correlationId||entry.correlationId===correlationId)
    &&(fromTime===null||time>=fromTime)
    &&(toTime===null||time<=toTime)
    &&(!needle||[entry.title,entry.summary,entry.actorName,entry.category,entry.eventName].some(value=>text(value).includes(needle)))
  })
  result.sort((a,b)=>(order==='asc'?1:-1)*(Date.parse(a.occurredAt)-Date.parse(b.occurredAt)))
  return result.slice(0,Math.max(0,limit))
 }

 function connect(bus){
  if(!bus?.subscribe)throw new Error('El Timeline requiere un Event Bus válido')
  disconnect()
  unsubscribe=bus.subscribe('*',recordEvent)
  return disconnect
 }

 function disconnect(){if(unsubscribe){unsubscribe();unsubscribe=null}}
 function clear(){if(entries.length){entries.length=0;notify()}}
 function size(){return entries.length}

 return Object.freeze({record,recordEvent,query,connect,disconnect,clear,size,subscribe})
}

export const timelineEngine=createTimelineEngine()
