import{domainEventToTimelineEntry}from'./timelineProjection.js'
import{timelineEntryFingerprint}from'./timelineSnapshot.js'

const text=value=>String(value||'').toLocaleLowerCase('es')
const required=value=>String(value||'').trim()
const SOURCE_AUTHORITY={'event-bus':1,'operational-ledger':2}

function isTimelineEntry(entry){
 return Boolean(entry
  &&required(entry.id)
  &&required(entry.eventName)
  &&required(entry.occurredAt)
  &&!Number.isNaN(Date.parse(entry.occurredAt))
  &&required(entry.organizationId)
  &&required(entry.aggregateType)
  &&required(entry.aggregateId)
  &&(entry.sequence===null||entry.sequence===undefined||(Number.isInteger(entry.sequence)&&entry.sequence>=0))
  &&(entry.recordedAt===null||entry.recordedAt===undefined||(required(entry.recordedAt)&&!Number.isNaN(Date.parse(entry.recordedAt)))))
}

function compareEntries(a,b){
 const time=Date.parse(a.occurredAt)-Date.parse(b.occurredAt)
 if(time)return time
 const left=Number.isInteger(a.sequence)?a.sequence:Number.MAX_SAFE_INTEGER
 const right=Number.isInteger(b.sequence)?b.sequence:Number.MAX_SAFE_INTEGER
 if(left!==right)return left-right
 return String(a.id).localeCompare(String(b.id))
}

function compareRetention(a,b){
 const leftSequence=Number.isInteger(a.sequence)?a.sequence:null
 const rightSequence=Number.isInteger(b.sequence)?b.sequence:null
 if(leftSequence!==null&&rightSequence!==null&&leftSequence!==rightSequence)return leftSequence-rightSequence
 if(leftSequence!==null&&rightSequence===null)return 1
 if(leftSequence===null&&rightSequence!==null)return-1
 const leftRecorded=a.recordedAt?Date.parse(a.recordedAt):null
 const rightRecorded=b.recordedAt?Date.parse(b.recordedAt):null
 if(leftRecorded!==null&&rightRecorded!==null&&leftRecorded!==rightRecorded)return leftRecorded-rightRecorded
 if(leftRecorded!==null&&rightRecorded===null)return 1
 if(leftRecorded===null&&rightRecorded!==null)return-1
 const occurred=Date.parse(a.occurredAt)-Date.parse(b.occurredAt)
 if(occurred)return occurred
 return String(a.id).localeCompare(String(b.id))
}

function assertSameEventIdentity(existing,incoming){
 const fields=['eventName','organizationId','aggregateType','aggregateId','occurredAt']
 for(const field of fields){
  if(existing[field]!==incoming[field])throw new Error(`El evento ${incoming.id} contradice su identidad canónica en ${field}`)
 }
}

function authority(entry){
 return SOURCE_AUTHORITY[entry.source]||0
}

function reconcileEntry(existing,incoming){
 assertSameEventIdentity(existing,incoming)
 if(timelineEntryFingerprint(existing)===timelineEntryFingerprint(incoming))return existing
 const existingAuthority=authority(existing)
 const incomingAuthority=authority(incoming)
 if(incomingAuthority<existingAuthority)return existing
 if(incomingAuthority>existingAuthority)return incoming
 const existingSequence=Number.isInteger(existing.sequence)?existing.sequence:-1
 const incomingSequence=Number.isInteger(incoming.sequence)?incoming.sequence:-1
 if(incomingSequence<existingSequence)return existing
 if(incomingSequence>existingSequence)return incoming
 const existingRecorded=existing.recordedAt?Date.parse(existing.recordedAt):-1
 const incomingRecorded=incoming.recordedAt?Date.parse(incoming.recordedAt):-1
 if(incomingRecorded<existingRecorded)return existing
 return incoming
}

export function createTimelineEngine({maxEntries=2000}={}){
 if(!Number.isInteger(maxEntries)||maxEntries<1)throw new Error('El límite del Timeline debe ser un entero positivo')
 const entries=[]
 const entriesById=new Map()
 const listeners=new Set()
 let unsubscribe=null
 let version=0

 function notify(){version+=1;listeners.forEach(listener=>{try{listener()}catch{/* Un observador visual no bloquea el Timeline. */}})}
 function subscribe(listener){
  if(typeof listener!=='function')throw new Error('El observador del Timeline debe ser una función')
  listeners.add(listener)
  return()=>listeners.delete(listener)
 }
 function trim(){
  if(entries.length<=maxEntries)return
  const retainedIds=new Set([...entries].sort(compareRetention).slice(-maxEntries).map(entry=>entry.id))
  for(let index=entries.length-1;index>=0;index-=1){
   if(retainedIds.has(entries[index].id))continue
   entriesById.delete(entries[index].id)
   entries.splice(index,1)
  }
 }
 function normalize(entry){
  if(!isTimelineEntry(entry))throw new Error('La entrada del Timeline no cumple el contrato requerido')
  return Object.freeze({...entry})
 }
 function insert(entry,{silent=false}={}){
  const normalized=normalize(entry)
  const existing=entriesById.get(normalized.id)
  if(existing){
   const reconciled=reconcileEntry(existing,normalized)
   if(reconciled===existing)return existing
   const index=entries.indexOf(existing)
   entries[index]=reconciled
   entriesById.set(reconciled.id,reconciled)
   entries.sort(compareEntries)
   if(!silent)notify()
   return reconciled
  }
  entries.push(normalized)
  entriesById.set(normalized.id,normalized)
  trim()
  entries.sort(compareEntries)
  if(!silent)notify()
  return normalized
 }
 function record(entry,options={}){return insert(entry,options)}
 function hydrate(persisted=[]){
  const incoming=Array.isArray(persisted)?persisted:[]
  const nextById=new Map()
  for(const raw of incoming){
   const entry=normalize(raw)
   const existing=nextById.get(entry.id)
   nextById.set(entry.id,existing?reconcileEntry(existing,entry):entry)
  }
  const retained=[...nextById.values()].sort(compareRetention).slice(-maxEntries).sort(compareEntries)
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
 function getVersion(){return version}
 function getById(id){return entriesById.get(id)||null}
 function health(){return Object.freeze({status:'ready',entries:entries.length,maxEntries,connected:Boolean(unsubscribe),version})}

 return Object.freeze({record,recordEvent,hydrate,query,connect,disconnect,clear,size,getVersion,getById,health,subscribe})
}

const scopedTimelines=new Map()
function scopePart(value,label){const normalized=String(value??'').trim();if(!normalized)throw new Error(`${label} es obligatorio para resolver el runtime`);return normalized}
export function timelineRuntimeKey({organizationId,actorId='system'}={}){return`${scopePart(organizationId,'La empresa')}::${scopePart(actorId,'El actor')}`}
export function getTimelineEngineForScope(scope){
 const key=timelineRuntimeKey(scope)
 if(!scopedTimelines.has(key))scopedTimelines.set(key,createTimelineEngine())
 return scopedTimelines.get(key)
}
export function releaseTimelineScope(scope){
 const key=timelineRuntimeKey(scope),timeline=scopedTimelines.get(key)
 if(!timeline)return false
 timeline.disconnect();timeline.clear();scopedTimelines.delete(key);return true
}
export function timelineScopeCount(){return scopedTimelines.size}

export const timelineEngine=getTimelineEngineForScope({organizationId:'local-installation',actorId:'system'})