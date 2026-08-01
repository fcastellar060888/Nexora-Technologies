import{domainEventToTimelineEntry}from'./timelineProjection.js'

const text=value=>String(value||'').toLocaleLowerCase('es')
const required=value=>String(value||'').trim()

function isTimelineEntry(entry){
 return Boolean(entry
  &&required(entry.id)
  &&required(entry.eventName)
  &&required(entry.occurredAt)
  &&!Number.isNaN(Date.parse(entry.occurredAt))
  &&required(entry.organizationId)
  &&required(entry.aggregateType)
  &&required(entry.aggregateId)
  &&(entry.sequence===null||entry.sequence===undefined||(Number.isInteger(entry.sequence)&&entry.sequence>=0)))
}

function compareEntries(a,b){
 const time=Date.parse(a.occurredAt)-Date.parse(b.occurredAt)
 if(time)return time
 const left=Number.isInteger(a.sequence)?a.sequence:Number.MAX_SAFE_INTEGER
 const right=Number.isInteger(b.sequence)?b.sequence:Number.MAX_SAFE_INTEGER
 if(left!==right)return left-right
 return String(a.id).localeCompare(String(b.id))
}

export function createTimelineEngine({maxEntries=2000}={}){
 if(!Number.isInteger(maxEntries)||maxEntries<1)throw new Error('El límite del Timeline debe ser un entero positivo')
 const entries=[]
 const entriesById=new Map()
 const listeners=new Set()
 let unsubscribe=null

 function notify(){listeners.forEach(listener=>{try{listener()}catch{/* Un observador visual no bloquea el Timeline. */}})}
 function subscribe(listener){
  if(typeof listener!=='function')throw new Error('El observador del Timeline debe ser una función')
  listeners.add(listener)
  return()=>listeners.delete(listener)
 }
 function trim(){
  if(entries.length<=maxEntries)return
  const removed=entries.splice(0,entries.length-maxEntries)
  removed.forEach(entry=>entriesById.delete(entry.id))
 }
 function normalize(entry){
  if(!isTimelineEntry(entry))throw new Error('La entrada del Timeline no cumple el contrato requerido')
  return Object.freeze({...entry})
 }
 function insert(entry,{silent=false}={}){
  const normalized=normalize(entry)
  const existing=entriesById.get(normalized.id)
  if(existing)return existing
  entries.push(normalized)
  entries.sort(compareEntries)
  entriesById.set(normalized.id,normalized)
  trim()
  if(!silent)notify()
  return normalized
 }
 function record(entry,options={}){return insert(entry,options)}
 function hydrate(persisted=[]){
  const incoming=Array.isArray(persisted)?persisted:[]
  const next=[]
  const nextById=new Map()
  for(const raw of incoming){
   const entry=normalize(raw)
   if(nextById.has(entry.id))continue
   next.push(entry)
   nextById.set(entry.id,entry)
  }
  next.sort(compareEntries)
  const retained=next.slice(-maxEntries)
  entries.length=0
  entries.push(...retained)
  entriesById.clear()
  retained.forEach(entry=>entriesById.set(entry.id,entry))
  notify()
  return entries.length
 }
 function recordEvent(event){return record(domainEventToTimelineEntry(event))}
 function query({organizationId,siteId,aggregateType,aggregateId,eventName,category,actorId,correlationId,from,to,search,order='desc',limit=100}={}){
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
  result.sort((a,b)=>(order==='asc'?1:-1)*compareEntries(a,b))
  return result.slice(0,Math.max(0,limit))
 }
 function connect(bus){
  if(!bus?.subscribe)throw new Error('El Timeline requiere un Event Bus válido')
  disconnect()
  unsubscribe=bus.subscribe('*',recordEvent)
  return disconnect
 }
 function disconnect(){if(unsubscribe){unsubscribe();unsubscribe=null}}
 function clear(){if(entries.length){entries.length=0;entriesById.clear();notify()}}
 function size(){return entries.length}
 function getById(id){return entriesById.get(id)||null}
 function health(){return Object.freeze({status:'ready',entries:entries.length,maxEntries,connected:Boolean(unsubscribe)})}

 return Object.freeze({record,recordEvent,hydrate,query,connect,disconnect,clear,size,getById,health,subscribe})
}

export const timelineEngine=createTimelineEngine()
