import{activeOrganizationId,assertActiveOrganization,explicitOrganizationId}from'./organizationOwnership.js'

export const GENETIC_CLASSIFICATIONS=Object.freeze({THC:'THC',CBD:'CBD',MIXED:'MIXED',OTHER:'OTHER',UNSPECIFIED:'UNSPECIFIED'})
const text=value=>String(value??'').trim()
const numberOrNull=value=>value===''||value===null||value===undefined?null:Number.isFinite(Number(value))?Number(value):null

export function normalizeGeneticProfile(profile={},state={}){
 const organizationId=explicitOrganizationId(profile)||activeOrganizationId(state)
 assertActiveOrganization(state,organizationId,{label:'La genética'})
 const name=text(profile.name)
 if(!name)throw new Error('La genética necesita nombre.')
 const classification=Object.values(GENETIC_CLASSIFICATIONS).includes(profile.classification)?profile.classification:GENETIC_CLASSIFICATIONS.UNSPECIFIED
 return Object.freeze({
  ...profile,
  id:text(profile.id),
  organizationId,
  name,
  color:text(profile.color)||'#2e7d32',
  classification,
  agronomicParameters:Object.freeze({
   vegetativeDays:numberOrNull(profile.agronomicParameters?.vegetativeDays),
   floweringDays:numberOrNull(profile.agronomicParameters?.floweringDays),
   thcTargetPercent:numberOrNull(profile.agronomicParameters?.thcTargetPercent),
   cbdTargetPercent:numberOrNull(profile.agronomicParameters?.cbdTargetPercent),
   ...(profile.agronomicParameters||{})
  }),
  active:profile.active!==false,
  archivedAt:profile.archivedAt||null,
  createdAt:profile.createdAt||null,
  updatedAt:profile.updatedAt||null
 })
}

export function geneticProfilesForOrganization(state,organizationId=activeOrganizationId(state)){
 return(state.genetics||[]).filter(profile=>{
  const owner=explicitOrganizationId(profile)
  if(owner)return owner===organizationId
  return(state.companies||[]).length<=1
 }).map(profile=>normalizeGeneticProfile(profile,{...state,currentContext:{...(state.currentContext||{}),companyId:organizationId}}))
}

export function assertUniqueGeneticName(state,{organizationId,name,excludeId=''}={}){
 const normalized=text(name).toLocaleLowerCase()
 if(!normalized)throw new Error('La genética necesita nombre.')
 if(geneticProfilesForOrganization(state,organizationId).some(item=>item.id!==excludeId&&item.name.toLocaleLowerCase()===normalized))throw new Error('Ya existe una genética con ese nombre en la organización.')
 return true
}

export function createGeneticProfile(state,input,{id=crypto.randomUUID(),now=new Date().toISOString()}={}){
 const organizationId=activeOrganizationId(state)
 assertUniqueGeneticName(state,{organizationId,name:input?.name})
 return normalizeGeneticProfile({...input,id,organizationId,active:true,createdAt:now,updatedAt:now},state)
}

export function updateGeneticProfile(state,id,patch,{now=new Date().toISOString()}={}){
 const organizationId=activeOrganizationId(state)
 const current=geneticProfilesForOrganization(state,organizationId).find(item=>item.id===id)
 if(!current)throw new Error('La genética no existe en la organización activa.')
 assertUniqueGeneticName(state,{organizationId,name:patch?.name??current.name,excludeId:id})
 return normalizeGeneticProfile({...current,...patch,id:current.id,organizationId:current.organizationId,createdAt:current.createdAt,updatedAt:now},state)
}

export function archiveGeneticProfile(state,id,{now=new Date().toISOString()}={}){
 const organizationId=activeOrganizationId(state)
 const current=geneticProfilesForOrganization(state,organizationId).find(item=>item.id===id)
 if(!current)throw new Error('La genética no existe en la organización activa.')
 return Object.freeze({...current,active:false,archivedAt:now,updatedAt:now})
}

export function upsertGeneticProfile(state,profile){
 const items=state.genetics||[],owner=profile.organizationId
 const index=items.findIndex(item=>item.id===profile.id&&(explicitOrganizationId(item)||owner)===owner)
 return{...state,genetics:index<0?[...items,profile]:items.map((item,position)=>position===index?profile:item)}
}
