import{useMemo,useState}from'react'
import{useParams}from'react-router-dom'
import Card from'../components/Card'
import Field from'../components/Field'
import PageHeader from'../components/PageHeader'
import AttachmentUploader from'../components/AttachmentUploader'
import{useStore}from'../services/store'
import{plantCode,plantTimeline,formatDateTime}from'../domain/mipe'
import{tracePlant,motherCode}from'../domain/propagation'

export default function PlantProfilePage(){
 const{plantId}=useParams();const{state,update}=useStore()
 const plant=state.plantPositions.find(x=>x.id===plantId)
 const bed=state.beds.find(x=>x.id===plant?.bedId),house=state.houses.find(x=>x.id===bed?.houseId),site=state.sites.find(x=>x.id===house?.siteId)
 const gen=state.genetics.find(x=>x.id===plant?.geneticId)
 const timeline=useMemo(()=>plantTimeline(state,plantId),[state,plantId]);const lineage=tracePlant(state,plantId)
 const[event,setEvent]=useState({type:'Observación',title:'',detail:'',date:new Date().toISOString()})
 if(!plant)return <Card><p>Planta no encontrada.</p></Card>
 function addEvent(e){e.preventDefault();update(s=>({...s,plantEvents:[...s.plantEvents,{id:crypto.randomUUID(),plantId,...event}]}),{module:'Planta',action:'Evento agregado',detail:event.title});setEvent({...event,title:'',detail:''})}
 return <>
  <PageHeader title={plantCode(state,plant)} subtitle={`${site?.name} · ${house?.name} · ${bed?.name} · ${gen?.name||'Sin genética'}`}/>
  <div className="kpi-grid"><Card className="kpi-card"><span>Estado</span><strong>{plant.status}</strong></Card><Card className="kpi-card"><span>Fila</span><strong>{plant.row}</strong></Card><Card className="kpi-card"><span>Posición</span><strong>{plant.position}</strong></Card><Card className="kpi-card"><span>MIPE activos</span><strong>{state.findings.filter(f=>f.plantPositionId===plantId&&!['Resuelto','Falso positivo'].includes(f.status)).length}</strong></Card></div>
  <div className="content-grid two">
   <Card title="Ficha integral">
    <div className="detail-grid"><div><span>Empresa</span><strong>{state.companies.find(c=>c.id===site?.companyId)?.name}</strong></div><div><span>Sede</span><strong>{site?.name}</strong></div><div><span>Nave</span><strong>{house?.name}</strong></div><div><span>Cama</span><strong>{bed?.name}</strong></div><div><span>Genética</span><strong>{gen?.name}</strong></div><div><span>Etapa / semana</span><strong>{state.currentContext.stage||'—'} / {state.currentContext.week||1}</strong></div></div>
    <div className="lineage-mini"><span>Madre</span><strong>{lineage.mother?motherCode(state,lineage.mother):"Sin registrar"}</strong><span>Lote</span><strong>{lineage.batch?.code||"Sin registrar"}</strong><span>Esqueje</span><strong>{lineage.unit?.code||"Sin registrar"}</strong></div><AttachmentUploader entityType="plant" entityId={plantId} label="Agregar foto, video o PDF"/>
   </Card>
   <Card title="Agregar evento"><form className="form-grid one" onSubmit={addEvent}><Field label="Tipo"><select value={event.type} onChange={e=>setEvent({...event,type:e.target.value})}>{['Observación','MIRFE','Riego','Producción','Trasplante','Cosecha'].map(x=><option key={x}>{x}</option>)}</select></Field><Field label="Título"><input value={event.title} onChange={e=>setEvent({...event,title:e.target.value})}/></Field><Field label="Detalle"><textarea value={event.detail} onChange={e=>setEvent({...event,detail:e.target.value})}/></Field><button className="button primary">Guardar evento</button></form></Card>
  </div>
  <Card title="Línea de tiempo completa">{timeline.length?timeline.map(x=><div className="timeline-item" key={`${x.type}-${x.id}`}><i/><div><strong>{x.title}</strong><small>{formatDateTime(x.date)} · {x.type} · {x.status||''}</small><p>{x.detail}</p></div></div>):<p className="muted">No hay eventos.</p>}</Card>
 </>
}
