const list=value=>Array.isArray(value)?value:[]
const validDate=value=>!Number.isNaN(Date.parse(value))
const iso=value=>validDate(value)?new Date(value).toISOString():null

function aliases(entry){
 const payload=entry?.payload||{}
 const metadata=entry?.metadata||{}
 return new Set([
  entry?.id,
  entry?.sourceId,
  payload.findingId,
  payload.interventionId,
  payload.plantEventId,
  payload.entityId,
  metadata.sourceId,
  metadata.findingId,
  metadata.interventionId
 ].filter(Boolean).map(String))
}

function normalize(entry,{source='canonical'}={}){
 if(!entry?.id)return null
 const occurredAt=iso(entry.occurredAt||entry.createdAt||entry.date)
 if(!occurredAt)return null
 return Object.freeze({...entry,id:String(entry.id),occurredAt,source})
}

function compare(a,b){
 const time=Date.parse(b.occurredAt)-Date.parse(a.occurredAt)
 if(time)return time
 const left=Number.isInteger(a.sequence)?a.sequence:-1
 const right=Number.isInteger(b.sequence)?b.sequence:-1
 if(left!==right)return right-left
 return String(a.id).localeCompare(String(b.id))
}

export function composePassportTimeline({canonical=[],legacy=[],aggregateId}={}){
 const selectedCanonical=list(canonical)
  .filter(entry=>!aggregateId||entry.aggregateId===aggregateId||entry.objectId===aggregateId||entry.entityId===aggregateId)
  .map(entry=>normalize(entry,{source:'canonical'}))
  .filter(Boolean)

 const occupied=new Set()
 selectedCanonical.forEach(entry=>aliases(entry).forEach(value=>occupied.add(value)))

 const result=[...selectedCanonical]
 for(const raw of list(legacy)){
  const entry=normalize(raw,{source:'legacy'})
  if(!entry)continue
  const entryAliases=aliases(entry)
  if([...entryAliases].some(value=>occupied.has(value)))continue
  result.push(entry)
  entryAliases.forEach(value=>occupied.add(value))
 }
 return Object.freeze(result.sort(compare))
}
