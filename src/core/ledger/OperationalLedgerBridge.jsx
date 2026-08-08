import{useEffect}from'react'
import{getEventBusForScope}from'../events/index.js'
import{useStore}from'../../services/store.jsx'
import{connectLedgerToEventBus,getOperationalLedgerForScope}from'./index.js'

const sameSnapshot=(left,right)=>JSON.stringify(left||[])===JSON.stringify(right||[])
const entryOrganizationId=entry=>entry?.event?.context?.organizationId||''
const eventIdOf=entry=>String(entry?.event?.eventId||entry?.id||'').trim()
const activeScope=state=>{
 const user=(state.users||[]).find(item=>item.activeSession)
 return{
  organizationId:state.currentContext?.companyId||'local-installation',
  actorId:user?.remoteId||user?.id||'system'
 }
}
const appendOutboxId=(state,companyId,eventId)=>{
 if(!eventId)return state
 const current=state?.syncMeta?.ledgerOutboxByCompany?.[companyId]||[]
 if(current.includes(eventId))return state
 return{
  ...state,
  syncMeta:{
   ...(state.syncMeta||{}),
   ledgerOutboxByCompany:{
    ...(state?.syncMeta?.ledgerOutboxByCompany||{}),
    [companyId]:[...current,eventId]
   }
  }
 }
}

export default function OperationalLedgerBridge(){
 const{state,update}=useStore()
 const scope=activeScope(state)
 const ledger=getOperationalLedgerForScope(scope)
 const bus=getEventBusForScope(scope)
 const companyId=scope.organizationId

 useEffect(()=>{
  const incoming=(state.operationalLedgerEntries||[]).filter(entry=>entryOrganizationId(entry)===companyId)
  const canonical=ledger.reconcileMany(incoming)
  if(sameSnapshot(incoming,canonical))return
  update(current=>{
   const foreign=(current.operationalLedgerEntries||[]).filter(entry=>entryOrganizationId(entry)!==companyId)
   return{...current,operationalLedgerEntries:[...foreign,...canonical]}
  },{sync:false,audit:false})
 },[state.operationalLedgerEntries,update,ledger,companyId])

 useEffect(()=>{
  const persist=ledger.subscribe(()=>{
   update(current=>{
    const foreign=(current.operationalLedgerEntries||[]).filter(entry=>entryOrganizationId(entry)!==companyId)
    const canonical=ledger.find({organizationId:companyId,order:'asc',limit:10000})
    return{...current,operationalLedgerEntries:[...foreign,...canonical]}
   },{sync:false,audit:false})
  })
  const disconnect=connectLedgerToEventBus(ledger,bus,{
   onAppend:entry=>{
    const eventId=eventIdOf(entry)
    update(current=>appendOutboxId(current,companyId,eventId),{sync:false,audit:false})
   }
  })
  return()=>{disconnect();persist()}
 },[update,ledger,bus,companyId])

 return null
}
