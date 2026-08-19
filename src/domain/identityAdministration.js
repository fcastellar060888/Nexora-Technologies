import{activeOrganizationId,explicitOrganizationId}from'./organizationOwnership.js'

const list=value=>Array.isArray(value)?value:[]
const text=value=>String(value??'').trim()

function siteOwner(site){return text(explicitOrganizationId(site))}
function organizationSites(state,organizationId){
 const byId=new Map()
 for(const site of list(state?.sites)){
  const id=text(site?.id),owner=siteOwner(site)
  if(!id||!owner)continue
  if(!byId.has(id))byId.set(id,[])
  byId.get(id).push({site,owner})
 }
 return[...byId.values()].flatMap(candidates=>{
  if(candidates.length!==1)return[]
  return candidates[0].owner===organizationId?[candidates[0].site]:[]
 })
}
function membershipMatches(state,userId,organizationId){return list(state?.memberships).map((membership,index)=>({membership,index})).filter(candidate=>text(candidate.membership?.userId)===text(userId)&&text(candidate.membership?.companyId||candidate.membership?.organizationId)===organizationId)}
function resolveMembership(state,userId,organizationId){
 const matches=membershipMatches(state,userId,organizationId)
 if(matches.length>1)throw new Error('La membresía tiene identidad duplicada o ambigua dentro de la empresa activa.')
 if(matches.length===0)throw new Error('El usuario no tiene membresía en la empresa activa.')
 return matches[0]
}
function assertRequestedOrganization(input,organizationId){const requested=text(input?.organizationId||input?.companyId);if(requested&&requested!==organizationId)throw new Error('La operación de membresía pertenece a otra empresa.')}
function assertSiteIds(state,siteIds,organizationId){
 const allowed=new Set(organizationSites(state,organizationId).map(site=>text(site.id)))
 const requested=[...new Set(list(siteIds).map(text).filter(Boolean))]
 const foreign=requested.filter(id=>!allowed.has(id))
 if(foreign.length)throw new Error('La membresía contiene una sede extranjera o ambigua para la empresa activa.')
 return requested
}

export function identityAdministrationView(state){
 const organizationId=activeOrganizationId(state)
 const memberships=list(state?.memberships).filter(membership=>text(membership?.companyId||membership?.organizationId)===organizationId)
 const members=memberships.flatMap(membership=>{
  const userMatches=list(state?.users).filter(user=>text(user?.id)===text(membership?.userId))
  if(userMatches.length!==1)return[]
  return[{user:userMatches[0],membership}]
 })
 return{organizationId,members,sites:organizationSites(state,organizationId),roles:list(state?.roles).filter(role=>role?.active!==false)}
}

export function membersForActiveOrganization(state){return identityAdministrationView(state).members}
export function sitesForActiveOrganization(state){return identityAdministrationView(state).sites}

export function setMembershipStatus(state,input={}){
 const organizationId=activeOrganizationId(state)
 assertRequestedOrganization(input,organizationId)
 const status=text(input.status)
 if(!['active','inactive'].includes(status))throw new Error('El estado de membresía no es válido.')
 const{membership,index}=resolveMembership(state,input.userId,organizationId)
 const updated={...membership,companyId:organizationId,status,updatedAt:input.updatedAt||new Date().toISOString()}
 return{...state,memberships:list(state?.memberships).map((item,itemIndex)=>itemIndex===index?updated:item)}
}

export function removeMembershipFromActiveOrganization(state,input={}){
 const organizationId=activeOrganizationId(state)
 assertRequestedOrganization(input,organizationId)
 const{index}=resolveMembership(state,input.userId,organizationId)
 return{...state,memberships:list(state?.memberships).filter((_,itemIndex)=>itemIndex!==index)}
}

export function addMembershipToActiveOrganization(state,input={}){
 const organizationId=activeOrganizationId(state)
 assertRequestedOrganization(input,organizationId)
 const userId=text(input.userId)
 if(!userId||!list(state?.users).some(user=>text(user?.id)===userId))throw new Error('Selecciona una identidad de usuario válida.')
 if(membershipMatches(state,userId,organizationId).length)throw new Error('El usuario ya tiene membresía o existe una identidad ambigua en la empresa activa.')
 const roleId=text(input.roleId)
 const roleMatches=list(state?.roles).filter(role=>text(role?.id)===roleId&&role?.active!==false)
 if(roleMatches.length!==1)throw new Error('Selecciona un rol activo e inequívoco.')
 const siteIds=assertSiteIds(state,input.siteIds,organizationId)
 const membership={id:text(input.id)||crypto.randomUUID(),userId,companyId:organizationId,roleId,siteIds,status:'active',createdAt:input.createdAt||new Date().toISOString()}
 return{...state,memberships:[...list(state?.memberships),membership]}
}

export function validatedMembershipSiteIds(state,siteIds){return assertSiteIds(state,siteIds,activeOrganizationId(state))}
