import{useMemo,useState}from'react'
import Card from'../components/Card'
import Field from'../components/Field'
import Modal from'../components/Modal'
import PageHeader from'../components/PageHeader'
import{findingStatuses,severityLabels,plantCode}from'../domain/mipe'
import{activeOrganizationId}from'../domain/organizationOwnership.js'
import{mipeRecordOrganizationId}from'../domain/mipeTenancy.js'
import{MIPE_OPERATIONS}from'../services/mipeCommand.js'
import{useMipeCommandStore}from'../services/mipeCommandStore.js'
import{useStore}from'../services/store'

export default function HouseMapPage(){
 const{state,execute}=useMipeCommandStore(),{update:rawUpdate}=useStore()
 const initialSite=state.currentContext.siteId||state.sites[0]?.id||''
 const[siteId,setSiteId]=useState(initialSite)
 const availableHouses=state.houses.filter(x=>x.siteId===siteId)
 const[houseId,setHouseId]=useState(state.currentContext.houseId||availableHouses[0]?.id||'')
 const[plant,setPlant]=useState(null),[open,setOpen]=useState(false)
 const[f,setF]=useState({incidentId:state.incidents[0]?.id||'',severity:1,status:'Detectado',notes:'',action:'',responsible:'',followUpDate:''})
 const house=state.houses.find(x=>x.id===houseId)
 const beds=useMemo(()=>state.beds.filter(x=>x.houseId===houseId).sort((a,b)=>(a.order||0)-(b.order||0)),[state.beds,houseId])
 async function save(e){e.preventDefault();try{await execute({operation:MIPE_OPERATIONS.CREATE_FINDING,input:{plantPositionId:plant.id,...f}});setOpen(false)}catch(error){alert(error.message)}}
 function genetic(id){rawUpdate(current=>{const organizationId=activeOrganizationId(current);return{...current,plantPositions:current.plantPositions.map(position=>position.id===plant.id&&mipeRecordOrganizationId(current,'plantPositions',position)===organizationId?{...position,geneticId:id}:position)}},{module:'Cultivo',action:'Genética de planta actualizada',detail:plant.id});setPlant({...plant,geneticId:id})}
 return <><PageHeader title="Mapa de plantas" subtitle="Muestra la cantidad completa y la posición exacta de cada planta dentro de cada cama."/>
 <Card><div className="form-grid map-filters">
  <Field label="Sede"><select value={siteId} onChange={e=>{const newSite=e.target.value,next=state.houses.find(h=>h.siteId===newSite)?.id||'';setSiteId(newSite);setHouseId(next);setPlant(null)}}>{state.sites.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
  <Field label="Nave"><select value={houseId} onChange={e=>{setHouseId(e.target.value);setPlant(null)}}>{state.houses.filter(h=>h.siteId===siteId).map(h=><option key={h.id} value={h.id}>{h.name}</option>)}</select></Field>
 </div></Card>
 {!house?<Card><p>Primero crea una nave.</p></Card>:<div className="house-map-full">{beds.map(b=>{
  const ps=state.plantPositions.filter(p=>p.bedId===b.id).sort((a,z)=>a.row-z.row||a.position-z.position)
  return <Card key={b.id} title={b.name} subtitle={`${b.rows} filas × ${b.plantsPerRow} posiciones · ${ps.filter(p=>p.active).length} activas de ${ps.length}`}>
   <div className="exact-plant-scroll large">
    <div className="plant-grid exact-house-grid" style={{gridTemplateColumns:`repeat(${b.plantsPerRow},22px)`}}>
     {ps.map(p=>{const opens=state.findings.filter(q=>q.plantPositionId===p.id&&!['Resuelto','Falso positivo'].includes(q.status)).sort((a,b)=>b.severity-a.severity),top=opens[0],inc=state.incidents.find(i=>i.id===top?.incidentId),gen=state.genetics.find(g=>g.id===p.geneticId);return <button key={p.id} className={`plant-dot ${!p.active?'empty':''} ${top?'finding':''} ${plant?.id===p.id?'selected':''}`} style={{background:top?inc?.color:(p.active?(gen?.color||'#9ae6b4'):'#fff')}} onClick={()=>setPlant(p)} title={`${plantCode(state,p)} · ${gen?.name||'Sin genética'}${inc?' · '+inc.name:''}`}/>})}
    </div>
   </div>
  </Card>
 })}</div>}
 {plant&&<Card title={plantCode(state,plant)}><div className="detail-grid"><div><span>Genética</span><select value={plant.geneticId||''} onChange={e=>genetic(e.target.value)}><option value="">Sin genética</option>{state.genetics.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select></div><div><span>Estado</span><b>{plant.status}</b></div><div><span>Hallazgos abiertos</span><b>{state.findings.filter(q=>q.plantPositionId===plant.id&&!['Resuelto','Falso positivo'].includes(q.status)).length}</b></div></div><button className="button primary" onClick={()=>setOpen(true)}>Registrar hallazgo</button></Card>}
 <Modal open={open} title="Nuevo hallazgo MIPE" onClose={()=>setOpen(false)}><form className="form-grid modal-form" onSubmit={save}><Field label="Incidencia"><select value={f.incidentId} onChange={e=>setF({...f,incidentId:e.target.value})}>{state.incidents.map(i=><option key={i.id} value={i.id}>{i.category} · {i.name}</option>)}</select></Field><Field label="Severidad"><select value={f.severity} onChange={e=>setF({...f,severity:+e.target.value})}>{Object.entries(severityLabels).map(([v,l])=><option key={v} value={v}>{v} · {l}</option>)}</select></Field><Field label="Estado"><select value={f.status} onChange={e=>setF({...f,status:e.target.value})}>{findingStatuses.map(x=><option key={x}>{x}</option>)}</select></Field><Field label="Responsable"><input value={f.responsible} onChange={e=>setF({...f,responsible:e.target.value})}/></Field><Field label="Próxima revisión"><input type="date" value={f.followUpDate} onChange={e=>setF({...f,followUpDate:e.target.value})}/></Field><Field label="Acción inmediata"><input value={f.action} onChange={e=>setF({...f,action:e.target.value})}/></Field><Field label="Observación técnica"><textarea value={f.notes} onChange={e=>setF({...f,notes:e.target.value})}/></Field><div className="form-actions"><button className="button primary">Guardar hallazgo</button></div></form></Modal></>
}
