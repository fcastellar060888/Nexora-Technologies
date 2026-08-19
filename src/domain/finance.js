import{activeOrganizationId,explicitOrganizationId}from'./organizationOwnership.js'

const list=value=>Array.isArray(value)?value:[]
const text=value=>String(value??'').trim()
const codeOf=value=>text(value).toUpperCase()

function positive(value,label){const n=Number(value);if(!Number.isFinite(n)||n<=0)throw new Error(`${label} debe ser mayor que cero.`);return n}
function siteOwners(state,siteId){
 const id=text(siteId)
 return[...new Set(list(state?.sites).filter(site=>text(site?.id)===id).map(explicitOrganizationId).filter(Boolean))]
}
function financialRecordOrganizationId(state,record,{label='registro financiero',allowSiteInference=true}={}){
 const explicit=explicitOrganizationId(record)
 const siteId=text(record?.siteId)
 if(explicit){
  if(siteId){const owners=siteOwners(state,siteId);if(owners.length&&!owners.includes(explicit))return''}
  return explicit
 }
 if(allowSiteInference&&siteId){
  const owners=siteOwners(state,siteId)
  if(owners.length===1)return owners[0]
  if(owners.length>1)return''
 }
 const companies=list(state?.companies)
 if(companies.length===1)return text(companies[0]?.id)
 if(companies.length===0)return'local-installation'
 return''
}
function assertRequestedOrganization(input,organizationId,label){
 const requested=explicitOrganizationId(input)
 if(requested&&requested!==organizationId)throw new Error(`${label} pertenece a otra empresa.`)
}
function resolveScopedSite(state,siteId,organizationId){
 const id=text(siteId)
 if(!id)throw new Error('Selecciona una sede válida.')
 const candidates=list(state?.sites).map((site,index)=>({site,index})).filter(candidate=>text(candidate.site?.id)===id)
 const matches=candidates.filter(candidate=>financialRecordOrganizationId(state,candidate.site,{label:'sede',allowSiteInference:false})===organizationId)
 if(matches.length>1)throw new Error('La sede tiene identidad duplicada o ambigua dentro de la empresa activa.')
 if(matches.length===0)throw new Error('La sede pertenece a otra empresa o no tiene ownership inequívoco.')
 return matches[0]
}
function resolveScopedCurrency(state,code,organizationId){
 const identity=codeOf(code)
 if(!identity)throw new Error('Selecciona una moneda válida.')
 const candidates=list(state?.currencies).map((currency,index)=>({currency,index})).filter(candidate=>codeOf(candidate.currency?.code)===identity)
 const matches=candidates.filter(candidate=>financialRecordOrganizationId(state,candidate.currency,{label:'moneda',allowSiteInference:false})===organizationId)
 if(matches.length>1)throw new Error('La moneda tiene identidad duplicada o ambigua dentro de la empresa activa.')
 if(matches.length===0)throw new Error('La moneda pertenece a otra empresa o no tiene ownership inequívoco.')
 return matches[0]
}
function scoped(state,collection,organizationId,options={}){
 return list(state?.[collection]).flatMap(record=>{
  const owner=financialRecordOrganizationId(state,record,options)
  return owner===organizationId?[record.organizationId?record:{...record,organizationId:owner}]:[]
 })
}

export function financialViewForActiveOrganization(state){
 const organizationId=activeOrganizationId(state)
 return{
  organizationId,
  currencies:scoped(state,'currencies',organizationId,{label:'moneda',allowSiteInference:false}),
  costEntries:scoped(state,'costEntries',organizationId,{label:'costo'}),
  sites:scoped(state,'sites',organizationId,{label:'sede',allowSiteInference:false}),
  propagationBatches:scoped(state,'propagationBatches',organizationId,{label:'lote productivo'})
 }
}

export function currencyForActiveOrganization(state,code,{requireActive=true}={}){
 const organizationId=activeOrganizationId(state)
 const{currency}=resolveScopedCurrency(state,code,organizationId)
 if(requireActive&&currency.active===false)throw new Error('La moneda seleccionada está inactiva para la empresa actual.')
 return currency.organizationId?currency:{...currency,organizationId}
}

export function createCurrency(state,input={}){
 const organizationId=activeOrganizationId(state)
 assertRequestedOrganization(input,organizationId,'La moneda')
 const code=codeOf(input.code)
 if(!code)throw new Error('El código de moneda es obligatorio.')
 const rateToBase=positive(input.rateToBase,'La tasa a moneda base')
 const duplicates=list(state?.currencies).filter(currency=>codeOf(currency?.code)===code&&financialRecordOrganizationId(state,currency,{label:'moneda',allowSiteInference:false})===organizationId)
 if(duplicates.length)throw new Error('La moneda ya existe dentro de la empresa activa.')
 const currency={...input,code,organizationId,name:text(input.name),symbol:text(input.symbol),rateToBase,active:input.active!==false}
 return{...state,currencies:[...list(state?.currencies),currency]}
}

export function updateCurrencyRate(state,input={}){
 const organizationId=activeOrganizationId(state)
 assertRequestedOrganization(input,organizationId,'La moneda')
 const{currency,index}=resolveScopedCurrency(state,input.code,organizationId)
 const rateToBase=positive(input.rateToBase,'La tasa a moneda base')
 const updated={...currency,organizationId,rateToBase}
 return{...state,currencies:list(state?.currencies).map((item,itemIndex)=>itemIndex===index?updated:item)}
}

export function createCostEntry(state,input={}){
 const organizationId=activeOrganizationId(state)
 assertRequestedOrganization(input,organizationId,'El costo')
 const{site}=resolveScopedSite(state,input.siteId,organizationId)
 const amount=positive(input.amount,'El valor del costo')
 const id=text(input.id)||crypto.randomUUID()
 const duplicates=list(state?.costEntries).filter(entry=>text(entry?.id)===id&&financialRecordOrganizationId(state,entry,{label:'costo'})===organizationId)
 if(duplicates.length)throw new Error('El costo tiene identidad duplicada dentro de la empresa activa.')
 const entry={...input,id,organizationId,siteId:site.id,date:input.date||new Date().toISOString().slice(0,10),category:text(input.category)||'Otro',description:text(input.description),amount,batch:text(input.batch),createdAt:input.createdAt||new Date().toISOString()}
 return{...state,costEntries:[...list(state?.costEntries),entry]}
}

export function financialMetrics(state){
 const view=financialViewForActiveOrganization(state)
 const totalCost=view.costEntries.reduce((sum,entry)=>sum+Number(entry.amount||0),0)
 const packedGrams=view.propagationBatches.reduce((sum,lot)=>sum+Number(lot?.productionLedger?.Empaque?.outputGrams||0),0)
 return{totalCost,packedGrams,costPerGram:packedGrams>0?totalCost/packedGrams:0}
}
