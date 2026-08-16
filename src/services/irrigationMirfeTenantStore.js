import{useCallback,useMemo}from'react'
import{mutateIrrigationMirfeState,scopeIrrigationMirfeState}from'../domain/irrigationMirfeTenancy.js'
import{useStore}from'./store.jsx'

export function useIrrigationMirfeStore(){
 const store=useStore()
 const state=useMemo(()=>scopeIrrigationMirfeState(store.state),[store.state])
 const update=useCallback((recipe,meta={})=>store.update(current=>mutateIrrigationMirfeState(current,tenant=>typeof recipe==='function'?recipe(tenant):recipe),meta),[store.update])
 return{...store,state,update}
}
