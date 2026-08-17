import Card from'../components/Card'
import PageHeader from'../components/PageHeader'
import{useIrrigationMirfeCommandStore}from'../services/irrigationMirfeCommandStore'

const avg=(arr,key)=>arr.length?arr.reduce((sum,item)=>sum+Number(item[key]||0),0)/arr.length:0

export default function MirfeDashboardPage(){
 const{state}=useIrrigationMirfeCommandStore(),context=state.currentContext
 const data=state.mirfeMonitoring.filter(item=>(!context.siteId||item.siteId===context.siteId)&&(!context.houseId||item.houseId===context.houseId)&&(!context.geneticId||item.geneticId===context.geneticId))
 const metrics=[['EC entrada',avg(data,'ecInput').toFixed(2)],['pH entrada',avg(data,'phInput').toFixed(2)],['VPD',avg(data,'vpd').toFixed(2)],['Drenaje %',avg(data,'drainPercent').toFixed(1)],['Temperatura °C',avg(data,'temp').toFixed(1)],['Humedad %',avg(data,'humidity').toFixed(1)]]
 return <><PageHeader title="Dashboard MIRFE" subtitle="Promedios tenant-aware, alertas y estado del workflow agronómico en el contexto activo."/><div className="kpi-grid">{metrics.map(([label,value])=><Card className="kpi-card" key={label}><span>{label}</span><strong>{value}</strong></Card>)}</div><div className="content-grid two"><Card title="Alertas">{[['ΔEC ≥ 0.5',data.filter(item=>Math.abs(Number(item.deltaEc||0))>=.5).length],['Drenaje < 10%',data.filter(item=>Number(item.drainPercent||0)<10).length],['VPD fuera 0.8–1.5',data.filter(item=>Number(item.vpd||0)<.8||Number(item.vpd||0)>1.5).length],['Correcciones abiertas',state.irrigationCorrections.length]].map(([label,value])=><div className="metric-row" key={label}><span>{label}</span><strong className={value?'warn':'ok'}>{value}</strong></div>)}</Card><Card title="Últimos monitoreos">{[...data].reverse().slice(0,8).map(item=><div className="metric-row" key={item.id}><span>{item.date} · {state.houses.find(house=>house.id===item.houseId)?.name}</span><strong>EC {item.ecInput} / pH {item.phInput}</strong></div>)}</Card></div></>
}
