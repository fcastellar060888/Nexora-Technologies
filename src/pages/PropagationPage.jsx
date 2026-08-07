import{useNavigate}from'react-router-dom'
import Card from'../components/Card'
import PageHeader from'../components/PageHeader'
import PurposeAwarePropagationForm from'../components/PurposeAwarePropagationForm.jsx'
import{useStore}from'../services/store'
import{survivalMetrics}from'../domain/lifecycle'
import{bankCapacity}from'../domain/spaceMetrics'
import{PROPAGATION_PURPOSE_LABELS}from'../domain/propagationPurpose.js'

export default function PropagationPage(){
 const{state,update}=useStore(),nav=useNavigate()
 const activeBanks=state.propagationBanks.filter(item=>item.active!==false)
 const liveUnits=state.propagationUnits.filter(item=>!['Muerto','Descartado','Promovido','Trasplantado'].includes(item.status))
 return <>
  <PageHeader title="Propagación y lotes" subtitle="Genera esquejes desde Abuelas o Madres individuales, define su propósito y asígnalos a bancos ya configurados en Infraestructura."/>
  <div className="kpi-grid">{[['Bancos activos',activeBanks.length],['Capacidad total',activeBanks.reduce((sum,item)=>sum+bankCapacity(item.trays||[{quantity:item.trayCount,cellsPerTray:item.cavitiesPerTray}]),0)],['Esquejes',state.propagationUnits.length],['Vivos / activos',liveUnits.length]].map(([label,value])=><Card className="kpi-card" key={label}><span>{label}</span><strong>{value}</strong></Card>)}</div>
  {!activeBanks.length?<Card title="Configura primero la infraestructura de propagación"><div className="empty-state"><strong>No hay bancos activos disponibles</strong><p>Los bancos y bandejas se crean en Infraestructura, junto con naves y camas. Cuando existan, aparecerán aquí para asignar esquejes.</p><button className="button primary" onClick={()=>nav('/houses')}>Ir a Infraestructura</button></div></Card>:<Card title="Crear corte de propagación" subtitle="El propósito determina si los esquejes entrarán a producción, renovarán material vegetal o permanecerán en evaluación."><PurposeAwarePropagationForm state={state} update={update} onCreated={batch=>nav(`/lots/${batch.id}`)}/></Card>}
  <Card title="Lotes por propósito"><div className="table-scroll"><table><thead><tr><th>Lote</th><th>Origen individual</th><th>Propósito</th><th>Banco</th><th>Fase</th><th>Vivos</th><th>Supervivencia</th><th></th></tr></thead><tbody>{state.propagationBatches.map(item=>{const units=state.propagationUnits.filter(unit=>unit.batchId===item.id),metrics=survivalMetrics(units),bank=state.propagationBanks.find(value=>value.id===(item.bankId||item.propagationBankId));return <tr key={item.id}><td><strong>{item.code}</strong></td><td>{item.sourcePlantId||state.motherPlants.find(mother=>mother.id===item.motherPlantId)?.lotCode||'Histórico'}</td><td>{item.purposeLabel||PROPAGATION_PURPOSE_LABELS[item.purpose]||'Lote productivo histórico'}</td><td>{bank?.name||item.propagationBankName||'Sin asignar'}{bank?.active===false?' · Archivado':''}</td><td>{item.phase}</td><td>{item.activeQuantity??metrics.alive}</td><td>{metrics.survivalPct}%</td><td><button onClick={()=>nav(`/lots/${item.id}`)}>Abrir</button></td></tr>})}</tbody></table></div></Card>
 </>
}
