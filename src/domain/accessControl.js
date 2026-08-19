export const SYSTEM_ROLES={
 SUPER_ADMIN:'super_admin',
 ORGANIZATION_ADMIN:'organization_admin',
 SITE_MANAGER:'site_manager',
 AGRONOMIST:'agronomist',
 QUALITY:'quality',
 INVENTORY:'inventory',
 OPERATOR:'operator',
 VIEWER:'viewer'
}

export const PERMISSIONS=[
 'manage_organization','manage_users','manage_settings','manage_quality',
 'view_operations','manage_operations','manage_cultivation','manage_mipe',
 'manage_mirfe','manage_inventory','manage_production','manage_sales',
 'view_costs','manage_costs','view_audit'
]

const unique=items=>[...new Set((items||[]).filter(Boolean))]
const text=value=>String(value??'').trim()
const list=value=>Array.isArray(value)?value:[]
const siteOwner=site=>text(site?.organizationId||site?.companyId)
const roleOwner=role=>text(role?.organizationId||role?.companyId)
const systemRole=role=>role?.isSystem===true||role?.is_system===true||role?.systemRole===true||role?.system_role===true

export function normalizeMembership(membership={}){
 return{
  id:membership.id||'',
  userId:membership.userId||'',
  companyId:membership.companyId||membership.organizationId||'',
  roleId:membership.roleId||'',
  siteIds:unique(membership.siteIds),
  permissionOverrides:unique(membership.permissionOverrides),
  deniedPermissions:unique(membership.deniedPermissions),
  status:membership.status||'active',
  createdAt:membership.createdAt||'',
  updatedAt:membership.updatedAt||''
 }
}

export function permissionsForMembership({membership,roles=[]}){
 const normalized=normalizeMembership(membership)
 if(normalized.status!=='active')return[]
 const matches=list(roles).filter(item=>item?.id===normalized.roleId&&item?.active!==false&&(systemRole(item)||roleOwner(item)===normalized.companyId))
 if(matches.length!==1)return[]
 const role=matches[0]
 const granted=unique([...(role?.permissions||[]),...normalized.permissionOverrides])
 const denied=new Set(normalized.deniedPermissions)
 return granted.filter(permission=>!denied.has(permission))
}

// Low-level membership-only helper retained for compatibility. It does not establish site ownership.
export function canAccessSite(membership,siteId){
 const normalized=normalizeMembership(membership)
 if(normalized.status!=='active')return false
 if(!siteId)return normalized.siteIds.length===0
 return normalized.siteIds.length===0||normalized.siteIds.includes(siteId)
}

function membershipForCompany(state,userId,companyId){
 const matches=list(state?.memberships).map(normalizeMembership).filter(item=>item.userId===userId&&item.companyId===companyId&&item.status==='active')
 return matches.length===1?matches[0]:null
}
function siteForCompany(state,siteId,companyId){
 const matches=list(state?.sites).filter(site=>text(site?.id)===text(siteId)&&siteOwner(site)===companyId)
 return matches.length===1?matches[0]:null
}
function companySiteIds(state,companyId){
 const grouped=new Map()
 for(const site of list(state?.sites).filter(item=>siteOwner(item)===companyId)){
  const id=text(site?.id);if(!id)continue
  grouped.set(id,(grouped.get(id)||0)+1)
 }
 return[...grouped.entries()].filter(([,count])=>count===1).map(([id])=>id)
}

export function canUserAccessSite(state,userId,siteId,companyId=state?.currentContext?.companyId||''){
 const organizationId=text(companyId),locationId=text(siteId)
 if(!organizationId||!locationId)return false
 const membership=membershipForCompany(state,text(userId),organizationId)
 if(!membership||!siteForCompany(state,locationId,organizationId))return false
 return membership.siteIds.length===0||membership.siteIds.includes(locationId)
}

export function locationScopeForUser(state,userId,companyId=state?.currentContext?.companyId||''){
 const organizationId=text(companyId)
 const membership=membershipForCompany(state,text(userId),organizationId)
 if(!membership)return{companyId:organizationId,siteIds:[]}
 const owned=new Set(companySiteIds(state,organizationId))
 const siteIds=membership.siteIds.length===0?[...owned]:membership.siteIds.filter(id=>owned.has(text(id)))
 return{companyId:organizationId,siteIds:unique(siteIds)}
}

export function resolveActiveAccess(state,userId){
 const memberships=list(state?.memberships).map(normalizeMembership).filter(item=>item.userId===userId&&item.status==='active')
 return memberships.map(membership=>({
  ...membership,
  permissions:permissionsForMembership({membership,roles:state.roles||[]})
 }))
}

export function hasPermission({state,userId,companyId,siteId,permission}){
 if(!userId||!companyId||!permission)return false
 const accessMatches=resolveActiveAccess(state,userId).filter(access=>access.companyId===companyId)
 if(accessMatches.length!==1)return false
 const access=accessMatches[0]
 if(siteId&&!canUserAccessSite(state,userId,siteId,companyId))return false
 return access.permissions.includes('*')||access.permissions.includes(permission)
}
