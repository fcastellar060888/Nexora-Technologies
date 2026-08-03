import{useEffect}from'react'
import{eventBus}from'../events/index.js'
import{useStore}from'../../services/store.jsx'
import{connectLedgerToEventBus,operationalLedger}from'./index.js'

const canonicalEntries=()=>operationalLedger.find({order:'asc',limit:10000})
const sameSnapshot=(left,right)=>JSON.stringify(left||[])===JSON.stringify(right||[])

export default function OperationalLedgerBridge(){
 const{state,update}=useStore()

 useEffect(()=>{
  const incoming=state.operationalLedgerEntries||[]
  const canonical=operationalLedger.reconcileMany(incoming)
  if(sameSnapshot(incoming,canonical))return
  update(current=>({...current,operationalLedgerEntries:canonical}),{sync:false,audit:false})
 },[state.operationalLedgerEntries,update])

 useEffect(()=>{
  const persist=operationalLedger.subscribe(entry=>{
   update(current=>{
    if((current.operationalLedgerEntries||[]).some(item=>item.id===entry.id))return current
    return{...current,operationalLedgerEntries:canonicalEntries()}
   },{sync:false,audit:false})
  })
  const disconnect=connectLedgerToEventBus(operationalLedger,eventBus)
  return()=>{disconnect();persist()}
 },[update])

 return null
}
