import{useEffect}from'react'
import{eventBus}from'../events/index.js'
import{useStore}from'../../services/store.jsx'
import{domainEventToAuditEntry}from'./domainEventAudit.js'

export default function DomainEventAuditBridge(){
 const{update}=useStore()
 useEffect(()=>eventBus.subscribe('*',event=>{
  const entry=domainEventToAuditEntry(event)
  update(state=>{
   if((state.auditLog||[]).some(item=>item.id===entry.id))return state
   return{...state,auditLog:[...(state.auditLog||[]),entry]}
  },{sync:false,audit:false})
 }),[update])
 return null
}
