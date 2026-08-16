import{useCallback,useMemo,useRef}from'react'
import{publishDomainEvent}from'../core/events/index.js'
import{activeOrganizationId}from'../domain/organizationOwnership.js'
import{scopeIrrigationMirfeState}from'../domain/irrigationMirfeTenancy.js'
import{useStore}from'./store.jsx'
import{IRRIGATION_MIRFE_OPERATIONS,executeIrrigationMirfeCommand,irrigationMirfeCommandRequestKey}from'./irrigationMirfeCommand.js'

export{IRRIGATION_MIRFE_OPERATIONS}

export function useIrrigationMirfeCommandStore(){
 const{state:rawState,update}=useStore()
 const stateRef=useRef(rawState),inFlightRef=useRef(new Map()),retryRef=useRef(new Map())
 stateRef.current=rawState
 const state=useMemo(()=>scopeIrrigationMirfeState(rawState),[rawState])
 const execute=useCallback(command=>{
  const snapshot=stateRef.current,organizationId=activeOrganizationId(snapshot)
  const requestKey=`${organizationId}:${irrigationMirfeCommandRequestKey(command)}`
  const inFlight=inFlightRef.current.get(requestKey)
  if(inFlight)return inFlight
  const retry=retryRef.current.get(requestKey)
  const envelope={...command,commandId:command?.commandId||retry?.commandId||crypto.randomUUID(),occurredAt:command?.occurredAt||retry?.occurredAt||new Date().toISOString()}
  retryRef.current.set(requestKey,{commandId:envelope.commandId,occurredAt:envelope.occurredAt})
  let execution
  execution=executeIrrigationMirfeCommand(snapshot,envelope,{publishEvent:event=>publishDomainEvent(snapshot,event),commit:update})
   .then(result=>{
    if(retryRef.current.get(requestKey)?.commandId===envelope.commandId)retryRef.current.delete(requestKey)
    return result
   })
   .finally(()=>{if(inFlightRef.current.get(requestKey)===execution)inFlightRef.current.delete(requestKey)})
  inFlightRef.current.set(requestKey,execution)
  return execution
 },[update])
 return useMemo(()=>({state,execute}),[state,execute])
}
