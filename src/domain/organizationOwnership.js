const text=value=>String(value??'').trim()
const list=value=>Array.isArray(value)?value:[]

export const explicitOrganizationId=value=>text(value?.organizationId||value?.companyId||value?._organizationId)

export function activeOrganizationId(state){
 const active=text(state?.currentContext?.companyId)
 if(active)return active
 const companies=list(state?.companies)
 if(companies.length===1)return text(companies[0]?.id)
 if(companies.length===0)return'local-installation'
 throw new Error('No existe una empresa activa inequívoca.')
}

export function resolveOrganizationId(state,{record=null,siteId=null,label='objeto'}={}){
 const explicit=explicitOrganizationId(record)
 const resolvedSiteId=text(siteId||record?.siteId)
 const site=resolvedSiteId?list(state?.sites).find(item=>item?.id===resolvedSiteId):null
 const siteOwner=explicitOrganizationId(site)
 if(explicit&&siteOwner&&explicit!==siteOwner)throw new Error(`Ownership organizacional contradictorio para ${label}.`)
 if(explicit)return explicit
 if(siteOwner)return siteOwner
 const companies=list(state?.companies)
 if(companies.length===1)return text(companies[0]?.id)
 if(companies.length===0)return'local-installation'
 throw new Error(`No se puede determinar organizationId de ${label} en un estado multiempresa.`)
}

export function assertActiveOrganization(state,organizationId,{label='objeto'}={}){
 const active=activeOrganizationId(state),owner=text(organizationId)
 if(!owner)throw new Error(`${label} no tiene organizationId.`)
 if(owner!==active)throw new Error(`${label} pertenece a otra empresa.`)
 return owner
}
