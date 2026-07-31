import Card from '../components/Card'
import PageHeader from '../components/PageHeader'
import { useStore } from '../services/store'
import { isFollowUpDue } from '../domain/mipe'

export default function OperationsCenterPage(){
  const {state}=useStore()
  const dueMipe=state.findings.filter(isFollowUpDue).length
  const pendingMirfe=state.mirfeReinforcements.filter(x=>!['Efectivo','Cancelado'].includes(x.status)).length
  const pendingOrders=state.workOrders.filter(x=>x.status!=='Completada').length
  const lowStock=state.inventoryLots.filter(x=>Number(x.quantity)<=Number(x.minimum)).length
  const pendingWater=state.sites.filter(s=>!state.waterAnalyses.some(a=>a.siteId===s.id&&a.status==='Vigente')).length
  return <>
    <PageHeader title="Centro de operaciones" subtitle="Prioridades del día para riego, sanidad, refuerzos, inventario y producción."/>
    <div className="kpi-grid">
      {[['Seguimientos MIPE',dueMipe],['MIRFE abiertos',pendingMirfe],['Órdenes pendientes',pendingOrders],['Stock crítico',lowStock],['Sedes sin agua vigente',pendingWater]].map(([l,v])=><Card className="kpi-card" key={l}><span>{l}</span><strong>{v}</strong></Card>)}
    </div>
    <div className="content-grid two">
      <Card title="Tareas operativas">
        {state.workOrders.filter(x=>x.status!=='Completada').slice(0,10).map(x=><div className="metric-row" key={x.id}><span>{x.title}</span><strong>{x.status}</strong></div>)}
        {!state.workOrders.length&&<p className="muted">No hay órdenes creadas.</p>}
      </Card>
      <Card title="Alertas">
        <div className="metric-row"><span>Seguimientos MIPE vencidos</span><strong className={dueMipe?'warn':''}>{dueMipe}</strong></div>
        <div className="metric-row"><span>Inventario bajo mínimo</span><strong className={lowStock?'warn':''}>{lowStock}</strong></div>
        <div className="metric-row"><span>Sedes sin análisis vigente</span><strong className={pendingWater?'warn':''}>{pendingWater}</strong></div>
      </Card>
    </div>
  </>
}
