import{mapRemoteEntitlement}from'./entitlements.js'

const unique=items=>[...new Set((items||[]).filter(Boolean))]

export function mapRemoteMembership(row={}){
 return{
  id:row.id||'',
  userId:row.user_id||row.userId||'',
  companyId:row.organization_id||row.company_id||row.companyId||'',
  roleId:row.role_id||row.roleId||'',
  siteIds:unique((row.membership_sites||row.siteIds||[]).map(item=>typeof item==='string'?item:item.site_id||item.siteId)),
  permissionOverrides:unique(row.permission_overrides||row.permissionOverrides),
  deniedPermissions:unique(row.denied_permissions||row.deniedPermissions),
  status:row.status||'active',
  createdAt:row.created_at||row.createdAt||'',
  updatedAt:row.updated_at||row.updatedAt||''
 }
}

export function chooseInitialContext({memberships=[],companies=[],sites=[],preferredCompanyId='',preferredSiteId=''}){
 const active=memberships.filter(item=>item.status==='active')
 const companyId=active.some(item=>item.companyId===preferredCompanyId)
  ?preferredCompanyId
  :active[0]?.companyId||companies[0]?.id||''
 const access=active.find(item=>item.companyId===companyId)
 const companySites=sites.filter(site=>site.companyId===companyId)
 const allowedSites=access?.siteIds?.length?companySites.filter(site=>access.siteIds.includes(site.id)):companySites
 const siteId=allowedSites.some(site=>site.id===preferredSiteId)?preferredSiteId:allowedSites[0]?.id||''
 return{companyId,siteId}
}

export function mergeRemoteIdentity(state,{user,profile,memberships,entitlements=[]}){
 const email=String(user?.email||profile?.email||'').trim().toLowerCase()
 const current=(state.users||[]).find(item=>item.id===user?.id||String(item.email||'').trim().toLowerCase()===email)
 const remoteUser={
  ...(current||{}),
  id:user?.id||current?.id||'',
  email,
  name:profile?.full_name||profile?.name||current?.name||email,
  active:profile?.active!==false,
  activeSession:true,
  remote:true
 }
 const users=[...(state.users||[]).filter(item=>item.id!==remoteUser.id&&String(item.email||'').trim().toLowerCase()!==email).map(item=>({...item,activeSession:false})),remoteUser]
 return{...state,users,memberships:memberships.map(mapRemoteMembership),entitlements:entitlements.map(mapRemoteEntitlement)}
}
