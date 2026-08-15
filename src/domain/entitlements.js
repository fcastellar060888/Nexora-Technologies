const text=value=>String(value??'').trim()
const list=value=>Array.isArray(value)?value:[]

export const PRODUCT_CAPABILITIES=Object.freeze({
 INFRASTRUCTURE:'infrastructure',MIPE:'mipe',MIRFE:'mirfe',IRRIGATION:'irrigation',INVENTORY:'inventory',COMMERCIAL:'commercial',COSTS:'costs',ANALYTICS:'analytics',ENTERPRISE_ADMIN:'enterprise_admin'
})

const PATH_CAPABILITIES=Object.freeze([
 ['/infrastructure',PRODUCT_CAPABILITIES.INFRASTRUCTURE],
 ['/mipe',PRODUCT_CAPABILITIES.MIPE],
 ['/mirfe',PRODUCT_CAPABILITIES.MIRFE],
 ['/irrigation',PRODUCT_CAPABILITIES.IRRIGATION],
 ['/inventory',PRODUCT_CAPABILITIES.INVENTORY],
 ['/finished-goods',PRODUCT_CAPABILITIES.INVENTORY],
 ['/sales',PRODUCT_CAPABILITIES.COMMERCIAL],
 ['/costs',PRODUCT_CAPABILITIES.COSTS],
 ['/insights',PRODUCT_CAPABILITIES.ANALYTICS],
 ['/sync',PRODUCT_CAPABILITIES.ENTERPRISE_ADMIN],
 ['/migration',PRODUCT_CAPABILITIES.ENTERPRISE_ADMIN],
 ['/diagnostics',PRODUCT_CAPABILITIES.ENTERPRISE_ADMIN]
])

export function mapRemoteEntitlement(row={}){
 return Object.freeze({
  id:text(row.id),organizationId:text(row.organization_id||row.organizationId||row.companyId),capability:text(row.capability),status:text(row.status||'active'),
  startsAt:text(row.starts_at||row.startsAt)||null,endsAt:text(row.ends_at||row.endsAt)||null,source:text(row.source||'contract'),updatedAt:text(row.updated_at||row.updatedAt)
 })
}

export function capabilityForPath(path=''){
 const pathname=text(path).split('?')[0]
 return PATH_CAPABILITIES.find(([prefix])=>pathname===prefix||pathname.startsWith(`${prefix}/`))?.[1]||''
}

function isActive(entitlement,nowMs){
 if(entitlement.status!=='active')return false
 const starts=entitlement.startsAt?Date.parse(entitlement.startsAt):NaN
 const ends=entitlement.endsAt?Date.parse(entitlement.endsAt):NaN
 if(Number.isFinite(starts)&&starts>nowMs)return false
 if(Number.isFinite(ends)&&ends<=nowMs)return false
 return true
}

export function resolveEntitlement(state,capability,{companyId=state?.currentContext?.companyId||'',now=Date.now()}={}){
 const requested=text(capability)
 if(!requested)return Object.freeze({allowed:true,capability:'',companyId:text(companyId),source:'not-required',entitlementId:null})
 const organizationId=text(companyId)
 if(!organizationId){
  const installation=(state?.companies||[]).length===0&&(state?.memberships||[]).length===0
  return Object.freeze({allowed:installation,capability:requested,companyId:'',source:installation?'installation':'missing-organization',entitlementId:null})
 }
 const contracts=list(state?.entitlements).map(mapRemoteEntitlement).filter(item=>item.organizationId===organizationId)
 if(contracts.length===0)return Object.freeze({allowed:true,capability:requested,companyId:organizationId,source:'legacy-grandfathered',entitlementId:null})
 const explicit=contracts.filter(item=>item.capability===requested)
 const denied=explicit.find(item=>item.status!=='active')
 if(denied)return Object.freeze({allowed:false,capability:requested,companyId:organizationId,source:'explicit-deny',entitlementId:denied.id||null})
 const granted=explicit.find(item=>isActive(item,Number(now)))||contracts.find(item=>item.capability==='*'&&isActive(item,Number(now)))
 return Object.freeze({allowed:Boolean(granted),capability:requested,companyId:organizationId,source:granted?'contract':'not-entitled',entitlementId:granted?.id||null})
}

export function hasEntitlement(state,capability,options){return resolveEntitlement(state,capability,options).allowed}
export function requireEntitlement(state,capability,options){const result=resolveEntitlement(state,capability,options);if(!result.allowed)throw new Error(`La organización no tiene habilitada la capability ${result.capability}.`);return result}
