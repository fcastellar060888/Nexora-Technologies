import{useState}from'react'
import Card from'../components/Card'
import Field from'../components/Field'
import PageHeader from'../components/PageHeader'
import{useStore}from'../services/store'

export default function SiteMapPage(){
 const{state}=useStore()
 const[siteId,setSiteId]=useState(state.currentContext.siteId||state.sites[0]?.id||'')
 const site=state.sites.find(s=>s.id===siteId)
 const houses=state.houses.filter(h=>h.siteId===siteId)
 return <><PageHeader title="Croquis de sede" subtitle="Todas las naves, camas y plantas completas, respetando su distribución configurada."/>
 <Card><div className="form-grid compact"><Field label="Sede"><select value={siteId} onChange={e=>setSiteId(e.target.value)}>{state.sites.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></Field></div></Card>
 <Card title={site?.name||'Sede'} subtitle={`${state.companies.find(c=>c.id===site?.companyId)?.name||''} · ${houses.length} naves`}>
 {!houses.length?<p className="muted">Sin naves.</p>:<div className="site-croquis full-croquis">{houses.map(h=>{
  const beds=state.beds.filter(b=>b.houseId===h.id).sort((a,b)=>(a.order||0)-(b.order||0))
  const plants=state.plantPositions.filter(p=>beds.some(b=>b.id===p.bedId))
  const open=state.findings.filter(f=>plants.some(p=>p.id===f.plantPositionId)&&!['Resuelto','Falso positivo'].includes(f.status))
  const bot=open.filter(f=>state.incidents.find(x=>x.id===f.incidentId)?.name==='Botritis').length
  const max=Math.max(0,...open.map(f=>Number(f.severity||0)))
  return <div className={`site-house full-house ${max>=4?'critical':max>=3?'high':open.length?'attention':''}`} key={h.id}>
   <div className="site-house-title"><strong>{h.name}</strong><span>{beds.length} camas</span></div>
   <div className="mini-beds full-mini-beds">{beds.map(b=>{
    const bp=state.plantPositions.filter(p=>p.bedId===b.id).sort((a,z)=>a.row-z.row||a.position-z.position)
    return <div className="mini-bed full-mini-bed" key={b.id}>
     <div className="mini-bed-head"><span>{b.name}</span><small>{b.rows} × {b.plantsPerRow} · {bp.filter(p=>p.active).length} activas</small></div>
     <div className="mini-grid-scroll">
      <div className="mini-plant-grid exact-mini-grid" style={{gridTemplateColumns:`repeat(${b.plantsPerRow},6px)`}}>
       {bp.map(p=>{const f=state.findings.filter(x=>x.plantPositionId===p.id&&!['Resuelto','Falso positivo'].includes(x.status)).sort((a,z)=>z.severity-a.severity)[0],inc=state.incidents.find(i=>i.id===f?.incidentId);return <i key={p.id} className={!p.active?'mini-plant empty':'mini-plant'} style={f?{background:inc?.color}:{}} title={`Fila ${p.row} · Planta ${p.position}`}/>})}
      </div>
     </div>
    </div>
   })}</div>
   <div className="site-house-stats"><span>{plants.filter(p=>p.active).length} plantas</span><span>{open.length} hallazgos</span><span>{bot} botritis</span></div>
  </div>
 })}</div>}
 </Card></>
}
