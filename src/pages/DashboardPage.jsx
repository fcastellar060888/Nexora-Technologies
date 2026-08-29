import{useNavigate}from'react-router-dom'
import Card from'../components/Card'
import PageHeader from'../components/PageHeader'
import{useStore}from'../services/store'
import{lotTiming,renewalTiming}from'../domain/lifecycle'
import{diagnosticStateForActiveOrganization}from'../domain/observability.js'

export default function DashboardPage(){
 const{state:rawState}=useStore()
 const state=diagnosticStateForActiveOrganization(rawState)
 const nav=useNavigate()
 const lots=state.propagationBatches
 const grandDue=state.grandmotherPlants.filter(x=>renewalTiming(x).remaining<=Number(x.alertDays||30))
 const motherDue=state.motherPlants.filter(x=>renewalTiming(x).remaining<=Number(x.alertDays||30))
 const phaseDue=lots.filter(x=>lotTiming(state,x).remaining<=7&&x.phase!=='Finalizado')
 const overdueRenewals=[...grandDue,...motherDue].filter(x=>renewalTiming(x).remaining<0).length
 const overduePhases=phaseDue.filter(x=>lotTiming(state,x).remaining<0).length
 const attentionCount=grandDue.length+motherDue.length+phaseDue.length
 const criticalCount=overdueRenewals+overduePhases
 const operationScore=Math.max(0,100-(criticalCount*12)-((attentionCount-criticalCount)*3))
 const inventory=state.finishedGoods.reduce((sum,item)=>sum+Number(item.availableGrams||0),0)
 const value=state.finishedGoods.reduce((sum,item)=>sum+Number(item.availableGrams||0)*Number(item.targetPricePerGram||0)*Number(item.exchangeRate||1),0)
 const sales=state.sales.reduce((sum,item)=>sum+Number(item.totalBase||0),0)
 const phases=['Propagación','Vegetativo','Floración','Cosecha','Secado','Manicura','Selección','Empaque']
 const headline=criticalCount?`${criticalCount} asuntos vencidos requieren intervención`:(attentionCount?`${attentionCount} asuntos próximos requieren seguimiento`:'La operación no presenta vencimientos inmediatos')
 const guidance=criticalCount?'Prioriza las renovaciones y los cambios de fase vencidos antes de ejecutar nuevas actividades.':attentionCount?'Revisa las próximas renovaciones y movimientos de fase para asegurar capacidad, personal e insumos.':'Puedes concentrarte en rendimiento, mejora continua y preparación de los siguientes ciclos.'
 const renewalRows=[...grandDue.map(x=>({type:'Abuelas',code:x.lotCode,t:renewalTiming(x)})),...motherDue.map(x=>({type:'Madres',code:x.lotCode,t:renewalTiming(x)}))].sort((a,b)=>a.t.remaining-b.t.remaining)
 const phaseRows=[...phaseDue].sort((a,b)=>lotTiming(state,a).remaining-lotTiming(state,b).remaining)

 return <>
  <PageHeader title="Centro de Operaciones" subtitle="Prioridades, ciclos, inventario y valor comercial de la empresa."/>
  <section className="decision-summary" aria-label="Resumen para la toma de decisiones">
   <div className="decision-hero"><span>Prioridad operativa</span><h3>{headline}</h3><p>{guidance}</p></div>
   <div className="decision-score" aria-label={`Puntaje operativo ${operationScore} de 100`}><strong>{operationScore}</strong><span>Puntaje operativo</span></div>
  </section>
  <div className="kpi-grid dashboard-kpis">
   {[['Lotes abuelas',state.grandmotherPlants.filter(x=>x.status==='Activa').length],['Lotes madres',state.motherPlants.filter(x=>x.status==='Activa').length],['Lotes productivos',lots.filter(x=>x.phase!=='Finalizado').length],['Renovaciones próximas',grandDue.length+motherDue.length],['Cambios de fase',phaseDue.length],['Inventario',`${inventory.toLocaleString('es-CO')} g`],['Valor potencial',`$${Math.round(value).toLocaleString('es-CO')}`],['Ventas',`$${Math.round(sales).toLocaleString('es-CO')}`]].map(([label,metric])=><Card className="kpi-card" key={label}><span>{label}</span><strong>{metric}</strong></Card>)}
  </div>
  <div className="content-grid two">
   <Card title="Renovaciones" subtitle="Material vegetal próximo a su fecha objetivo.">
    {renewalRows.map(row=><div className={`priority ${row.t.remaining<0?'danger':'warning'}`} key={`${row.type}-${row.code}`}><b>{row.type} · {row.code}</b><span>{row.t.remaining<0?`Vencido hace ${Math.abs(row.t.remaining)} días`:`Faltan ${row.t.remaining} días`} · Semana {row.t.week}</span></div>)}
    {!renewalRows.length&&<div className="empty-state">No hay renovaciones próximas. La programación está al día.</div>}
   </Card>
   <Card title="Próximos cambios de fase" subtitle="Lotes que requieren transición durante los próximos siete días.">
    {phaseRows.map(lot=>{const timing=lotTiming(state,lot);return <button className={`lot-alert ${timing.remaining<0?'danger':''}`} key={lot.id} onClick={()=>nav(`/lots/${lot.id}`)}><strong>{lot.code}</strong><span>{lot.phase} · Semana {timing.week}</span><b>{timing.remaining<0?`${Math.abs(timing.remaining)} días vencido`:`${timing.remaining} días restantes`}</b></button>})}
    {!phaseRows.length&&<div className="empty-state">No hay cambios de fase próximos. Los ciclos están dentro de lo programado.</div>}
   </Card>
  </div>
  <Card title="Lotes por fase" subtitle="Distribución actual del flujo productivo.">
   <div className="phase-board">{phases.map(phase=>{const rows=lots.filter(x=>x.phase===phase);return <div className="phase-column" key={phase}><h4>{phase}</h4><strong>{rows.length} lotes</strong>{rows.slice(0,6).map(lot=>{const timing=lotTiming(state,lot);return <button key={lot.id} onClick={()=>nav(`/lots/${lot.id}`)} aria-label={`Abrir lote ${lot.code}, ${phase}, semana ${timing.week}`}><span>{lot.code}</span><small>Semana {timing.week} · {timing.remaining} días</small></button>})}{!rows.length&&<small className="muted">Sin lotes</small>}</div>})}</div>
  </Card>
 </>
}
