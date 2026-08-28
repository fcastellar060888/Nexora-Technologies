import{useCallback,useMemo,useRef}from'react'
import{publishDomainEvent}from'../core/events/publishDomainEvent.js'
import{inventoryUiAccess,scopeInventoryUiState}from'./inventoryUiAccess.js'
import{executeInventoryCommand,INVENTORY_OPERATIONS,inventoryCommandRequestKey}from'./inventoryCommand.js'
import{useStore}from'./store.jsx'
const uuid=()=>globalThis.crypto?.randomUUID?.()||`inventory-${Date.now()}-${Math.random().toString(16).slice(2)}`
export function useInventoryCommandStore(){
 const store=useStore(),inFlight=useRef(new Map()),retry=useRef(new Map()),state=useMemo(()=>scopeInventoryUiState(store.state),[store.state]),access=useMemo(()=>inventoryUiAccess(store.state),[store.state])
 const execute=useCallback(({operation,entityId='',input={},commandId='',occurredAt=''}={})=>{const currentAccess=inventoryUiAccess(store.state),allowed=operation===INVENTORY_OPERATIONS.CREATE_PRODUCT?currentAccess.canManageProduct:currentAccess.canManage;if(!allowed)return Promise.reject(new Error('No tienes permiso para administrar inventario en el contexto requerido por esta operación.'));const key=inventoryCommandRequestKey({operation,entityId,input});if(inFlight.current.has(key))return inFlight.current.get(key);const pending=retry.current.get(key),id=commandId||pending?.commandId||uuid(),at=occurredAt||pending?.occurredAt||new Date().toISOString();retry.current.set(key,{commandId:id,occurredAt:at});const snapshot=store.state,promise=executeInventoryCommand(snapshot,{operation,entityId,input,commandId:id,occurredAt:at},{publishEvent:spec=>publishDomainEvent(snapshot,spec),commit:(recipe,meta)=>store.update(recipe,meta)}).then(result=>{retry.current.delete(key);return result}).finally(()=>inFlight.current.delete(key));inFlight.current.set(key,promise);return promise},[store.state,store.update])
 return{state,access,execute}
}
