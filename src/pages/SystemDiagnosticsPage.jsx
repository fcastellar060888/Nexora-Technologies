import{useMemo,useState}from'react'
import Card from'../components/Card'
import PageHeader from'../components/PageHeader'
import{diagnosticStateForActiveOrganization}from'../domain/observability.js'
import{runDiagnostics}from'../domain/diagnostics'
import{cacheDiagnostics,cleanupLightweightCache}from'../services/lightweightCache.js'
import{useStore}from'../services/store'

const size=value=>value<1024?`${value} B`:value<1024*1024?`${(value/1024).toFixed(1)} KB`:`${(value/1024/1024).toFixed(2)} MB`

export default function SystemDiagnosticsPage(){
 const{state}=useStore(),[revision,setRevision]=useState(0)
 const diagnosticState=diagnosticStateForActiveOrganization(state),companyId=diagnosticState.currentContext?.companyId||''
 const checks=runDiagnostics(diagnosticState),errors=checks.filter(x=>x.level==='error').length,warnings=checks.filter(x=>x.level==='warning').length
 const cache=useMemo(()=>cacheDiagnostics(localStorage,{companyId}),[revision,companyId])
 function cleanup(){cleanupLightweightCache(localStorage,{companyId});setRevision(x=>x+1)}
 return <><PageHeader title="Diagnóstico del sistema" subtitle="Integridad de datos y caché offline de la empresa activa antes del piloto."/><div className="kpi-grid"><Card className="kpi-card"><span>Comprobaciones</span><strong>{checks.length}</strong></Card><Card className="kpi-card"><span>Errores</span><strong className={errors?'warn':'ok'}>{errors}</strong></Card><Card className="kpi-card"><span>Advertencias</span><strong className={warnings?'warn':'ok'}>{warnings}</strong></Card><Card className="kpi-card"><span>Caché offline</span><strong>{size(cache.totalBytes)}</strong></Card></div><Card title="Almacenamiento offline"><div className="form-actions"><button className="button secondary" onClick={cleanup}>Limpiar cachés vencidas de esta empresa</button></div><div className="table-wrap"><table><thead><tr><th>Empresa</th><th>Tamaño</th><th>Disponible</th><th>Actualizada</th></tr></thead><tbody>{cache.companies.map(item=><tr key={item.companyId}><td>{item.companyId}</td><td>{size(item.actualSizeBytes)}</td><td>{item.available?'Sí':'No'}</td><td>{item.cachedAt?new Date(item.cachedAt).toLocaleString():'—'}</td></tr>)}{cache.companies.length===0&&<tr><td colSpan="4">Aún no hay caché para la empresa activa.</td></tr>}</tbody></table></div><p>Identidad y cola offline: {size(cache.identityBytes)}. Última limpieza: {cache.lastCleanupAt?new Date(cache.lastCleanupAt).toLocaleString():'—'}.</p></Card><Card title="Resultados">{checks.map(x=><div className={`diagnostic-row ${x.level}`} key={x.name}><i>{x.status?'✓':'!'}</i><div><strong>{x.name}</strong><small>{x.detail}</small></div></div>)}</Card></>
}
