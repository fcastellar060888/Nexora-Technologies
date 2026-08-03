const text=value=>String(value??'').trim()
const frozenList=value=>Object.freeze([...value])

export function createProjectionCheckpointStore({checkpoints=[]}={}){
 const completed=new Set(),claims=new Map()
 for(const value of checkpoints){const key=text(value);if(!key)throw new Error('Los checkpoints iniciales deben ser identificadores válidos');completed.add(key)}
 function has(key){return completed.has(text(key))}
 function claim(key){
  const normalized=text(key)
  if(!normalized)throw new Error('El checkpoint requiere key')
  if(completed.has(normalized)||claims.has(normalized))return null
  const token=Object.freeze({key:normalized,claimId:`${normalized}:${crypto.randomUUID()}`})
  claims.set(normalized,token.claimId)
  return token
 }
 function assertClaim(token){
  if(!token||claims.get(text(token.key))!==text(token.claimId))throw new Error('El claim del checkpoint no está activo')
  return text(token.key)
 }
 function complete(token){
  const key=assertClaim(token)
  claims.delete(key);completed.add(key)
  return key
 }
 function release(token){
  if(!token)return false
  const key=text(token.key),claimId=text(token.claimId)
  if(claims.get(key)!==claimId)return false
  claims.delete(key)
  return true
 }
 function hydrate(values,{replace=false}={}){
  if(!Array.isArray(values))throw new Error('hydrate requiere una lista de checkpoints')
  if(claims.size)throw new Error('No se puede hidratar mientras existan claims activos')
  const normalized=values.map(text)
  if(normalized.some(value=>!value))throw new Error('Los checkpoints hidratados deben ser válidos')
  if(replace)completed.clear()
  normalized.forEach(value=>completed.add(value))
  return snapshot()
 }
 function snapshot(){return Object.freeze({completed:frozenList([...completed].sort()),activeClaims:frozenList([...claims.keys()].sort())})}
 return Object.freeze({has,claim,complete,release,hydrate,snapshot})
}

export function isProjectionCheckpointStore(value){return Boolean(value&&typeof value.has==='function'&&typeof value.claim==='function'&&typeof value.complete==='function'&&typeof value.release==='function'&&typeof value.snapshot==='function')}
