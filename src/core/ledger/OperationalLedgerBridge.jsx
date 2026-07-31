import{useEffect}from'react'
import{eventBus}from'../events/index.js'
import{connectLedgerToEventBus,operationalLedger}from'./index.js'

export default function OperationalLedgerBridge(){
 useEffect(()=>connectLedgerToEventBus(operationalLedger,eventBus),[])
 return null
}
