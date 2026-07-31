import{useEffect}from'react'
import{operationalLedger}from'../ledger/index.js'
import{useStore}from'../../services/store.jsx'
import{domainEventToAuditEntry}from'./domainEventAudit.js'

export default function DomainEventAuditBridge(){
 const{state,update}=useStore()

 useEffect(()=>{
  const persisted=state.operationalLedgerEntries||[]
  if(persisted.length){
   const projected=persisted.map(item=>domainEventToAuditEntry(item.event))
   update(current=>{
    const existing=new Set((current.auditLog||[]).map(item=>item.id))
    const additions=projected.filter(item=>!existing.has(item.id))
    return additions.length?{...current,auditLog:[...(current.auditLog||[]),...additions]}:current
   },{sync:false,audit:false})
  }

  return operationalLedger.subscribe(ledgerEntry=>{
   const entry=domainEventToAuditEntry(ledgerEntry.event)
   update(current=>{
    if((current.auditLog||[]).some(item=>item.id===entry.id))return current
    return{...current,auditLog:[...(current.auditLog||[]),entry]}
   },{sync:false,audit:false})
  })
 },[update])

 return null
}
