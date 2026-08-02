const text=value=>String(value??'').trim().toLowerCase()

export const DEFAULT_SOURCE_PRIORITY=Object.freeze({
 ledger:600,
 'iot-certified':500,
 iot:450,
 user:400,
 facility:350,
 domain:300,
 passport:200,
 'passport-reference':0
})

function canonical(value){
 if(Array.isArray(value))return value.map(canonical)
 if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])]))
 return value
}

export function stableFingerprint(value){
 return JSON.stringify(canonical(value))
}

export function sourcePriority(value,{priorities=DEFAULT_SOURCE_PRIORITY,fallback=100}={}){
 const source=text(value?.metadata?.source??value?.source)
 return priorities[source]??fallback
}

export function objectVersion(value){
 const raw=value?.metadata?.objectVersion??value?.metadata?.version??value?.version??0
 const numeric=Number(raw)
 return Number.isFinite(numeric)?numeric:0
}

export function compareProjectionCandidates(left,right,options={}){
 if(!left&&!right)return 0
 if(!left)return-1
 if(!right)return 1
 const leftTime=Date.parse(left.updatedAt??left.createdAt??0)
 const rightTime=Date.parse(right.updatedAt??right.createdAt??0)
 if(leftTime!==rightTime)return leftTime>rightTime?1:-1
 const leftPriority=sourcePriority(left,options),rightPriority=sourcePriority(right,options)
 if(leftPriority!==rightPriority)return leftPriority>rightPriority?1:-1
 const leftVersion=objectVersion(left),rightVersion=objectVersion(right)
 if(leftVersion!==rightVersion)return leftVersion>rightVersion?1:-1
 const leftFingerprint=stableFingerprint(left),rightFingerprint=stableFingerprint(right)
 if(leftFingerprint===rightFingerprint)return 0
 return leftFingerprint>rightFingerprint?1:-1
}

export function preferredProjectionCandidate(existing,incoming,{organizationError='Los candidatos pertenecen a organizaciones diferentes',...options}={}){
 if(!existing)return incoming
 if(!incoming)return existing
 if(existing.organizationId&&incoming.organizationId&&existing.organizationId!==incoming.organizationId)throw new Error(organizationError)
 return compareProjectionCandidates(incoming,existing,options)>=0?incoming:existing
}
