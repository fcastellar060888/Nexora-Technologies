function canonicalize(value){
 if(value===null||typeof value==='string'||typeof value==='boolean')return value
 if(typeof value==='number')return Number.isFinite(value)?value:null
 if(Array.isArray(value))return value.map(canonicalize)
 if(value&&typeof value==='object'){
  const result={}
  for(const key of Object.keys(value).sort())result[key]=canonicalize(value[key])
  return result
 }
 return null
}

export function timelineEntryFingerprint(entry){
 return JSON.stringify(canonicalize(entry))
}

export function timelineEntriesEqual(left=[],right=[]){
 if(!Array.isArray(left)||!Array.isArray(right)||left.length!==right.length)return false
 for(let index=0;index<left.length;index+=1){
  if(timelineEntryFingerprint(left[index])!==timelineEntryFingerprint(right[index]))return false
 }
 return true
}
