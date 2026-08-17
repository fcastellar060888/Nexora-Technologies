import{useCallback,useMemo}from'react'
import{activeOrganizationId}from'../domain/organizationOwnership.js'
import{mergeIrrigationMirfeState}from'../domain/irrigationMirfeTenancy.js'
import{mergeMipeState,scopeMipeState}from'../domain/mipeTenancy.js'
import{useStore}from'./store.jsx'

export function mutateMipeTenantState(current,recipe){
 const organizationId=activeOrganizationId(current)
 const tenantBase=scopeMipeState(current,organizationId)
 const tenantCandidate=typeof recipe==='function'?recipe(tenantBase):recipe
 const withMipe=mergeMipeState(current,tenantBase,tenantCandidate,organizationId)
 return mergeIrrigationMirfeState(withMipe,tenantBase,tenantCandidate,organizationId)
}

export function useMipeStore(){
 const store=useStore()
 const state=useMemo(()=>scopeMipeState(store.state),[store.state])
 const update=useCallback((recipe,meta={})=>store.update(current=>mutateMipeTenantState(current,recipe),meta),[store.update])
 return{...store,state,update}
}
