import{useCallback,useMemo,useRef}from'react'
import{publishDomainEvent}from'../core/events/index.js'
import{activeOrganizationId}from'../domain/organizationOwnership.js'
import{scopeEnvironmentState}from'../domain/environment.js'
import{useStore}from'./store.jsx'
import{ENVIRONMENT_OPERATIONS,environmentCommandRequestKey,executeEnvironmentCommand}from'./environmentCommand.js'

export{ENVIRONMENT_OPERATIONS}

export function useEnvironmentCommandStore(){
 const{state:rawState,update}=useStore()
 const stateRef=useRef(rawState),inFlightRef=useRef(new Map()),retryRef=useRef(new Map())
 stateRef.current=rawState
 const state=useMemo(()=>scopeEnvironmentState(rawState),[rawState])
 const execute=useCallback(command=>{
  const snapshot=stateRef.current,organizationId=activeOrganizationId(snapshot)
  const requestKey=`${organizationId}:${environmentCommandRequestKey(command)}`
  const inFlight=inFlightRef.current.get(requestKey)
  if(inFlight)return inFlight
  const retry=retryRef.current.get(requestKey)
  const envelope={...command,commandId:command?.commandId||retry?.commandId||crypto.randomUUID(),occurredAt:command?.occurredAt||retry?.occurredAt||new Date().toISOString()}
  retryRef.current.set(requestKey,{commandId:envelope.commandId,occurredAt:envelope.occurredAt})
  let execution
  execution=executeEnvironmentCommand(snapshot,envelope,{publishEvent:event=>publishDomainEvent(snapshot,event),commit:update})
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
