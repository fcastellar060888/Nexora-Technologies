const legacyCompanyNames=new Set(['cannapa sas','canapa sas','cannapa','canapa'])
const clean=value=>String(value||'').trim().toLowerCase()

export function cleanupLegacySeed(state={}){
 const companies=Array.isArray(state.companies)?state.companies:[]
 const sites=Array.isArray(state.sites)?state.sites:[]
 const removable=new Set(companies.filter(company=>legacyCompanyNames.has(clean(company.name))&&!sites.some(site=>site.companyId===company.id)).map(company=>company.id))
 if(!removable.size)return state
 const currentContext={...(state.currentContext||{})}
 if(removable.has(currentContext.companyId))currentContext.companyId=''
 return{...state,companies:companies.filter(company=>!removable.has(company.id)),currentContext}
}
