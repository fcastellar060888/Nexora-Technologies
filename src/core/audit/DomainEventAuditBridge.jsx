import{useEffect}from'react'
import{getOperationalLedgerForScope}from'../ledger/index.js'
import{useStore}from'../../services/store.jsx'
import{domainEventToAuditEntry}from'./domainEventAudit.js'

const activeScope=state=>{
 const user=(state.users||[]).find(item=>item.activeSession)
 return{
  organizationId:state.currentContext?.companyId||'local-installation',
  actorId:user?.remoteId||user?.id||'system'
 }
}

export default function DomainEventAuditBridge(){
 const{state,update}=useStore()
 const scope=activeScope(state)
 const companyId=scope.organizationId
 const ledger=getOperationalLedgerForScope(scope)

 useEffect(()=>{
  const persisted=(state.operationalLedgerEntries||[]).filter(item=>item?.event?.context?.organizationId===companyId)
  if(persisted.length){
   const projected=persisted.map(item=>domainEventToAuditEntry(item.event))
   update(current=>{
    const existing=new Set((current.auditLog||[]).map(item=>item.id))
    const additions=projected.filter(item=>!existing.has(item.id))
    return additions.length?{...current,auditLog:[...(current.auditLog||[]),...additions]}:current
   },{sync:false,audit:false})
  }

  return ledger.subscribe(ledgerEntry=>{
   if(ledgerEntry?.event?.context?.organizationId!==companyId)return
   const entry=domainEventToAuditEntry(ledgerEntry.event)
   update(current=>{
    if((current.auditLog||[]).some(item=>item.id===entry.id))return current
    return{...current,auditLog:[...(current.auditLog||[]),entry]}
   },{sync:false,audit:false})
  })
 },[state.operationalLedgerEntries,update,ledger,companyId])

 return null
}
