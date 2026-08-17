import{activeOrganizationId}from'../domain/organizationOwnership.js'
import{mergeIrrigationMirfeState}from'../domain/irrigationMirfeTenancy.js'
import{mergeMipeState,scopeMipeState}from'../domain/mipeTenancy.js'

export function mutateMipeTenantState(current,recipe){
 const organizationId=activeOrganizationId(current)
 const tenantBase=scopeMipeState(current,organizationId)
 const tenantCandidate=typeof recipe==='function'?recipe(tenantBase):recipe
 const withMipe=mergeMipeState(current,tenantBase,tenantCandidate,organizationId)
 return mergeIrrigationMirfeState(withMipe,tenantBase,tenantCandidate,organizationId)
}
