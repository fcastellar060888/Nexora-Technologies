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

export function organizationForCandidates(state,organizationIds=[]){
 const active=text(state?.currentContext?.companyId)
 const companies=list(state?.companies)
 const owners=[...new Set(list(organizationIds).map(text).filter(Boolean))]
 if(active)return active
 if(companies.length===1)return text(companies[0]?.id)
 if(companies.length>1)throw new Error('No existe una empresa activa inequívoca.')
 if(owners.length===1)return owners[0]
 if(owners.length===0)return'local-installation'
 throw new Error('La identidad es ambigua entre organizaciones y no existe contexto activo.')
}

export function resolveOrganizationId(state,{record=null,siteId=null,label='objeto'}={}){
 const explicit=explicitOrganizationId(record)
 const resolvedSiteId=text(siteId||record?.siteId)
 const siteCandidates=resolvedSiteId?list(state?.sites).filter(item=>item?.id===resolvedSiteId):[]
 const siteOwners=[...new Set(siteCandidates.map(explicitOrganizationId).filter(Boolean))]
 if(explicit&&siteOwners.length===1&&siteOwners[0]!==explicit)throw new Error(`Ownership organizacional contradictorio para ${label}.`)
 if(explicit)return explicit
 if(siteOwners.length===1)return siteOwners[0]
 if(siteOwners.length>1)throw new Error(`La sede de ${label} es ambigua entre organizaciones.`)
 const companies=list(state?.companies)
 if(companies.length===1)return text(companies[0]?.id)
 if(companies.length===0)return'local-installation'
 throw new Error(`No se puede determinar organizationId de ${label} en un estado multiempresa.`)
}

export function assertActiveOrganization(state,organizationId,{label='objeto'}={}){
 const owner=text(organizationId)
 if(!owner)throw new Error(`${label} no tiene organizationId.`)
 const active=text(state?.currentContext?.companyId),companies=list(state?.companies)
 if(active&&owner!==active)throw new Error(`${label} pertenece a otra empresa.`)
 if(!active&&companies.length===1&&owner!==text(companies[0]?.id))throw new Error(`${label} pertenece a otra empresa.`)
 if(!active&&companies.length>1)throw new Error('No existe una empresa activa inequívoca.')
 return owner
}
