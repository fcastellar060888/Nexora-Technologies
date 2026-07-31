import{useMemo,useState}from'react'
import Card from'../components/Card'
import PageHeader from'../components/PageHeader'
import{syncStatus}from'../services/syncEngine.js'
import{applyConflictResolution,deviceSummary,resolveConflictRemote,retryAllFailed,retryMutation}from'../services/syncConflictCenter.js'
import{deviceHealth,healthAlerts}from'../services/syncHealth.js'
import{useStore}from'../services/store'

const list=value=>Array.isArray(value)?value:[]
const pretty=value=>JSON.stringify(value??null,null,2)
const date=value=>value?new Date(value).toLocaleString():'—'

function remoteRows(rows=[]){
 return list(rows).map(item=>({deviceId:item.deviceId,successRate:item.totalAttempts?Math.round(item.totalSuccesses/item.totalAttempts*100):0,failures:item.totalFailures||0,consecutiveFailures:item.consecutiveFailures||0,lastActivity:item.lastSeenAt,lastError:item.lastError||''}))
}
function remoteAlerts(rows=[]){
 return remoteRows(rows).flatMap(item=>{
  if(item.consecutiveFailures>=3)return[{severity:'high',deviceId:item.deviceId,message:`${item.consecutiveFailures} errores consecutivos`,lastError:item.lastError}]
  if(item.failures>=3&&item.successRate<70)return[{severity:'medium',deviceId:item.deviceId,message:`Salud de sincronización ${item.successRate}%`,lastError:item.lastError}]
  return[]
 })
}

