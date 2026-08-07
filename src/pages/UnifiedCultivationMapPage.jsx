import{useState}from'react'
import{useNavigate}from'react-router-dom'
import Card from'../components/Card'
import Field from'../components/Field'
import PageHeader from'../components/PageHeader'
import SiteOverviewMap from'../components/SiteOverviewMap.jsx'
import PlantPassportDrawer from'../components/PlantPassportDrawer.jsx'
import MaterialPlantMapLayer from'../components/MaterialPlantMapLayer.jsx'
import{useStore}from'../services/store'
import{lotTiming}from'../domain/lifecycle'
import{bankOccupancy}from'../domain/propagationAllocation.js'

const openFinding=f=>!['Resuelto','Falso positivo'].includes(f?.status)
const plantLabel=plant=>plant.code||plant.plantCode||`F${plant.row||1}-P${plant.position||1}`

export default function UnifiedCultivationMapPage(){
 const{state}=useStore(),navigate=useNavigate()
 const activeSites=state.sites.filter(site=>site.active!==false)
 const[siteId,setSiteId]=useState(state.currentContext?.siteId||activeSites[0]?.id||'')
 const[layer,setLayer]=useState('MIPE'),[selectedPlantId,setSelectedPlantId]=useState(null)
 const houses=state.houses.filter(h=>h.siteId===siteId&&h.active!==false)
 const banks=(state.propagationBanks||[]).filter(b=>b.siteId===siteId&&b.active!==false)
 return <>
  <PageHeader title="Mapa de la sede" subtitle="Plano general de la finca completa: áreas, naves, camas, bancos y plantas vistos desde arriba. La infraestructura se configura en Infraestructura; aquí se consulta el estado operativo."/>
  <Card><div className="form-grid unified-map-toolbar"><Field label="Sede"><select value={siteId} onChange={e=>{setSiteId(e.target.value);setSelectedPlantId(null)}}>{activeSites.map(site=><option key={site.id} value={site.id}>{site.name}</option>)}</select></Field><Field label="Capa visual"><select value={layer} onChange={e=>setLayer(e.target.value)}>{['MIPE','Estado','Fase','Genética'].map(value=><option key={value}>{value}</option>)}</select></Field><div className="unified-map-help"><strong>Vista superior de la finca</strong><span>Primero ves la sede completa; luego puedes bajar al detalle de cada nave, cama y planta.</span></div></div></Card>
  <SiteOverviewMap state={state} siteId={siteId} layer={layer}/>
  <Card title="Detalle operativo por nave" subtitle="Aquí reaparece el nivel de detalle de Canapa ERP: cada cama muestra sus plantas y los hallazgos abiertos resaltan visualmente la ubicación exacta.">
   <div style={{display:'grid',gap:16}}>{houses.map(h=><HouseDetail key={h.id} state={state} house={h} layer={layer} onPlant={setSelectedPlantId}/>)}{!houses.length?<div className="empty-state"><strong>No hay naves activas en esta sede</strong><p>Créelas desde Infraestructura.</p></div>:null}</div>
  </Card>
  <Card title="Bancos de propagación" subtitle="Resumen de los bancos activos de la sede; la configuración de bancos y bandejas se realiza en Infraestructura.">{banks.length?<div className="table-scroll"><table><thead><tr><th>Banco</th><th>Bandejas</th><th>Ocupación</th><th>Hallazgos</th></tr></thead><tbody>{banks.map(bank=>{const metrics=bankOccupancy(bank,state.propagationUnits),unitIds=new Set(state.propagationUnits.filter(u=>u.bankId===bank.id||u.propagationBankId===bank.id).map(u=>u.id)),findings=state.findings.filter(f=>unitIds.has(f.propagationUnitId)&&openFinding(f));return <tr key={bank.id}><td><strong>{bank.name}</strong></td><td>{(bank.trays||[]).reduce((sum,t)=>sum+Number(t.quantity||0),0)}</td><td>{metrics.occupied}/{metrics.capacity}</td><td><span className={`tag ${findings.length?'danger-tag':'success'}`}>{findings.length}</span></td></tr>})}</tbody></table></div>:<div className="empty-state"><strong>No hay bancos activos</strong><p>Configúralos desde Infraestructura.</p></div>}</Card>
  <Card title="Material vegetal individual" subtitle="Abuelas y madres dentro del contexto completo de la sede."><MaterialPlantMapLayer state={state} siteId={siteId}/></Card>
  {selectedPlantId&&<PlantPassportDrawer state={state} plantId={selectedPlantId} onClose={()=>setSelectedPlantId(null)} onOpen={()=>navigate(`/plant/${selectedPlantId}`)}/>} 
 </>
}

