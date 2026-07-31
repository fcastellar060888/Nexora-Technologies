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
 const role=roles.find(item=>item.id===normalized.roleId)
 const granted=unique([...(role?.permissions||[]),...normalized.permissionOverrides])
 const denied=new Set(normalized.deniedPermissions)
 return granted.filter(permission=>!denied.has(permission))
}

export function canAccessSite(membership,siteId){
 const normalized=normalizeMembership(membership)
 if(normalized.status!=='active')return false
 return normalized.siteIds.length===0||normalized.siteIds.includes(siteId)
}

export function resolveActiveAccess(state,userId){
 const memberships=(state.memberships||[]).map(normalizeMembership).filter(item=>item.userId===userId&&item.status==='active')
 return memberships.map(membership=>({
  ...membership,
  permissions:permissionsForMembership({membership,roles:state.roles||[]})
 }))
}

export function hasPermission({state,userId,companyId,siteId,permission}){
 return resolveActiveAccess(state,userId).some(access=>
  access.companyId===companyId&&
  canAccessSite(access,siteId)&&
  access.permissions.includes(permission)
 )
}
