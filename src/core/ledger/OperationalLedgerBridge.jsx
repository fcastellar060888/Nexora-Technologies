import{useEffect,useRef}from'react'
import{eventBus}from'../events/index.js'
import{useStore}from'../../services/store.jsx'
import{connectLedgerToEventBus,operationalLedger}from'./index.js'

export default function OperationalLedgerBridge(){
 const{state,update}=useStore()
 const hydrated=useRef(false)

 useEffect(()=>{
  if(hydrated.current)return
  operationalLedger.clear()
  operationalLedger.appendMany(state.operationalLedgerEntries||[])
  hydrated.current=true
 },[state.operationalLedgerEntries])

 useEffect(()=>{
  const persist=operationalLedger.subscribe(entry=>{
   update(current=>{
    if((current.operationalLedgerEntries||[]).some(item=>item.id===entry.id))return current
    return{...current,operationalLedgerEntries:[...(current.operationalLedgerEntries||[]),entry].slice(-10000)}
   },{sync:false,audit:false})
  })
  const disconnect=connectLedgerToEventBus(operationalLedger,eventBus)
  return()=>{disconnect();persist()}
 },[update])

 return null
}
