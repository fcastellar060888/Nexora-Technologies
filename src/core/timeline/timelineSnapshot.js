const OMIT=Symbol('omit')

function canonicalize(value,{arrayItem=false}={}){
 if(value===null||typeof value==='string'||typeof value==='boolean')return value
 if(typeof value==='number')return Number.isFinite(value)?value:null
 if(typeof value==='undefined'||typeof value==='function'||typeof value==='symbol')return arrayItem?null:OMIT
 if(Array.isArray(value))return value.map(item=>canonicalize(item,{arrayItem:true}))
 if(value&&typeof value==='object'){
  const result={}
  for(const key of Object.keys(value).sort()){
   const normalized=canonicalize(value[key])
   if(normalized!==OMIT)result[key]=normalized
  }
  return result
 }
 return arrayItem?null:OMIT
}

export function timelineEntryFingerprint(entry){
 const normalized=canonicalize(entry)
 return JSON.stringify(normalized===OMIT?null:normalized)
}

export function timelineEntriesEqual(left=[],right=[]){
 if(!Array.isArray(left)||!Array.isArray(right)||left.length!==right.length)return false
 for(let index=0;index<left.length;index+=1){
  if(timelineEntryFingerprint(left[index])!==timelineEntryFingerprint(right[index]))return false
 }
 return true
}
