import{scopeInventoryState}from'../domain/inventoryTenancy.js'
import{activeAuthorizationScope,activeUser,hasPermission,isInstallationMode}from'./permissions.js'

const list=value=>Array.isArray(value)?value:[]
const text=value=>String(value??'').trim()

export function inventoryUiAccess(state){
 const scope=activeAuthorizationScope(state),user=activeUser(state),installationMode=isInstallationMode(state)
 if(installationMode)return{userId:'local-installation',companyId:scope.companyId,siteId:scope.siteId,canView:true,canManage:true,canManageProduct:true}
 const userId=text(user?.id)
 if(!userId||!scope.companyId)return{userId,companyId:scope.companyId,siteId:scope.siteId,canView:false,canManage:false,canManageProduct:false}
 return{
  userId,companyId:scope.companyId,siteId:scope.siteId,
  canView:hasPermission(state,'view_inventory',{companyId:scope.companyId,siteId:scope.siteId}),
  canManage:hasPermission(state,'manage_inventory',{companyId:scope.companyId,siteId:scope.siteId}),
  canManageProduct:hasPermission(state,'manage_inventory',{companyId:scope.companyId,siteId:''})
 }
}

export function scopeInventoryUiState(state){
 const access=inventoryUiAccess(state)
 if(!access.canView)return{...state,products:[],inventoryLots:[],inventoryMovements:[],sites:[]}
 const scoped=scopeInventoryState(state,access.companyId)
 if(!access.siteId)return scoped
 const sites=list(scoped.sites).filter(site=>text(site?.id)===access.siteId)
 const lots=list(scoped.inventoryLots).filter(lot=>text(lot?.siteId)===access.siteId)
 const lotIds=new Set(lots.map(lot=>text(lot?.id)))
 const movements=list(scoped.inventoryMovements).filter(movement=>lotIds.has(text(movement?.lotId)))
 return{...scoped,sites,inventoryLots:lots,inventoryMovements:movements}
}
