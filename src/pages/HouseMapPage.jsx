import{useEffect,useMemo,useState}from'react'
import Card from'../components/Card'
import Field from'../components/Field'
import Modal from'../components/Modal'
import PageHeader from'../components/PageHeader'
import{severityLabels,plantCode}from'../domain/mipe'
import{activeOrganizationId}from'../domain/organizationOwnership.js'
import{operationalContextForPlant,operationalContextOptions,scopeOperationalState,transitionOperationalContext}from'../domain/operationalContext.js'
import{mipeRecordOrganizationId}from'../domain/mipeTenancy.js'
import{MIPE_OPERATIONS}from'../services/mipeCommand.js'
import{useMipeCommandStore}from'../services/mipeCommandStore.js'
import{useStore}from'../services/store'

export default function HouseMapPage(){
 const{state,execute}=useMipeCommandStore(),{update:rawUpdate}=useStore(),context=state.currentContext||{},options=operationalContextOptions(state,context)
 const siteId=context.siteId||options.sites[0]?.id||'',siteHouses=siteId?operationalContextOptions(state,{...context,siteId,houseId:'',bedId:'',plantId:''}).houses:[]
 const houseId=context.siteId===siteId&&context.houseId?context.houseId:siteHouses[0]?.id||''
 const mapState=useMemo(()=>scopeOperationalState(state,{...context,siteId,houseId,bedId:'',plantId:''}),[state,context,siteId,houseId])
 const activeIncidents=mapState.incidents.filter(item=>item.active!==false&&!item.archivedAt)
 const plant=context.plantId?mapState.plantPositions.find(item=>item.id===context.plantId)||null:null
 const[open,setOpen]=useState(false)
 const[f,setF]=useState({incidentId:activeIncidents[0]?.id||'',severity:1,notes:'',action:'',responsible:'',followUpDate:''})
 const house=mapState.houses.find(item=>item.id===houseId)||null
 const beds=useMemo(()=>mapState.beds.filter(item=>item.houseId===houseId).sort((a,b)=>(a.order||0)-(b.order||0)),[mapState.beds,houseId])
 useEffect(()=>{if((!context.siteId&&siteId)||(!context.houseId&&houseId))rawUpdate(current=>({...current,currentContext:transitionOperationalContext(current,{siteId,houseId})}),{audit:false,sync:false})},[context.siteId,context.houseId,siteId,houseId,rawUpdate])
 async function save(e){e.preventDefault();if(!plant)return;try{await execute({operation:MIPE_OPERATIONS.CREATE_FINDING,input:{plantPositionId:plant.id,...f}});setOpen(false)}catch(error){alert(error.message)}}
 function changeSite(nextSiteId){rawUpdate(current=>({...current,currentContext:transitionOperationalContext(current,{siteId:nextSiteId})}),{audit:false,sync:false});setOpen(false)}
 function changeHouse(nextHouseId){rawUpdate(current=>({...current,currentContext:transitionOperationalContext(current,{houseId:nextHouseId})}),{audit:false,sync:false});setOpen(false)}
 function choosePlant(position){rawUpdate(current=>({...current,currentContext:operationalContextForPlant(current,position.id)}),{audit:false,sync:false});setOpen(false)}
 function genetic(id){if(!plant)return;rawUpdate(current=>{const organizationId=activeOrganizationId(current);return{...current,plantPositions:current.plantPositions.map(position=>position.id===plant.id&&mipeRecordOrganizationId(current,'plantPositions',position)===organizationId?{...position,geneticId:id}:position)}},{module:'Cultivo',action:'Genética de planta actualizada',detail:plant.id})}
 function openFinding(){if(!plant)return;const currentIncident=activeIncidents.some(item=>item.id===f.incidentId)?f.incidentId:activeIncidents[0]?.id||'';setF(current=>({...current,incidentId:currentIncident}));setOpen(true)}
 return <><PageHeader title="Mapa de plantas" subtitle="Muestra la cantidad completa y la posición exacta de cada planta dentro de cada cama, dentro del contexto operativo persistente."/>
 <Card><div className="form-grid map-filters">
  <Field label="Sede"><select aria-label="Sede del mapa MIPE" value={siteId} onChange={e=>changeSite(e.target.value)}>{options.sites.map(site=><option key={site.id} value={site.id}>{site.name}</option>)}</select></Field>
  <Field label="Nave"><select aria-label="Nave del mapa MIPE" value={houseId} onChange={e=>changeHouse(e.target.value)}>{siteHouses.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
 </div></Card>
 {!house?<Card><p>Primero crea una nave dentro de la sede activa.</p></Card>:<div className="house-map-full">{beds.map(b=>{
  const ps=mapState.plantPositions.filter(p=>p.bedId===b.id).sort((a,z)=>a.row-z.row||a.position-z.position)
  return <Card key={b.id} title={b.name} subtitle={`${b.rows} filas × ${b.plantsPerRow} posiciones · ${ps.filter(p=>p.active).length} activas de ${ps.length}`}>
   <div className="exact-plant-scroll large"><div className="plant-grid exact-house-grid" style={{gridTemplateColumns:`repeat(${b.plantsPerRow},22px)`}}>{ps.map(p=>{const opens=mapState.findings.filter(q=>q.plantPositionId===p.id&&!['Resuelto','Falso positivo'].includes(q.status)).sort((a,b)=>b.severity-a.severity),top=opens[0],inc=mapState.incidents.find(i=>i.id===top?.incidentId),gen=mapState.genetics.find(g=>g.id===p.geneticId);return <button key={p.id} className={`plant-dot ${!p.active?'empty':''} ${top?'finding':''} ${plant?.id===p.id?'selected':''}`} style={{background:top?inc?.color:(p.active?(gen?.color||'#9ae6b4'):'#fff')}} onClick={()=>choosePlant(p)} title={`${plantCode(mapState,p)} · ${gen?.name||'Sin genética'}${inc?' · '+inc.name:''}`}/>})}</div></div>
  </Card>
 })}</div>}
 {plant&&<Card title={plantCode(mapState,plant)}><div className="detail-grid"><div><span>Genética</span><select value={plant.geneticId||''} onChange={e=>genetic(e.target.value)}><option value="">Sin genética</option>{mapState.genetics.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select></div><div><span>Estado</span><b>{plant.status}</b></div><div><span>Hallazgos abiertos</span><b>{mapState.findings.filter(q=>q.plantPositionId===plant.id&&!['Resuelto','Falso positivo'].includes(q.status)).length}</b></div></div><button className="button primary" disabled={!activeIncidents.length} onClick={openFinding}>{activeIncidents.length?'Registrar hallazgo':'Sin incidencias activas'}</button></Card>}
 <Modal open={open} title="Nuevo hallazgo MIPE" onClose={()=>setOpen(false)}><form className="form-grid modal-form" onSubmit={save}><Field label="Incidencia"><select required value={f.incidentId} onChange={e=>setF({...f,incidentId:e.target.value})}><option value="">Seleccionar incidencia activa</option>{activeIncidents.map(i=><option key={i.id} value={i.id}>{i.category} · {i.name}</option>)}</select></Field><Field label="Severidad"><select value={f.severity} onChange={e=>setF({...f,severity:+e.target.value})}>{Object.entries(severityLabels).map(([v,l])=><option key={v} value={v}>{v} · {l}</option>)}</select></Field><Field label="Estado inicial"><input value="Detectado" disabled/></Field><Field label="Responsable"><input value={f.responsible} onChange={e=>setF({...f,responsible:e.target.value})}/></Field><Field label="Próxima revisión"><input type="date" value={f.followUpDate} onChange={e=>setF({...f,followUpDate:e.target.value})}/></Field><Field label="Acción inmediata"><input value={f.action} onChange={e=>setF({...f,action:e.target.value})}/></Field><Field label="Observación técnica"><textarea value={f.notes} onChange={e=>setF({...f,notes:e.target.value})}/></Field><div className="form-actions"><button className="button primary">Guardar hallazgo</button></div></form></Modal></>
}
