const text=value=>String(value??'').trim()
const frozenList=value=>Object.freeze([...value])
const positiveInteger=(value,label)=>{const number=Number(value);if(!Number.isSafeInteger(number)||number<1)throw new Error(`${label} debe ser un entero positivo`);return number}

export function createProjectionCheckpointStore({checkpoints=[],maxCompleted=10000}={}){
 const capacity=positiveInteger(maxCompleted,'maxCompleted')
 const completed=new Set(),claims=new Map()
 for(const value of checkpoints){const key=text(value);if(!key)throw new Error('Los checkpoints iniciales deben ser identificadores válidos');completed.add(key)}
 if(completed.size>capacity)throw new Error(`Los checkpoints iniciales exceden maxCompleted (${capacity})`)
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
  if(!completed.has(key)&&completed.size>=capacity)throw new Error(`Projection Checkpoint Store alcanzó maxCompleted (${capacity}); compacte o persista antes de continuar`)
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
 function compact({remove=[]}={}){
  if(claims.size)throw new Error('No se puede compactar mientras existan claims activos')
  if(!Array.isArray(remove))throw new Error('compact requiere una lista remove')
  const normalized=[...new Set(remove.map(text))]
  if(normalized.some(value=>!value))throw new Error('Los checkpoints a compactar deben ser válidos')
  let removed=0
  for(const key of normalized)if(completed.delete(key))removed+=1
  return Object.freeze({removed,remaining:completed.size,maxCompleted:capacity})
 }
 function hydrate(values,{replace=false}={}){
  if(!Array.isArray(values))throw new Error('hydrate requiere una lista de checkpoints')
  if(claims.size)throw new Error('No se puede hidratar mientras existan claims activos')
  const normalized=values.map(text)
  if(normalized.some(value=>!value))throw new Error('Los checkpoints hidratados deben ser válidos')
  const next=new Set(replace?[]:completed)
  normalized.forEach(value=>next.add(value))
  if(next.size>capacity)throw new Error(`La hidratación excede maxCompleted (${capacity})`)
  if(replace)completed.clear()
  normalized.forEach(value=>completed.add(value))
  return snapshot()
 }
 function snapshot(){return Object.freeze({completed:frozenList([...completed].sort()),activeClaims:frozenList([...claims.keys()].sort()),maxCompleted:capacity,remainingCapacity:capacity-completed.size})}
 return Object.freeze({has,claim,complete,release,compact,hydrate,snapshot})
}

export function isProjectionCheckpointStore(value){return Boolean(value&&typeof value.has==='function'&&typeof value.claim==='function'&&typeof value.complete==='function'&&typeof value.release==='function'&&typeof value.compact==='function'&&typeof value.snapshot==='function')}
