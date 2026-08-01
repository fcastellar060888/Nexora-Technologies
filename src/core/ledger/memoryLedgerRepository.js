import{createLedgerEntry,isLedgerEntry}from'./ledgerEntry.js'

const text=value=>String(value||'').toLocaleLowerCase('es')

export function createMemoryLedgerRepository({maxEntries=10000}={}){
 if(!Number.isInteger(maxEntries)||maxEntries<1)throw new Error('El límite del Ledger debe ser un entero positivo')
 const entries=[]
 const entriesById=new Map()
 const entriesBySequence=new Map()
 const listeners=new Set()
 let nextSequence=1

 function notify(entry){listeners.forEach(listener=>{try{listener(entry)}catch{/* Un consumidor no bloquea el Ledger. */}})}
 function trim(){
  if(entries.length<=maxEntries)return
  const removed=entries.splice(0,entries.length-maxEntries)
  removed.forEach(entry=>{entriesById.delete(entry.id);entriesBySequence.delete(entry.sequence)})
 }
 function append(event,options={}){
  const existing=entriesById.get(event?.eventId)
  if(existing)return existing
  const sequence=options.sequence??nextSequence
  const sequenceOwner=entriesBySequence.get(sequence)
  if(sequenceOwner)throw new Error(`La secuencia ${sequence} ya pertenece al evento ${sequenceOwner.id}`)
  const entry=createLedgerEntry(event,{...options,sequence})
  entries.push(entry)
  entries.sort((a,b)=>a.sequence-b.sequence)
  entriesById.set(entry.id,entry)
  entriesBySequence.set(entry.sequence,entry)
  nextSequence=Math.max(nextSequence,entry.sequence+1)
  trim()
  notify(entry)
  return entry
 }
 function appendMany(values=[]){return values.map(value=>isLedgerEntry(value)?append(value.event,{sequence:value.sequence,recordedAt:value.recordedAt}):append(value))}
 function find({organizationId,siteId,eventName,aggregateType,aggregateId,actorId,correlationId,from,to,search,order='desc',limit=100}={}){
  const fromTime=from?Date.parse(from):null,toTime=to?Date.parse(to):null,needle=text(search)
  return entries.filter(entry=>{
   const event=entry.event,time=Date.parse(event.occurredAt)
   return(!organizationId||event.context.organizationId===organizationId)
    &&(!siteId||event.context.siteId===siteId)
    &&(!eventName||event.name===eventName)
    &&(!aggregateType||event.aggregate.type===aggregateType)
    &&(!aggregateId||event.aggregate.id===aggregateId)
    &&(!actorId||event.context.actorId===actorId)
    &&(!correlationId||event.correlationId===correlationId)
    &&(fromTime===null||time>=fromTime)&&(toTime===null||time<=toTime)
    &&(!needle||[event.name,event.aggregate.type,event.aggregate.id,event.metadata?.actorName,event.payload?.label,event.payload?.summary].some(value=>text(value).includes(needle)))
  }).sort((a,b)=>(order==='asc'?1:-1)*(a.sequence-b.sequence)).slice(0,Math.max(0,limit))
 }
 function getByEventId(id){return entriesById.get(id)||null}
 function count(filters={}){return find({...filters,limit:Number.MAX_SAFE_INTEGER}).length}
 function subscribe(listener){if(typeof listener!=='function')throw new Error('El observador del Ledger debe ser una función');listeners.add(listener);return()=>listeners.delete(listener)}
 function clear(){entries.length=0;entriesById.clear();entriesBySequence.clear();nextSequence=1}
 function health(){return Object.freeze({status:'ready',driver:'memory',entries:entries.length,nextSequence,maxEntries})}
 return Object.freeze({append,appendMany,find,getByEventId,count,subscribe,clear,health})
}

export const operationalLedger=createMemoryLedgerRepository()