function HouseDetail({state,house,layer,onPlant}){
 const beds=state.beds.filter(b=>b.houseId===house.id&&b.active!==false).sort((a,b)=>(a.order||0)-(b.order||0))
 const bedIds=new Set(beds.map(b=>b.id)),plantIds=new Set(state.plantPositions.filter(p=>bedIds.has(p.bedId)).map(p=>p.id)),houseFindings=state.findings.filter(f=>plantIds.has(f.plantPositionId)&&openFinding(f))
 return <section style={{border:`2px solid ${layer==='MIPE'&&houseFindings.length?'#d65a5a':'#d9e2d7'}`,borderRadius:16,padding:14,background:houseFindings.length&&layer==='MIPE'?'#fff8f8':'#fff'}}>
  <header style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'center',marginBottom:12}}><div><strong style={{fontSize:'1.05rem'}}>{house.name}</strong><small style={{display:'block'}}>{beds.length} camas activas</small></div><span className={`tag ${houseFindings.length?'danger-tag':'success'}`}>{houseFindings.length?`${houseFindings.length} hallazgos`:'Sin hallazgos'}</span></header>
  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))',gap:12}}>{beds.map(bed=><BedDetail key={bed.id} state={state} bed={bed} layer={layer} onPlant={onPlant}/>)}</div>
 </section>
}

function BedDetail({state,bed,layer,onPlant}){
 const plants=state.plantPositions.filter(p=>p.bedId===bed.id).sort((a,b)=>(a.row||0)-(b.row||0)||(a.position||0)-(b.position||0))
 const lot=state.propagationBatches.find(l=>l.id===bed.lotId),ids=new Set(plants.map(p=>p.id)),findings=state.findings.filter(f=>ids.has(f.plantPositionId)&&openFinding(f))
 return <article style={{border:`1px solid ${findings.length?'#e4a2a2':'#ccd9ca'}`,borderRadius:12,padding:10,background:layer==='MIPE'&&findings.length?'#fff1f1':'#f9fbf8'}}>
  <header style={{display:'flex',justifyContent:'space-between',gap:8,marginBottom:8}}><div><strong>{bed.name}</strong><small style={{display:'block'}}>{bed.rows} × {bed.plantsPerRow} · {plants.filter(p=>p.active!==false&&p.status!=='Vacía').length} activas</small>{lot?<small style={{display:'block'}}>{lot.code} · {layer==='Fase'?`${lot.phase} S${lotTiming(state,lot).week}`:lot.phase}</small>:null}</div>{findings.length?<span className="tag danger-tag">{findings.length}</span>:null}</header>
  <div className="unified-plant-grid" style={{gridTemplateColumns:`repeat(${Math.max(1,Number(bed.plantsPerRow)||1)},minmax(17px,1fr))`}}>{plants.map(plant=><PlantCell key={plant.id} state={state} plant={plant} bed={bed} lot={lot} layer={layer} onPlant={onPlant}/>)}</div>
 </article>
}

function PlantCell({state,plant,bed,lot,layer,onPlant}){
 const findings=state.findings.filter(f=>f.plantPositionId===plant.id&&openFinding(f)),genetic=state.genetics.find(g=>g.id===(plant.geneticId||bed.geneticId||lot?.geneticId))
 let label=plantLabel(plant);if(layer==='Genética')label=genetic?.name?.slice(0,3)||'—';if(layer==='Fase')label=lot?.phase?.slice(0,3)||'—';if(layer==='MIPE'&&findings.length)label=String(findings.length)
 const severe=findings.some(f=>Number(f.severity||0)>=3)
 return <button type="button" className={`unified-plant-cell ${plant.active!==false&&plant.status!=='Vacía'?'active':'empty'} ${findings.length?'risk':''}`} style={layer==='MIPE'&&findings.length?{background:severe?'#c83f3f':'#e98f3e',color:'#fff',borderColor:severe?'#9f2d2d':'#c96f25'}:undefined} title={`${plantLabel(plant)} · ${findings.length} hallazgos abiertos`} onClick={()=>onPlant(plant.id)}><span>{label}</span>{findings.length>0&&layer!=='MIPE'?<b>{findings.length}</b>:null}</button>
}
