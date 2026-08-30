const providers=new Map()
const text=value=>String(value??'').trim()
const frozen=value=>Object.freeze(value)

function normalizeCheck(providerId,check,index){
 const id=text(check?.id)||`${providerId}:${index+1}`
 const status=check?.status===false?false:true
 const level=text(check?.level)||(status?'ok':'warning')
 return frozen({id:`${providerId}:${id}`,providerId,name:text(check?.name)||providerId,status,detail:text(check?.detail)||'Sin detalle',level})
}

export function registerCoreHealthProvider(providerId,provider){
 const id=text(providerId)
 if(!id)throw new Error('providerId es requerido')
 if(typeof provider!=='function')throw new Error('provider debe ser una función')
 if(providers.has(id))throw new Error(`Proveedor de salud ya registrado: ${id}`)
 providers.set(id,provider)
 return()=>providers.delete(id)
}

export function getCoreHealthSnapshot(context={}){
 const checks=[]
 for(const[id,provider]of[...providers.entries()].sort(([a],[b])=>a.localeCompare(b))){
  try{
   const result=provider(frozen({...context}))
   const items=Array.isArray(result)?result:[result]
   items.filter(Boolean).forEach((check,index)=>checks.push(normalizeCheck(id,check,index)))
  }catch(error){
   checks.push(frozen({id:`${id}:provider-error`,providerId:id,name:`Core: ${id}`,status:false,detail:text(error?.message)||'Proveedor de salud falló',level:'error'}))
  }
 }
 if(checks.length===0)checks.push(frozen({id:'core-health-registry:no-providers',providerId:'core-health-registry',name:'Core Health Registry',status:false,detail:'No hay proveedores de salud del Core registrados en este runtime.',level:'warning'}))
 const errors=checks.filter(check=>check.level==='error'||check.status===false&&check.level==='critical').length
 const warnings=checks.filter(check=>check.level==='warning').length
 return frozen({checks:frozen(checks),providers:providers.size,errors,warnings,status:errors?'critical':warnings?'degraded':'healthy'})
}

export function resetCoreHealthRegistryForTests(){providers.clear()}
