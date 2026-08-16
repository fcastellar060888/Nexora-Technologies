import { useMemo,useState } from 'react'
import Card from '../components/Card'
import Field from '../components/Field'
import PageHeader from '../components/PageHeader'
import StateMessage from '../components/StateMessage'
import{ValidationMessage}from'../components/forms/FormKit.jsx'
import{MIRFE_WORKFLOW_TRANSITIONS,availableMirfeTransitions,mirfeWorkflowPhase}from'../domain/mirfeWorkflow.js'
import{IRRIGATION_MIRFE_OPERATIONS,useIrrigationMirfeCommandStore}from'../services/irrigationMirfeCommandStore'

const labels={
 [MIRFE_WORKFLOW_TRANSITIONS.SUBMIT]:'Enviar a aprobación',[MIRFE_WORKFLOW_TRANSITIONS.APPROVE]:'Aprobar',[MIRFE_WORKFLOW_TRANSITIONS.SCHEDULE]:'Programar',[MIRFE_WORKFLOW_TRANSITIONS.APPLY]:'Registrar aplicación',[MIRFE_WORKFLOW_TRANSITIONS.START_FOLLOW_UP]:'Iniciar seguimiento',[MIRFE_WORKFLOW_TRANSITIONS.VERIFY_EFFECTIVE]:'Verificar como efectivo',[MIRFE_WORKFLOW_TRANSITIONS.VERIFY_NO_RESPONSE]:'Verificar sin respuesta',[MIRFE_WORKFLOW_TRANSITIONS.CORRECT]:'Registrar corrección',[MIRFE_WORKFLOW_TRANSITIONS.CANCEL]:'Cancelar'
}

