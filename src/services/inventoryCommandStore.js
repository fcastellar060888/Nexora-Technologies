import{useCallback,useMemo,useRef}from'react'
import{publishDomainEvent}from'../core/events/publishDomainEvent.js'
import{scopeInventoryState}from'../domain/inventoryTenancy.js'
import{executeInventoryCommand,inventoryCommandRequestKey}from'./inventoryCommand.js'
import{useStore}from'./store.jsx'
const uuid=()=>globalThis.crypto?.randomUUID?.()||`inventory-${Date.now()}-${Math.random().toString(16).slice(2)}`
export function useInventoryCommandStore(){
 const store=useStore(),inFlight=useRef(new Map()),retry=useRef(new Map()),state=useMemo(()=>scopeInventoryState(store.state),[store.state])
 const execute=useCallback(({operation,entityId='',input={},commandId='',occurredAt=''}={})=>{const key=inventoryCommandRequestKey({operation,entityId,input});if(inFlight.current.has(key))return inFlight.current.get(key);const pending=retry.current.get(key),id=commandId||pending?.commandId||uuid(),at=occurredAt||pending?.occurredAt||new Date().toISOString();retry.current.set(key,{commandId:id,occurredAt:at});const snapshot=store.state,promise=executeInventoryCommand(snapshot,{operation,entityId,input,commandId:id,occurredAt:at},{publishEvent:spec=>publishDomainEvent(snapshot,spec),commit:(recipe,meta)=>store.update(recipe,meta)}).then(result=>{retry.current.delete(key);return result}).finally(()=>inFlight.current.delete(key));inFlight.current.set(key,promise);return promise},[store.state,store.update])
 return{state,execute}
}
