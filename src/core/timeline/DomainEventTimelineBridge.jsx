import{useEffect}from'react'
import{operationalLedger}from'../ledger/index.js'
import{domainEventToTimelineEntry}from'./timelineProjection.js'
import{timelineEngine}from'./timelineEngine.js'
import{useStore}from'../../services/store.jsx'

const projectLedgerEntry=ledgerEntry=>domainEventToTimelineEntry(ledgerEntry.event,{sequence:ledgerEntry.sequence,recordedAt:ledgerEntry.recordedAt})

export default function DomainEventTimelineBridge(){
 const{state,update}=useStore()

 useEffect(()=>{
  const ledgerEntries=state.operationalLedgerEntries||[]
  const projected=ledgerEntries.map(projectLedgerEntry)
  const historicalById=new Map((state.timelineEntries||[]).map(item=>[item.id,item]))
  projected.forEach(item=>historicalById.set(item.id,item))
  timelineEngine.hydrate([...historicalById.values()])

  const canonical=timelineEngine.query({order:'asc',limit:2000})
  const current=state.timelineEntries||[]
  const unchanged=current.length===canonical.length&&current.every((item,index)=>item.id===canonical[index]?.id&&item.sequence===canonical[index]?.sequence)
  if(!unchanged){
   update(value=>({...value,timelineEntries:canonical}),{sync:false,audit:false})
  }
 },[state.timelineEntries,state.operationalLedgerEntries,update])

 useEffect(()=>operationalLedger.subscribe(ledgerEntry=>{
  const entry=projectLedgerEntry(ledgerEntry)
  timelineEngine.record(entry)
  update(current=>{
   if((current.timelineEntries||[]).some(item=>item.id===entry.id))return current
   return{...current,timelineEntries:[...(current.timelineEntries||[]),entry].sort((a,b)=>(Date.parse(a.occurredAt)-Date.parse(b.occurredAt))||((a.sequence??Number.MAX_SAFE_INTEGER)-(b.sequence??Number.MAX_SAFE_INTEGER))).slice(-2000)}
  },{sync:false,audit:false})
 }),[update])

 return null
}
