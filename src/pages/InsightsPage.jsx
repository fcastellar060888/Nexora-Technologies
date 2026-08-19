import Card from'../components/Card'
import PageHeader from'../components/PageHeader'
import{observabilityViewForActiveOrganization}from'../domain/observability.js'
import{useStore}from'../services/store'

export default function InsightsPage(){
 const{state}=useStore(),view=observabilityViewForActiveOrganization(state),signals=[]
 for(const house of view.houses){
  const monitors=view.mirfeMonitoring.filter(x=>x.houseId===house.id)
  if(!monitors.length)continue
  const avg=key=>monitors.reduce((sum,item)=>sum+Number(item[key]||0),0)/monitors.length
  const beds=view.beds.filter(bed=>bed.houseId===house.id)
  const plants=view.plantPositions.filter(plant=>beds.some(bed=>bed.id===plant.bedId))
  const findings=view.findings.filter(finding=>plants.some(plant=>plant.id===finding.plantPositionId)&&!['Resuelto','Falso positivo'].includes(finding.status))
  const drainage=avg('drainage'),humidity=avg('humidity'),vpd=avg('vpd')
  if(drainage<10)signals.push({house,title:'Drenaje promedio bajo',detail:'Revisar pulsos, volumen aplicado, uniformidad y acumulación de sales.',metrics:`Hallazgos: ${findings.length} · HR: ${humidity.toFixed(1)}% · VPD: ${vpd.toFixed(2)} · Drenaje: ${drainage.toFixed(1)}%`})
  if(humidity>80&&findings.length)signals.push({house,title:'Riesgo sanitario por humedad alta',detail:'La humedad coincide con hallazgos activos; revisar ventilación y seguimiento MIPE.',metrics:`Hallazgos: ${findings.length} · HR: ${humidity.toFixed(1)}%`})
 }
 return <><PageHeader title="Inteligencia agronómica" subtitle="Señales de la empresa activa con evidencia MIRFE y MIPE tenant-aware."/><Card title="Señales detectadas">{signals.map((signal,index)=><div className="insight-card" key={`${signal.house.organizationId||view.organizationId}:${signal.house.id}-${index}`}><strong>{signal.house.name} · {signal.title}</strong><p>{signal.detail}</p><small>{signal.metrics}</small></div>)}{!signals.length&&<p>No hay datos suficientes o no se detectan desviaciones relevantes.</p>}</Card></>
}