export default function MirfeHistoryPage(){
 const {state,execute}=useIrrigationMirfeCommandStore()
 const [editing,setEditing]=useState(null),[message,setMessage]=useState('')
 const [filters,setFilters]=useState({phase:'Todas',status:'Todos',houseId:'Todos'})
 const rows=useMemo(()=>[...state.mirfeReinforcements].reverse().filter(record=>{
  const phase=mirfeWorkflowPhase(record)
  return(filters.phase==='Todas'||phase===filters.phase)&&(filters.status==='Todos'||record.status===filters.status)&&(filters.houseId==='Todos'||record.houseId===filters.houseId)
 }),[state.mirfeReinforcements,filters])
 const statuses=[...new Set(state.mirfeReinforcements.map(record=>record.status).filter(Boolean))]
 const counts=useMemo(()=>state.mirfeReinforcements.reduce((summary,record)=>({...summary,[mirfeWorkflowPhase(record)]:summary[mirfeWorkflowPhase(record)]+1}),{Pendiente:0,Ejecutada:0,Verificada:0}),[state.mirfeReinforcements])
 const history=useMemo(()=>[...state.irrigationHistory].sort((left,right)=>Date.parse(right.occurredAt||0)-Date.parse(left.occurredAt||0)),[state.irrigationHistory])

 function open(record){
  const transitions=availableMirfeTransitions(record)
  setMessage('')
  setEditing({record,transition:transitions[0]||'',result:'',reason:'',action:'',ecAfter:record.ecAfter??'',phAfter:record.phAfter??'',nextReview:record.nextReview||'',notes:''})
 }
 async function save(e){
  e.preventDefault();setMessage('')
  try{
   const common={reinforcementId:editing.record.id,siteId:editing.record.siteId,reason:editing.reason,action:editing.action,result:editing.result,ecAfter:editing.ecAfter,phAfter:editing.phAfter,nextReview:editing.nextReview,notes:editing.notes}
   if(editing.transition===MIRFE_WORKFLOW_TRANSITIONS.CORRECT)await execute({operation:IRRIGATION_MIRFE_OPERATIONS.RECORD_MIRFE_CORRECTION,input:common})
   else await execute({operation:IRRIGATION_MIRFE_OPERATIONS.TRANSITION_MIRFE_REINFORCEMENT,input:{...common,transition:editing.transition}})
   setEditing(null);setMessage('Transición MIRFE registrada correctamente.')
  }catch(error){setMessage(error.message)}
 }
 const available=editing?availableMirfeTransitions(editing.record):[]
 return <>
  <PageHeader title="Seguimiento e historial MIRFE" subtitle="Ejecuta transiciones válidas y consulta el historial agronómico append-only proyectado por comandos."/>
  {message&&<ValidationMessage type={message.includes('correctamente')?'success':'error'}>{message}</ValidationMessage>}
  <Card title="Filtros"><div className="form-grid three">
   <Field label="Fase"><select value={filters.phase} onChange={e=>setFilters({...filters,phase:e.target.value})}><option>Todas</option><option>Pendiente</option><option>Ejecutada</option><option>Verificada</option></select></Field>
   <Field label="Estado"><select value={filters.status} onChange={e=>setFilters({...filters,status:e.target.value})}><option>Todos</option>{statuses.map(x=><option key={x}>{x}</option>)}</select></Field>
   <Field label="Nave"><select value={filters.houseId} onChange={e=>setFilters({...filters,houseId:e.target.value})}><option value="Todos">Todas</option>{state.houses.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
  </div></Card>
  <div className="summary-strip">
   <div><span>Pendientes</span><strong>{counts.Pendiente}</strong></div>
   <div><span>Ejecutadas por verificar</span><strong className="warn">{counts.Ejecutada}</strong></div>
   <div><span>Verificadas</span><strong>{counts.Verificada}</strong></div>
   <div><span>Eventos agronómicos</span><strong>{history.length}</strong></div>
  </div>
  <Card title="Órdenes y workflow">{!state.mirfeReinforcements.length?<StateMessage title="No hay órdenes MIRFE para seguir" message="Crea una orden de refuerzo para iniciar el workflow de aprobación, aplicación y verificación."/>:!rows.length?<StateMessage type="info" title="Sin coincidencias" message="No hay órdenes que coincidan con los filtros actuales."/>:<div className="table-scroll"><table><thead><tr><th>Fecha</th><th>Nave</th><th>Genética</th><th>Motivo</th><th>Fase</th><th>Estado</th><th>Versión</th><th>Resultado</th><th>EC antes/después</th><th></th></tr></thead><tbody>
   {rows.map(x=>{const phase=mirfeWorkflowPhase(x),transitions=availableMirfeTransitions(x);return <tr key={x.id}><td>{x.date}</td><td>{state.houses.find(h=>h.id===x.houseId)?.name||'—'}</td><td>{state.genetics.find(g=>g.id===x.geneticId)?.name||'—'}</td><td>{x.reason||'—'}</td><td><span className={`tag ${phase==='Verificada'?'success':''}`}>{phase}</span></td><td>{x.workflowQuarantined?'En cuarentena':x.status}</td><td>{x.workflowVersion||'—'}</td><td>{x.result||'Pendiente'}</td><td>{x.ecBefore} / {x.ecAfter??'—'}</td><td>{transitions.length?<button className="button secondary" onClick={()=>open(x)}>Avanzar workflow</button>:<span>Sin acciones</span>}</td></tr>})}
  </tbody></table></div>}</Card>
  {editing&&<Card title={`Workflow · ${editing.record.status}`}><form className="stacked-form" onSubmit={save}>
   <section className="form-section"><div className="form-grid">
    <Field label="Transición permitida"><select value={editing.transition} onChange={e=>setEditing({...editing,transition:e.target.value})}>{available.map(value=><option key={value} value={value}>{labels[value]||value}</option>)}</select></Field>
    {[MIRFE_WORKFLOW_TRANSITIONS.VERIFY_EFFECTIVE,MIRFE_WORKFLOW_TRANSITIONS.VERIFY_NO_RESPONSE].includes(editing.transition)&&<Field label="Resultado 24–72 h"><textarea required value={editing.result} onChange={e=>setEditing({...editing,result:e.target.value})}/></Field>}
    {[MIRFE_WORKFLOW_TRANSITIONS.CANCEL,MIRFE_WORKFLOW_TRANSITIONS.CORRECT].includes(editing.transition)&&<Field label="Motivo"><textarea required value={editing.reason} onChange={e=>setEditing({...editing,reason:e.target.value})}/></Field>}
    {editing.transition===MIRFE_WORKFLOW_TRANSITIONS.CORRECT&&<Field label="Acción correctiva"><textarea required value={editing.action} onChange={e=>setEditing({...editing,action:e.target.value})}/></Field>}
    {[MIRFE_WORKFLOW_TRANSITIONS.VERIFY_EFFECTIVE,MIRFE_WORKFLOW_TRANSITIONS.VERIFY_NO_RESPONSE].includes(editing.transition)&&<><Field label="EC después"><input type="number" step=".01" value={editing.ecAfter} onChange={e=>setEditing({...editing,ecAfter:e.target.value===''?'':Number(e.target.value)})}/></Field><Field label="pH después"><input type="number" step=".01" value={editing.phAfter} onChange={e=>setEditing({...editing,phAfter:e.target.value===''?'':Number(e.target.value)})}/></Field></>}
    <Field label="Próxima revisión"><input type="date" value={editing.nextReview} onChange={e=>setEditing({...editing,nextReview:e.target.value})}/></Field>
    <Field label="Evidencia / notas"><textarea value={editing.notes} onChange={e=>setEditing({...editing,notes:e.target.value})}/></Field>
   </div></section>
   <div className="form-actions"><button type="button" className="button secondary" onClick={()=>setEditing(null)}>Cancelar</button><button className="button primary" disabled={!editing.transition}>Registrar transición</button></div>
  </form></Card>}
  <Card title="Historia agronómica inmutable">{!history.length?<StateMessage title="Sin eventos agronómicos" message="Los comandos de programa, monitoreo, refuerzo, transición y corrección aparecerán aquí y en el Timeline/Operational Ledger."/>:<div className="table-scroll"><table><thead><tr><th>Momento</th><th>Evento</th><th>Resumen</th><th>Transición</th><th>Entidad</th></tr></thead><tbody>{history.map(item=><tr key={item.id}><td>{item.occurredAt||'—'}</td><td>{item.eventName||item.type}</td><td>{item.summary||'—'}</td><td>{item.from&&item.to?`${item.from} → ${item.to}`:'—'}</td><td>{item.entityType} · {item.entityId}</td></tr>)}</tbody></table></div>}</Card>
 </>
}
