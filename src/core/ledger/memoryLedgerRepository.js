import{createLedgerEntry,isLedgerEntry}from'./ledgerEntry.js'

const text=value=>String(value||'').toLocaleLowerCase('es')
const errorText=error=>String(error?.message||error||'Error de listener no identificado')
const fingerprint=event=>JSON.stringify(event)

export function createMemoryLedgerRepository({maxEntries=10000,errorHistoryLimit=100,onListenerError=null}={}){
 if(!Number.isInteger(maxEntries)||maxEntries<1)throw new Error('El límite del Ledger debe ser un entero positivo')
 if(!Number.isInteger(errorHistoryLimit)||errorHistoryLimit<1)throw new Error('El límite de errores del Ledger debe ser un entero positivo')
 if(onListenerError!==null&&typeof onListenerError!=='function')throw new Error('onListenerError debe ser una función')
 const entries=[]
 const entriesById=new Map()
 const entriesBySequence=new Map()
 const listeners=new Set()
 const listenerErrors=[]
 let nextSequence=1
 let listenerFailureCount=0

 function assertSameIdentity(existing,event){
  if(fingerprint(existing.event)!==fingerprint(event))throw new Error(`El eventId ${event?.eventId||''} ya pertenece a un evento diferente`)
 }
 function reportListenerError(error,entry){
  listenerFailureCount+=1
  const failure=Object.freeze({id:`ledger-listener-error:${listenerFailureCount}`,entryId:entry.id,sequence:entry.sequence,occurredAt:new Date().toISOString(),message:errorText(error)})
  listenerErrors.push(failure)
  if(listenerErrors.length>errorHistoryLimit)listenerErrors.splice(0,listenerErrors.length-errorHistoryLimit)
  if(onListenerError){try{onListenerError(error,entry,failure)}catch{/* La telemetría tampoco bloquea el Ledger. */}}
 }
 function notify(entry){listeners.forEach(listener=>{try{listener(entry)}catch(error){reportListenerError(error,entry)}})}
 function rebuildIndexes(){entriesById.clear();entriesBySequence.clear();entries.forEach(entry=>{entriesById.set(entry.id,entry);entriesBySequence.set(entry.sequence,entry)})}
 function trim(){if(entries.length<=maxEntries)return;entries.splice(0,entries.length-maxEntries);rebuildIndexes()}
 function append(event,options={}){
  const existing=entriesById.get(event?.eventId)
  if(existing){assertSameIdentity(existing,event);return existing}
  const sequence=options.sequence??nextSequence
  const sequenceOwner=entriesBySequence.get(sequence)
  if(sequenceOwner)throw new Error(`La secuencia ${sequence} ya pertenece al evento ${sequenceOwner.id}`)
  const entry=createLedgerEntry(event,{...options,sequence})
  entries.push(entry);entries.sort((a,b)=>a.sequence-b.sequence)
  entriesById.set(entry.id,entry);entriesBySequence.set(entry.sequence,entry)
  nextSequence=Math.max(nextSequence,entry.sequence+1)
  trim();notify(entry);return entry
 }
 function appendMany(values=[]){
  if(!Array.isArray(values))throw new Error('La escritura por lote del Ledger requiere una lista')
  const candidateById=new Map(entriesById),candidateBySequence=new Map(entriesBySequence),prepared=[],results=[]
  let candidateNextSequence=nextSequence
  for(const value of values){
   const event=isLedgerEntry(value)?value.event:value
   const options=isLedgerEntry(value)?{sequence:value.sequence,recordedAt:value.recordedAt}:{}
   const existing=candidateById.get(event?.eventId)
   if(existing){assertSameIdentity(existing,event);results.push(existing);continue}
   const sequence=options.sequence??candidateNextSequence
   const sequenceOwner=candidateBySequence.get(sequence)
   if(sequenceOwner)throw new Error(`La secuencia ${sequence} ya pertenece al evento ${sequenceOwner.id}`)
   const entry=createLedgerEntry(event,{...options,sequence})
   prepared.push(entry);results.push(entry);candidateById.set(entry.id,entry);candidateBySequence.set(entry.sequence,entry)
   candidateNextSequence=Math.max(candidateNextSequence,entry.sequence+1)
  }
  if(!prepared.length)return results
  entries.push(...prepared);entries.sort((a,b)=>a.sequence-b.sequence);nextSequence=candidateNextSequence;rebuildIndexes();trim();prepared.forEach(notify)
  return results
 }
 function reconcileMany(values=[]){
  if(!Array.isArray(values))throw new Error('La reconciliación del Ledger requiere una lista')
  const candidateById=new Map(entriesById),candidateBySequence=new Map(entriesBySequence),prepared=[]
  let candidateNextSequence=nextSequence
  for(const value of values){
   const event=isLedgerEntry(value)?value.event:value
   const options=isLedgerEntry(value)?{sequence:value.sequence,recordedAt:value.recordedAt}:{}
   const existing=candidateById.get(event?.eventId)
   if(existing){assertSameIdentity(existing,event);continue}
   const sequence=options.sequence??candidateNextSequence
   const sequenceOwner=candidateBySequence.get(sequence)
   if(sequenceOwner)throw new Error(`La secuencia ${sequence} ya pertenece al evento ${sequenceOwner.id}`)
   const entry=createLedgerEntry(event,{...options,sequence})
   prepared.push(entry);candidateById.set(entry.id,entry);candidateBySequence.set(entry.sequence,entry)
   candidateNextSequence=Math.max(candidateNextSequence,entry.sequence+1)
  }
  if(prepared.length){entries.push(...prepared);entries.sort((a,b)=>a.sequence-b.sequence);nextSequence=candidateNextSequence;rebuildIndexes();trim()}
  return entries.slice()
 }
 function replaceMany(values=[]){
  if(!Array.isArray(values))throw new Error('La rehidratación del Ledger requiere una lista')
  const prepared=[],preparedById=new Map(),preparedBySequence=new Map()
  let preparedNextSequence=1
  for(const value of values){
   const event=isLedgerEntry(value)?value.event:value
   const options=isLedgerEntry(value)?{sequence:value.sequence,recordedAt:value.recordedAt}:{}
   const existing=preparedById.get(event?.eventId)
   if(existing){assertSameIdentity(existing,event);continue}
   const sequence=options.sequence??preparedNextSequence
   const sequenceOwner=preparedBySequence.get(sequence)
   if(sequenceOwner)throw new Error(`La secuencia ${sequence} ya pertenece al evento ${sequenceOwner.id}`)
   const entry=createLedgerEntry(event,{...options,sequence})
   prepared.push(entry);preparedById.set(entry.id,entry);preparedBySequence.set(entry.sequence,entry)
   preparedNextSequence=Math.max(preparedNextSequence,entry.sequence+1)
  }
  prepared.sort((a,b)=>a.sequence-b.sequence)
  const retained=prepared.slice(-maxEntries)
  entries.length=0;entries.push(...retained);rebuildIndexes();nextSequence=Math.max(1,...retained.map(entry=>entry.sequence+1))
  return retained.slice()
 }
 function find({organizationId,siteId,eventName,aggregateType,aggregateId,actorId,correlationId,from,to,search,order='desc',limit=100}={}){
  const fromTime=from?Date.parse(from):null,toTime=to?Date.parse(to):null,needle=text(search)
  return entries.filter(entry=>{const event=entry.event,time=Date.parse(event.occurredAt);return(!organizationId||event.context.organizationId===organizationId)&&(!siteId||event.context.siteId===siteId)&&(!eventName||event.name===eventName)&&(!aggregateType||event.aggregate.type===aggregateType)&&(!aggregateId||event.aggregate.id===aggregateId)&&(!actorId||event.context.actorId===actorId)&&(!correlationId||event.correlationId===correlationId)&&(fromTime===null||time>=fromTime)&&(toTime===null||time<=toTime)&&(!needle||[event.name,event.aggregate.type,event.aggregate.id,event.metadata?.actorName,event.payload?.label,event.payload?.summary].some(value=>text(value).includes(needle))) }).sort((a,b)=>(order==='asc'?1:-1)*(a.sequence-b.sequence)).slice(0,Math.max(0,limit))
 }
 function getByEventId(id){return entriesById.get(id)||null}
 function getBySequence(sequence){return entriesBySequence.get(sequence)||null}
 function count(filters={}){return find({...filters,limit:Number.MAX_SAFE_INTEGER}).length}
 function subscribe(listener){if(typeof listener!=='function')throw new Error('El observador del Ledger debe ser una función');listeners.add(listener);return()=>listeners.delete(listener)}
 function getListenerErrors({limit=errorHistoryLimit}={}){return Object.freeze(listenerErrors.slice(-Math.max(0,Number(limit)||0)))}
 function clearListenerErrors(){listenerErrors.length=0;return true}
 function clear(){entries.length=0;entriesById.clear();entriesBySequence.clear();nextSequence=1}
 function health(){const lastListenerError=listenerErrors.at(-1)||null;return Object.freeze({status:listenerFailureCount?'degraded':'ready',driver:'memory',entries:entries.length,nextSequence,maxEntries,listenerFailureCount,listenerErrorsRetained:listenerErrors.length,lastListenerError})}
 return Object.freeze({append,appendMany,reconcileMany,replaceMany,find,getByEventId,getBySequence,count,subscribe,getListenerErrors,clearListenerErrors,clear,health})
}

const scopedLedgers=new Map()
function scopePart(value,label){const normalized=String(value??'').trim();if(!normalized)throw new Error(`${label} es obligatorio para resolver el runtime`);return normalized}
export function ledgerRuntimeKey({organizationId,actorId='system'}={}){return`${scopePart(organizationId,'La empresa')}::${scopePart(actorId,'El actor')}`}
export function getOperationalLedgerForScope(scope){
 const key=ledgerRuntimeKey(scope)
 if(!scopedLedgers.has(key))scopedLedgers.set(key,createMemoryLedgerRepository())
 return scopedLedgers.get(key)
}
export function releaseOperationalLedgerScope(scope){
 const key=ledgerRuntimeKey(scope),ledger=scopedLedgers.get(key)
 if(!ledger)return false
 ledger.clear();scopedLedgers.delete(key);return true
}
export function operationalLedgerScopeCount(){return scopedLedgers.size}

export const operationalLedger=getOperationalLedgerForScope({organizationId:'local-installation',actorId:'system'})