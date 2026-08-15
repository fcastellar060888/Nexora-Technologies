import{hasPermission as hasScopedPermission}from'../domain/accessControl.js'

export const ROLE_PERMISSIONS={
 'Administrador':['*'],
 'Gerente':['view_dashboards','view_costs','view_audit','export_data'],
 'Agrónomo':['view_dashboards','manage_mipe','manage_mirfe','manage_irrigation','approve_formulas','view_inventory','view_production'],
 'Supervisor':['view_dashboards','manage_mipe','manage_mirfe','execute_orders','view_inventory','manage_production'],
 'Encargado de riego':['view_irrigation','execute_orders','record_irrigation','view_inventory'],
 'Encargado MIPE':['manage_mipe','execute_treatments','view_inventory'],
 'Operario':['execute_orders','record_observations','manage_production'],
 'Inventario':['manage_inventory','view_costs']
}

const text=value=>String(value??'').trim()
const list=value=>Array.isArray(value)?value:[]

export function activeUser(state){
 return list(state?.users).find(user=>user?.activeSession&&user?.active!==false)||null
}

export function isInstallationMode(state){
 return list(state?.users).length===0&&list(state?.memberships).length===0&&list(state?.companies).length===0
}

export function activeAuthorizationScope(state){
 const companyId=text(state?.currentContext?.companyId)
 const siteId=text(state?.currentContext?.siteId)
 return{companyId,siteId}
}

function legacyAccessState(state,user){
 const companyId=activeAuthorizationScope(state).companyId||text(state?.companies?.[0]?.id)||'local-installation'
 const roleId=`legacy:${text(user?.role)||'unknown'}`
 return{
  ...state,
  roles:[...list(state?.roles),{id:roleId,permissions:ROLE_PERMISSIONS[user?.role]||[]}],
  memberships:[{id:`legacy-membership:${user.id}`,userId:user.id,companyId,roleId,siteIds:user.siteId?[user.siteId]:[],status:'active'}]
 }
}

export function hasPermission(state,permission,{companyId,siteId}={}){
 if(isInstallationMode(state))return true
 const user=activeUser(state)
 if(!user)return false
 const scope=activeAuthorizationScope(state)
 const memberships=list(state?.memberships).filter(item=>item?.userId===user.id&&item?.status!=='inactive')
 const legacyStandalone=!user.remote&&memberships.length===0&&list(state?.companies).length===0
 const organizationId=text(companyId||scope.companyId||(legacyStandalone?'local-installation':''))
 const locationId=text(siteId??scope.siteId)
 if(!organizationId)return false
 if(memberships.length){
  return hasScopedPermission({state,userId:user.id,companyId:organizationId,siteId:locationId,permission})
 }
 if(user.remote)return false
 const adapted=legacyAccessState(state,user)
 return hasScopedPermission({state:adapted,userId:user.id,companyId:organizationId,siteId:locationId,permission})
}
