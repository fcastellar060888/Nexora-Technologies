import{useMemo,useState}from'react'
import{useParams}from'react-router-dom'
import Card from'../components/Card'
import Field from'../components/Field'
import PageHeader from'../components/PageHeader'
import AttachmentUploader from'../components/AttachmentUploader'
import{createCultivationPlantPassportFromState}from'../core/passport/index.js'
import{publishDomainEvent}from'../core/events/publishDomainEvent.js'
import{useStore}from'../services/store'
import{hasPermission}from'../services/permissions.js'
import{executePlantEventCommand}from'../services/plantEventCommand.js'
import{formatDateTime}from'../domain/mipe'

const relation=(passport,type,targetType)=>passport.relationships.find(item=>item.type===type&&(!targetType||item.targetType===targetType))
const indicator=(passport,key)=>passport.indicators.find(item=>item.key===key)?.value||0
const emptyEvent=()=>({commandId:crypto.randomUUID(),type:'Observación',title:'',detail:'',date:new Date().toISOString()})

export default function PlantProfilePage(){
 const{plantId}=useParams();const{state,update}=useStore()
 const passport=useMemo(()=>{try{return createCultivationPlantPassportFromState(state,{plantId})}catch{return null}},[state,plantId])
 const[event,setEvent]=useState(emptyEvent)
 const[submitError,setSubmitError]=useState('')
 const[isSaving,setIsSaving]=useState(false)
 const canRecord=hasPermission(state,'record_observations')
 if(!passport)return <Card><p>Planta no encontrada.</p></Card>
 const{object,timeline}=passport,identity=object.identity,attributes=object.attributes
 const site=relation(passport,'located_in','organization.site'),house=relation(passport,'located_in','cultivation.house'),bed=relation(passport,'located_in','cultivation.bed')
 const mother=relation(passport,'descends_from','cultivation.mother'),grandmother=relation(passport,'descends_from','cultivation.grandmother'),lot=relation(passport,'member_of_lot','cultivation.lot'),unit=relation(passport,'originated_from','propagation.unit')
 async function addEvent(e){
  e.preventDefault();if(!canRecord||isSaving)return
  setIsSaving(true);setSubmitError('')
  try{
   await executePlantEventCommand(state,{plantId,...event},{publishEvent:spec=>publishDomainEvent(state,spec),commit:(recipe,meta)=>update(recipe,meta)})
   setEvent(emptyEvent())
  }catch(error){setSubmitError(error instanceof Error?error.message:'No fue posible registrar el evento.')}
  finally{setIsSaving(false)}
 }
 return <>
  <PageHeader eyebrow="Passport universal" title={object.label} subtitle={`${site?.label||'Sin sede'} · ${house?.label||'Sin nave'} · ${bed?.label||'Sin cama'} · ${attributes.geneticName||'Sin genética'}`}/>
  <div className="kpi-grid"><Card className="kpi-card"><span>Estado</span><strong>{object.status}</strong></Card><Card className="kpi-card"><span>Fila</span><strong>{identity.row??'—'}</strong></Card><Card className="kpi-card"><span>Posición</span><strong>{identity.position??'—'}</strong></Card><Card className="kpi-card"><span>MIPE activos</span><strong>{indicator(passport,'open_mipe_findings')}</strong></Card></div>
  <div className="content-grid two">
   <Card title="Ficha integral" subtitle={`Passport ${passport.passportId}`}>
    <div className="detail-grid"><div><span>Empresa</span><strong>{object.organizationId}</strong></div><div><span>Sede</span><strong>{site?.label||'Sin registrar'}</strong></div><div><span>Nave</span><strong>{house?.label||'Sin registrar'}</strong></div><div><span>Cama</span><strong>{bed?.label||'Sin registrar'}</strong></div><div><span>Genética</span><strong>{attributes.geneticName||'Sin registrar'}</strong></div><div><span>Etapa</span><strong>{attributes.phase||'Sin registrar'}</strong></div></div>
    <div className="lineage-mini"><span>Abuela</span><strong>{grandmother?.label||'Sin registrar'}</strong><span>Madre</span><strong>{mother?.label||'Sin registrar'}</strong><span>Lote</span><strong>{lot?.label||'Sin registrar'}</strong><span>Esqueje</span><strong>{unit?.label||'Sin registrar'}</strong></div>
    <AttachmentUploader entityType="plant" entityId={plantId} label="Agregar foto, video o PDF"/>
   </Card>
   <Card title="Agregar evento">
    {canRecord?<form className="form-grid one" onSubmit={addEvent}><Field label="Tipo"><select value={event.type} onChange={e=>setEvent({...event,type:e.target.value})}>{['Observación','MIPE','MIRFE','Riego','Producción','Trasplante','Cosecha'].map(x=><option key={x}>{x}</option>)}</select></Field><Field label="Título"><input required value={event.title} onChange={e=>setEvent({...event,title:e.target.value})}/></Field><Field label="Detalle"><textarea value={event.detail} onChange={e=>setEvent({...event,detail:e.target.value})}/></Field>{submitError?<p role="alert">{submitError}</p>:null}<button className="button primary" disabled={isSaving}>{isSaving?'Guardando…':'Guardar evento'}</button></form>:<p className="muted">Tu rol puede consultar el Passport, pero no registrar observaciones de planta.</p>}
   </Card>
  </div>
  <Card title="Línea de tiempo completa" subtitle={`${timeline.length} eventos consolidados desde MIPE, tratamientos y operación.`}>{timeline.length?timeline.map(x=><div className="timeline-item" key={`${x.type}-${x.id}`}><i/><div><strong>{x.title}</strong><small>{formatDateTime(x.occurredAt)} · {x.type} · {x.status||''}</small><p>{x.summary||'Sin detalle'}</p></div></div>):<p className="muted">No hay eventos.</p>}</Card>
 </>
}
