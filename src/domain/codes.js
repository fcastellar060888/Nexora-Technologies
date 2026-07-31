const norm=x=>String(x||'').trim().toUpperCase().replace(/[^A-Z0-9]+/g,'').slice(0,8)
export function nextSequence(items,predicate=()=>true){return Math.max(0,...items.filter(predicate).map(x=>Number(x.sequence)||0))+1}
export function sitePrefix(state,siteId){return norm(state.sites.find(x=>x.id===siteId)?.name).slice(0,3)||'SED'}
export function motherBusinessCode(state,item){return `${sitePrefix(state,item.siteId)}-M-${norm(state.genetics.find(x=>x.id===item.geneticId)?.name).slice(0,6)||'GEN'}-${String(item.sequence).padStart(3,'0')}`}
export function propagationBusinessCode(date,sequence){return `PROP-${String(date).replaceAll('-','')}-${String(sequence).padStart(3,'0')}`}
export function productionBusinessCode(state,siteId,date,sequence){return `${sitePrefix(state,siteId)}-${String(date).replaceAll('-','')}-${String(sequence).padStart(3,'0')}`}
