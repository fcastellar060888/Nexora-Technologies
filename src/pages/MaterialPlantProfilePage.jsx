import{useMemo}from'react'
import{Link,useParams}from'react-router-dom'
import{AlertTriangle,FileText,History,Leaf,Link2}from'lucide-react'
import AttachmentUploader from'../components/AttachmentUploader.jsx'
import Card from'../components/Card.jsx'
import PageHeader from'../components/PageHeader.jsx'
import{createMaterialPlantPassportFromState}from'../core/passport/index.js'
import{useStore}from'../services/store.jsx'

const indicator=(passport,key)=>passport?.indicators.find(item=>item.key===key)?.value||0
const formatDate=value=>value?new Intl.DateTimeFormat('es-CO',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value)):'—'

export default function MaterialPlantProfilePage(){
 const{plantId}=useParams(),{state}=useStore()
 const passport=useMemo(()=>{try{return createMaterialPlantPassportFromState(state,{unitId:plantId})}catch{return null}},[state,plantId])
 if(!passport)return <Card><p>Planta de material vegetal no encontrada.</p><Link className="button secondary" to="/mipe/dashboard">Volver al Dashboard MIPE</Link></Card>
 const{object}=passport,attributes=object.attributes||{}
 const plantType=attributes.plantType==='GRANDMOTHER'?'Abuela':'Madre'
 const site=state.sites.find(item=>item.id===attributes.siteId),genetic=state.genetics.find(item=>item.id===attributes.geneticId)
 return <>
  <PageHeader eyebrow="Passport universal" title={object.label} subtitle={`${plantType} · ${genetic?.name||attributes.geneticName||'Sin genética'} · ${site?.name||'Sin sede'}`}/>
  <div className="kpi-grid"><Card className="kpi-card"><span>Estado</span><strong>{object.status}</strong></Card><Card className="kpi-card"><span>Disponibilidad</span><strong>{attributes.operationalAvailability||'Disponible para corte'}</strong></Card><Card className="kpi-card"><span>Apta para corte</span><strong>{indicator(passport,'available_for_cutting')?'Sí':'No'}</strong></Card><Card className="kpi-card"><span>MIPE abiertos</span><strong>{indicator(passport,'open_mipe_findings')}</strong></Card></div>
  <div className="content-grid two">
   <Card title="Ficha integral" subtitle={`Passport ${passport.passportId}`}><div className="detail-grid"><div><span>Tipo</span><strong>{plantType}</strong></div><div><span>Lote</span><strong>{attributes.lotCode||attributes.lotId||'—'}</strong></div><div><span>Genética</span><strong>{genetic?.name||attributes.geneticName||'—'}</strong></div><div><span>Sede</span><strong>{site?.name||'—'}</strong></div><div><span>Sanidad</span><strong>{attributes.healthStatus||'—'}</strong></div><div><span>Descendientes</span><strong>{indicator(passport,'descendants')}</strong></div></div><AttachmentUploader entityType="materialPlant" entityId={plantId} label="Agregar foto, video o PDF"/></Card>
   <Card title="Relaciones"><div className="drawer-findings"><h4><Link2 size={17}/> Relaciones del dominio</h4>{passport.relationships.length?passport.relationships.map(item=><p key={`${item.type}:${item.targetId}`}><strong>{item.type.replaceAll('_',' ')}:</strong> {item.label}</p>):<p className="muted">Sin relaciones registradas.</p>}</div></Card>
  </div>
  {passport.risks.length>0&&<Card title="Riesgos y MIPE"><div className="drawer-findings"><h4><AlertTriangle size={17}/> Riesgos activos</h4>{passport.risks.map(item=><article key={item.id}><strong>{item.label}</strong><span>{item.status} · Severidad {item.severity||'—'}</span>{item.notes&&<p>{item.notes}</p>}</article>)}</div></Card>}
  <div className="content-grid two"><Card title="Documentos"><div className="drawer-findings"><h4><FileText size={17}/> Evidencias</h4>{passport.documents.length?passport.documents.map(item=><p key={item.id}>{item.name}</p>):<p className="muted">Sin documentos asociados.</p>}</div></Card><Card title="Resumen operativo"><div className="detail-grid"><div><span>Eventos</span><strong>{indicator(passport,'timeline_events')}</strong></div><div><span>Documentos</span><strong>{indicator(passport,'documents')}</strong></div><div><span>Hallazgos MIPE</span><strong>{indicator(passport,'mipe_findings_total')}</strong></div><div><span>Disponibilidad</span><strong>{attributes.operationalAvailability||'Disponible para corte'}</strong></div></div></Card></div>
  <Card title="Línea de tiempo completa"><div className="drawer-findings"><h4><History size={17}/> Timeline</h4>{passport.timeline.length?passport.timeline.map((item,index)=><article key={item.id||index}><strong>{item.title||item.eventName||'Actividad'}</strong><span>{formatDate(item.occurredAt||item.date||item.createdAt)} · {item.category||item.type||'Evento'}</span>{(item.summary||item.detail)&&<p>{item.summary||item.detail}</p>}</article>):<p className="muted">Sin eventos registrados.</p>}</div></Card>
  <div className="button-row"><Link className="button secondary" to={attributes.plantType==='GRANDMOTHER'?'/propagation/grandmothers':'/propagation/mothers'}><Leaf size={16}/> Ver gestión de {plantType.toLowerCase()}s</Link><Link className="button ghost" to="/mipe/dashboard">Volver al Dashboard MIPE</Link></div>
 </>
}
