import{useCallback,useMemo}from'react'
import{scopeMipeState}from'../domain/mipeTenancy.js'
import{mutateMipeTenantState}from'./mipeTenantState.js'
import{useStore}from'./store.jsx'

export{mutateMipeTenantState}from'./mipeTenantState.js'

export function useMipeStore(){
 const store=useStore()
 const state=useMemo(()=>scopeMipeState(store.state),[store.state])
 const update=useCallback((recipe,meta={})=>store.update(current=>mutateMipeTenantState(current,recipe),meta),[store.update])
 return{...store,state,update}
}