export default function SyncCenterPage(){
 const{state,update,synchronize,syncRuntime}=useStore()
 const[busy,setBusy]=useState(false),[msg,setMsg]=useState(''),[selected,setSelected]=useState(''),[merged,setMerged]=useState('')
 const companyId=state.currentContext?.companyId||''
 const status=syncStatus(state)
 const queue=useMemo(()=>list(state.syncQueue).filter(item=>!companyId||item.companyId===companyId),[state.syncQueue,companyId])
 const conflicts=useMemo(()=>list(state.syncConflicts).filter(item=>(!companyId||item.companyId===companyId)&&item.status!=='resolved'),[state.syncConflicts,companyId])
 const devices=useMemo(()=>deviceSummary(state.syncQueue,companyId),[state.syncQueue,companyId])
 const localHealth=useMemo(()=>deviceHealth(state.syncHealthEvents,companyId),[state.syncHealthEvents,companyId])
 const serverHealth=useMemo(()=>remoteRows(list(state.syncDeviceHealth).filter(item=>!companyId||item.companyId===companyId)),[state.syncDeviceHealth,companyId])
 const health=serverHealth.length?serverHealth:localHealth
 const alerts=useMemo(()=>serverHealth.length?remoteAlerts(state.syncDeviceHealth):healthAlerts(state.syncHealthEvents,companyId),[serverHealth.length,state.syncDeviceHealth,state.syncHealthEvents,companyId])
 const current=conflicts.find(item=>item.id===selected)||conflicts[0]||null

 async function syncNow(){
  setBusy(true);setMsg('')
  try{
   const result=await synchronize('sync-center',{force:true})
   if(result?.reason==='other-tab-leader')setMsg('Otra pestaña está sincronizando. Esta vista recibirá el resultado automáticamente.')
   else if(result?.error)throw result.error
   else setMsg(`Sincronización completa: ${result?.pushed||0} enviados y ${result?.pulled||0} recibidos.`)
  }catch(error){setMsg(error instanceof Error?error.message:'No fue posible sincronizar')}
  finally{setBusy(false)}
 }
 function retry(id){update(prev=>retryMutation(prev,id),{action:'Reintento de mutación',module:'Sincronización',sync:false})}
 function retryFailed(){update(prev=>retryAllFailed(prev,companyId),{action:'Reintento masivo',module:'Sincronización',sync:false})}
 async function resolve(strategy){
  if(!current)return
  let payload=null
  if(strategy==='merged'){try{payload=JSON.parse(merged)}catch{setMsg('La combinación debe ser JSON válido.');return}}
  setBusy(true);setMsg('')
  try{
   await resolveConflictRemote(current,{strategy,mergedPayload:payload})
   const actor=list(state.users).find(user=>user.activeSession)?.name||'Administrador'
   update(prev=>applyConflictResolution(prev,current.id,{strategy,mergedPayload:payload,resolvedBy:actor}),{action:'Resolución de conflicto',module:'Sincronización',detail:`${current.collection}/${current.recordId}: ${strategy}`,sync:false})
   setSelected('');setMerged('');setMsg('Conflicto resuelto correctamente.')
  }catch(error){setMsg(error instanceof Error?error.message:'No fue posible resolver el conflicto')}
  finally{setBusy(false)}
 }

 return <>
  <PageHeader title="Centro de sincronización" subtitle="Estado multi-dispositivo, coordinación entre pestañas, cola offline y conflictos por organización."/>
  <div className="content-grid four"><Card title="Pendientes"><strong>{status.pending}</strong></Card><Card title="Fallidos"><strong>{status.failed}</strong></Card><Card title="Conflictos"><strong>{status.conflicts}</strong></Card><Card title="Estado global"><strong>{syncRuntime.running?'Sincronizando':syncRuntime.lastError?'Error':status.lastSyncedAt?'Al día':'Sin sincronizar'}</strong></Card></div>
  {alerts.length>0&&<Card title="Alertas administrativas"><div className="table-wrap"><table><thead><tr><th>Severidad</th><th>Dispositivo</th><th>Alerta</th><th>Último error</th></tr></thead><tbody>{alerts.map((item,index)=><tr key={`${item.deviceId}-${index}`}><td>{item.severity}</td><td>{item.deviceId}</td><td>{item.message}</td><td>{item.lastError||'—'}</td></tr>)}</tbody></table></div></Card>}
  <Card title="Acciones"><div className="form-actions"><button className="button primary" disabled={busy||syncRuntime.running||!companyId} onClick={syncNow}>{busy||syncRuntime.running?'Procesando…':'Sincronizar ahora'}</button><button className="button secondary" disabled={busy||!queue.some(item=>item.status==='failed')} onClick={retryFailed}>Reintentar fallidos</button></div>{!companyId&&<p>Selecciona una empresa para sincronizar.</p>}{msg&&<p role="status">{msg}</p>}</Card>
  <div className="content-grid two">
   <Card title="Salud por dispositivo"><div className="table-wrap"><table><thead><tr><th>Dispositivo</th><th>Éxito</th><th>Fallos</th><th>Consecutivos</th><th>Última actividad</th></tr></thead><tbody>{health.map(item=><tr key={item.deviceId}><td>{item.deviceId}</td><td>{item.successRate}%</td><td>{item.failures}</td><td>{item.consecutiveFailures}</td><td>{date(item.lastActivity)}</td></tr>)}{health.length===0&&<tr><td colSpan="5">Aún no hay historial de salud.</td></tr>}</tbody></table></div></Card>
   <Card title="Actividad de cola por dispositivo"><div className="table-wrap"><table><thead><tr><th>Dispositivo</th><th>Pendientes</th><th>Fallidos</th><th>Conflictos</th><th>Última actividad</th></tr></thead><tbody>{devices.map(item=><tr key={item.deviceId}><td>{item.deviceId}</td><td>{item.pending}</td><td>{item.failed}</td><td>{item.conflicts}</td><td>{date(item.lastActivity)}</td></tr>)}{devices.length===0&&<tr><td colSpan="5">Sin actividad registrada.</td></tr>}</tbody></table></div></Card>
  </div>
  <Card title="Mutaciones pendientes o fallidas"><div className="table-wrap"><table><thead><tr><th>Colección</th><th>Registro</th><th>Estado</th><th>Intentos</th><th></th></tr></thead><tbody>{queue.filter(item=>['pending','failed'].includes(item.status)).map(item=><tr key={item.id}><td>{item.collection}</td><td>{item.recordId}</td><td>{item.status}</td><td>{item.attempts||0}</td><td><button className="button secondary" onClick={()=>retry(item.id)}>Reintentar</button></td></tr>)}{!queue.some(item=>['pending','failed'].includes(item.status))&&<tr><td colSpan="5">La cola está al día.</td></tr>}</tbody></table></div></Card>
  <Card title="Conflictos abiertos"><div className="table-wrap"><table><thead><tr><th>Colección</th><th>Registro</th><th>Versión local</th><th>Versión remota</th><th>Fecha</th><th></th></tr></thead><tbody>{conflicts.map(item=><tr key={item.id}><td>{item.collection}</td><td>{item.recordId}</td><td>{item.localVersion}</td><td>{item.remoteVersion}</td><td>{date(item.createdAt)}</td><td><button className="button secondary" onClick={()=>{setSelected(item.id);setMerged(pretty({...item.remotePayload,...item.localPayload}))}}>Revisar</button></td></tr>)}{conflicts.length===0&&<tr><td colSpan="6">No hay conflictos abiertos.</td></tr>}</tbody></table></div></Card>
  {current&&<Card title={`Resolver ${current.collection}/${current.recordId}`}><div className="content-grid two"><div><h3>Versión local</h3><pre>{pretty(current.localPayload)}</pre></div><div><h3>Versión remota</h3><pre>{pretty(current.remotePayload)}</pre></div></div><label>Combinación manual<textarea rows="12" value={merged} onChange={event=>setMerged(event.target.value)}/></label><div className="form-actions"><button className="button secondary" disabled={busy} onClick={()=>resolve('remote')}>Conservar remota</button><button className="button secondary" disabled={busy} onClick={()=>resolve('local')}>Conservar local</button><button className="button primary" disabled={busy} onClick={()=>resolve('merged')}>Guardar combinación</button></div></Card>}
 </>
}
