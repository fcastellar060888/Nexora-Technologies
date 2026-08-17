import{useCallback,useMemo,useRef}from'react'
import{publishDomainEvent}from'../core/events/publishDomainEvent.js'
import{scopeMipeState}from'../domain/mipeTenancy.js'
import{executeMipeCommand,mipeCommandRequestKey}from'./mipeCommand.js'
import{useStore}from'./store.jsx'

const uuid=()=>globalThis.crypto?.randomUUID?.()||`mipe-${Date.now()}-${Math.random().toString(16).slice(2)}`

export function useMipeCommandStore(){
 const store=useStore(),inFlight=useRef(new Map()),retry=useRef(new Map())
 const state=useMemo(()=>scopeMipeState(store.state),[store.state])
 const execute=useCallback(({operation,entityId='',input={},commandId='',occurredAt=''}={})=>{
  const requestKey=mipeCommandRequestKey({operation,entityId,input})
  if(inFlight.current.has(requestKey))return inFlight.current.get(requestKey)
  const pending=retry.current.get(requestKey),resolvedCommandId=commandId||pending?.commandId||uuid(),resolvedOccurredAt=occurredAt||pending?.occurredAt||new Date().toISOString()
  retry.current.set(requestKey,{commandId:resolvedCommandId,occurredAt:resolvedOccurredAt})
  const snapshot=store.state
  const promise=executeMipeCommand(snapshot,{operation,entityId,input,commandId:resolvedCommandId,occurredAt:resolvedOccurredAt},{publishEvent:spec=>publishDomainEvent(snapshot,spec),commit:(recipe,meta)=>store.update(recipe,meta)})
   .then(result=>{retry.current.delete(requestKey);return result})
   .finally(()=>inFlight.current.delete(requestKey))
  inFlight.current.set(requestKey,promise)
  return promise
 },[store.state,store.update])
 return{state,execute}
}
