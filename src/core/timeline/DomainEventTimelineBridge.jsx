import{useEffect}from'react'
import{getOperationalLedgerForScope}from'../ledger/index.js'
import{domainEventToTimelineEntry}from'./timelineProjection.js'
import{getTimelineEngineForScope}from'./timelineEngine.js'
import{useStore}from'../../services/store.jsx'

const projectLedgerEntry=ledgerEntry=>domainEventToTimelineEntry(ledgerEntry.event,{sequence:ledgerEntry.sequence,recordedAt:ledgerEntry.recordedAt})
const activeScope=state=>{
 const user=(state.users||[]).find(item=>item.activeSession)
 return{
  organizationId:state.currentContext?.companyId||'local-installation',
  actorId:user?.remoteId||user?.id||'system'
 }
}

export default function DomainEventTimelineBridge(){
 const{state,update}=useStore()
 const scope=activeScope(state)
 const companyId=scope.organizationId
 const ledger=getOperationalLedgerForScope(scope)
 const timeline=getTimelineEngineForScope(scope)

 useEffect(()=>{
  const ledgerEntries=(state.operationalLedgerEntries||[]).filter(entry=>entry?.event?.context?.organizationId===companyId)
  const projected=ledgerEntries.map(projectLedgerEntry)
  const historical=(state.timelineEntries||[]).filter(item=>item.organizationId===companyId)
  const historicalById=new Map(historical.map(item=>[item.id,item]))
  projected.forEach(item=>historicalById.set(item.id,item))
  timeline.hydrate([...historicalById.values()])

  const canonical=timeline.query({organizationId:companyId,order:'asc',limit:2000})
  const unchanged=historical.length===canonical.length&&historical.every((item,index)=>JSON.stringify(item)===JSON.stringify(canonical[index]))
  if(!unchanged){
   update(value=>{
    const foreign=(value.timelineEntries||[]).filter(item=>item.organizationId!==companyId)
    return{...value,timelineEntries:[...foreign,...canonical]}
   },{sync:false,audit:false})
  }
 },[state.timelineEntries,state.operationalLedgerEntries,update,timeline,companyId])

 useEffect(()=>ledger.subscribe(ledgerEntry=>{
  if(ledgerEntry?.event?.context?.organizationId!==companyId)return
  const entry=projectLedgerEntry(ledgerEntry)
  timeline.record(entry)
  update(current=>{
   const foreign=(current.timelineEntries||[]).filter(item=>item.organizationId!==companyId)
   const local=timeline.query({organizationId:companyId,order:'asc',limit:2000})
   return{...current,timelineEntries:[...foreign,...local]}
  },{sync:false,audit:false})
 }),[update,ledger,timeline,companyId])

 return null
}
