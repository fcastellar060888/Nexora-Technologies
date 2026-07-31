import{useEffect,useRef}from'react'
import{operationalLedger}from'../ledger/index.js'
import{domainEventToTimelineEntry}from'./timelineProjection.js'
import{timelineEngine}from'./timelineEngine.js'
import{useStore}from'../../services/store.jsx'

export default function DomainEventTimelineBridge(){
 const{state,update}=useStore()
 const hydrated=useRef(false)

 useEffect(()=>{
  if(hydrated.current)return
  const ledgerEntries=state.operationalLedgerEntries||[]
  const projected=ledgerEntries.map(item=>domainEventToTimelineEntry(item.event))
  timelineEngine.hydrate([...(state.timelineEntries||[]),...projected])
  if(projected.length){
   update(current=>{
    const existing=new Set((current.timelineEntries||[]).map(item=>item.id))
    const additions=projected.filter(item=>!existing.has(item.id))
    return additions.length?{...current,timelineEntries:[...(current.timelineEntries||[]),...additions].slice(-2000)}:current
   },{sync:false,audit:false})
  }
  hydrated.current=true
 },[state.timelineEntries,state.operationalLedgerEntries,update])

 useEffect(()=>operationalLedger.subscribe(ledgerEntry=>{
  const entry=domainEventToTimelineEntry(ledgerEntry.event)
  timelineEngine.record(entry)
  update(current=>{
   if((current.timelineEntries||[]).some(item=>item.id===entry.id))return current
   return{...current,timelineEntries:[...(current.timelineEntries||[]),entry].slice(-2000)}
  },{sync:false,audit:false})
 }),[update])

 return null
}
