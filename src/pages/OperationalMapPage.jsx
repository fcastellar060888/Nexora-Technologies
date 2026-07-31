import{useMemo,useState}from'react'
import{useNavigate}from'react-router-dom'
import Card from'../components/Card'
import Field from'../components/Field'
import PageHeader from'../components/PageHeader'
import{useStore}from'../services/store'

export default function OperationalMapPage(){
 const{state,update}=useStore()
 const nav=useNavigate()
 const initialSite=state.currentContext.siteId||state.sites[0]?.id||''
 const[siteId,setSiteId]=useState(initialSite)
 const[houseId,setHouseId]=useState('')
 const[mode,setMode]=useState('MIPE')
 const houses=useMemo(
  ()=>state.houses.filter(h=>h.siteId===siteId&&(!houseId||h.id===houseId)),
  [state.houses,siteId,houseId]
 )
 function colorFor(p){
  const f=state.findings
   .filter(x=>x.plantPositionId===p.id&&!['Resuelto','Falso positivo'].includes(x.status))
   .sort((a,b)=>Number(b.severity||0)-Number(a.severity||0))[0]
  const inc=state.incidents.find(i=>i.id===f?.incidentId)
  const g=state.genetics.find(x=>x.id===p.geneticId)
  if(!p.active)return'#d8e0e6'
  if(mode==='MIPE'&&f)return inc?.color||'#c0392b'
  if(mode==='Genética')return g?.color||'#8ca0ad'
  if(mode==='Estado'&&p.status!=='Activa')return'#7b8790'
  return'#4ca462'
 }
 return <><PageHeader title="Croquis operativo" subtitle="Representación completa de naves, camas y plantas respetando las filas configuradas."/>
 <Card><div className="form-grid map-filters">
  <Field label="Sede"><select value={siteId} onChange={e=>{setSiteId(e.target.value);setHouseId('')}}>{state.sites.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
  <Field label="Nave"><select value={houseId} onChange={e=>setHouseId(e.target.value)}><option value="">Todas las naves</option>{state.houses.filter(h=>h.siteId===siteId).map(h=><option key={h.id} value={h.id}>{h.name}</option>)}</select></Field>
  <div className="field"><span>Capa visual</span><div className="actions">{['MIPE','Genética','Estado'].map(x=><button type="button" className={`button ${mode===x?'primary':'secondary'}`} key={x} onClick={()=>setMode(x)}>{x}</button>)}</div></div>
 </div></Card>
 <div className="operational-map">{houses.map(h=>{
  const beds=state.beds.filter(b=>b.houseId===h.id).sort((a,b)=>(a.order||0)-(b.order||0))
  const site=state.sites.find(s=>s.id===h.siteId)
  return <Card key={h.id} title={`${site?.name||''} · ${h.name}`} subtitle={`${beds.length} camas · ${beds.reduce((n,b)=>n+state.plantPositions.filter(p=>p.bedId===b.id&&p.active).length,0)} plantas activas`}>
   <div className="operational-beds exact-layout">{beds.map(b=>{
    const plants=state.plantPositions.filter(p=>p.bedId===b.id).sort((a,z)=>a.row-z.row||a.position-z.position)
    return <div className="operational-bed exact-bed" key={b.id}>
     <div className="bed-heading"><strong>{b.name}</strong><span>{b.rows} filas × {b.plantsPerRow} posiciones · {plants.filter(p=>p.active).length} activas</span></div>
     <div className="exact-plant-scroll">
      <div className="operational-plants exact-plant-grid" style={{gridTemplateColumns:`repeat(${b.plantsPerRow},14px)`}}>
       {plants.map(p=><button title={`${b.name} · Fila ${p.row} · Planta ${p.position}`} style={{background:colorFor(p)}} className={`operational-plant ${!p.active?'inactive':''}`} key={p.id} onClick={()=>{update(s=>({...s,currentContext:{...s.currentContext,siteId:h.siteId,houseId:h.id,bedId:b.id,plantId:p.id,geneticId:p.geneticId}}),{audit:false});nav(`/plant/${p.id}`)}}/>)}
      </div>
     </div>
    </div>
   })}</div>
  </Card>
 })}{!houses.length&&<Card><p>No hay naves creadas para esta sede.</p></Card>}</div></>
}
