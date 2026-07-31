const list=value=>Array.isArray(value)?value:[]
const now=()=>new Date().toISOString()

export function appendHealthEvent(state,event,limit=500){
 const entry={id:crypto.randomUUID(),createdAt:now(),status:'success',reason:'automatic',deviceId:'',companyId:'',durationMs:0,pushed:0,pulled:0,error:'',...event}
 return{...state,syncHealthEvents:[...list(state.syncHealthEvents),entry].slice(-limit)}
}

export function deviceHealth(events=[],companyId='',at=Date.now()){
 const groups=new Map()
 for(const event of list(events).filter(x=>!companyId||x.companyId===companyId)){
  const key=event.deviceId||'desconocido'
  const item=groups.get(key)||{deviceId:key,total:0,successes:0,failures:0,consecutiveFailures:0,lastStatus:'',lastActivity:'',lastError:'',stale:false}
  item.total++
  if(event.status==='success'){item.successes++;item.consecutiveFailures=0}else if(event.status==='error'){item.failures++;item.consecutiveFailures++}
  item.lastStatus=event.status
  item.lastActivity=event.createdAt
  item.lastError=event.error||''
  groups.set(key,item)
 }
 return[...groups.values()].map(item=>({...item,successRate:item.total?Math.round(item.successes/item.total*100):0,stale:!item.lastActivity||at-Date.parse(item.lastActivity)>24*60*60*1000})).sort((a,b)=>String(b.lastActivity).localeCompare(String(a.lastActivity)))
}

export function healthAlerts(events=[],companyId=''){
 return deviceHealth(events,companyId).flatMap(item=>{
  const alerts=[]
  if(item.consecutiveFailures>=3)alerts.push({severity:'high',deviceId:item.deviceId,message:`${item.consecutiveFailures} errores consecutivos`,lastError:item.lastError})
  else if(item.failures>=3&&item.successRate<70)alerts.push({severity:'medium',deviceId:item.deviceId,message:`Salud de sincronización ${item.successRate}%`,lastError:item.lastError})
  if(item.stale)alerts.push({severity:'low',deviceId:item.deviceId,message:'Sin actividad en las últimas 24 horas',lastError:''})
  return alerts
 })
}
