import {useEffect,useMemo,useState} from'react'
import Card from'../components/Card'
import Field from'../components/Field'
import Modal from'../components/Modal'
import PageHeader from'../components/PageHeader'
import StateMessage from'../components/StateMessage'
import {FormActions,ValidationMessage} from'../components/forms/FormKit.jsx'
import {scopeOperationalState} from'../domain/operationalContext.js'
import {availableMipeFindingTransitions} from'../domain/mipeFindingWorkflow.js'
import {findingLocation,findingStatuses,plantCode,severityLabels,formatDateTime,isFollowUpDue} from'../domain/mipe'
import {MIPE_OPERATIONS} from'../services/mipeCommand.js'
import {useMipeCommandStore} from'../services/mipeCommandStore.js'

export default function FindingsPage(){
 const {state:tenantState,execute}=useMipeCommandStore()
 const state=useMemo(()=>scopeOperationalState(tenantState,tenantState.currentContext),[tenantState])
 const contextKey=['companyId','siteId','houseId','bedId','plantId'].map(key=>state.currentContext?.[key]||'').join(':')
 const [filters,setFilters]=useState({status:'Todos',incidentId:'Todos',houseId:'Todos',followUp:'Todos'})
 const [editing,setEditing]=useState(null)
 const [transitioning,setTransitioning]=useState(null)
 useEffect(()=>{setFilters(current=>({...current,houseId:'Todos'}));setEditing(null);setTransitioning(null)},[contextKey])

 const rows=useMemo(()=>state.findings.filter(f=>{
   const loc=findingLocation(state,f)
   const followOk=filters.followUp==='Todos' || (filters.followUp==='Pendientes'&&isFollowUpDue(f)) || (filters.followUp==='Programados'&&f.followUpDate&&!isFollowUpDue(f))
   return (filters.status==='Todos'||f.status===filters.status)
    &&(filters.incidentId==='Todos'||f.incidentId===filters.incidentId)
    &&(filters.houseId==='Todos'||loc.house?.id===filters.houseId)
    &&followOk
 }).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt))),[state,filters])
 const hasFindings=state.findings.length>0
 const overdueCount=rows.filter(isFollowUpDue).length

 function startCorrection(finding){setEditing({...finding,correctionReason:''})}
 function startTransition(finding){
   const options=availableMipeFindingTransitions(finding)
   setTransitioning({finding,transition:options[0]?.name||'',reason:'',options})
 }
 async function saveCorrection(e){
   e.preventDefault()
   try{
    await execute({operation:MIPE_OPERATIONS.CORRECT_FINDING,entityId:editing.id,input:{incidentId:editing.incidentId,severity:editing.severity,responsible:editing.responsible,followUpDate:editing.followUpDate,action:editing.action,notes:editing.notes,correctionReason:editing.correctionReason}})
    setEditing(null)
   }catch(error){alert(error.message)}
 }
 async function applyTransition(e){
   e.preventDefault()
   try{
    await execute({operation:MIPE_OPERATIONS.TRANSITION_FINDING,entityId:transitioning.finding.id,input:{transition:transitioning.transition,reason:transitioning.reason}})
    setTransitioning(null)
   }catch(error){alert(error.message)}
 }

 return <>
  <PageHeader title="Hallazgos MIPE" subtitle="Consulta el reporte original, seguimiento, responsable, ubicación y evolución auditable de cada caso dentro del contexto operativo activo."/>
  <Card title="Filtros">
   <div className="form-grid four">
    <Field label="Estado"><select value={filters.status} onChange={e=>setFilters({...filters,status:e.target.value})}><option>Todos</option>{findingStatuses.map(x=><option key={x}>{x}</option>)}</select></Field>
    <Field label="Incidencia"><select value={filters.incidentId} onChange={e=>setFilters({...filters,incidentId:e.target.value})}><option value="Todos">Todas</option>{state.incidents.map(i=><option key={i.id} value={i.id}>{i.name}</option>)}</select></Field>
    <Field label="Nave"><select value={filters.houseId} onChange={e=>setFilters({...filters,houseId:e.target.value})}><option value="Todos">Todas</option>{state.houses.map(h=><option key={h.id} value={h.id}>{h.name}</option>)}</select></Field>
    <Field label="Seguimiento"><select value={filters.followUp} onChange={e=>setFilters({...filters,followUp:e.target.value})}><option>Todos</option><option>Pendientes</option><option>Programados</option></select></Field>
   </div>
  </Card>

  <div className="summary-strip">
   <div><span>Total visibles</span><strong>{rows.length}</strong></div>
   <div><span>Seguimientos vencidos</span><strong className="warn">{overdueCount}</strong></div>
   <div><span>Críticos</span><strong>{rows.filter(x=>Number(x.severity)>=4).length}</strong></div>
   <div><span>Resueltos</span><strong>{rows.filter(x=>x.status==='Resuelto').length}</strong></div>
  </div>

  {hasFindings&&overdueCount===0&&<StateMessage compact type="success" title="Seguimientos al día" message="No hay seguimientos vencidos dentro de los hallazgos visibles."/>}

  <Card title="Registros">
   {!hasFindings?<StateMessage title="No hay hallazgos MIPE" message="Los reportes sanitarios aparecerán aquí cuando se registre el primer hallazgo desde la operación o el mapa de cultivo."/>:
   !rows.length?<StateMessage type="info" title="Sin coincidencias" message="Hay hallazgos registrados, pero ninguno coincide con el contexto y los filtros seleccionados."/>:
   <div className="table-scroll">
    <table>
     <thead><tr><th>Fecha reporte</th><th>Próximo seguimiento</th><th>Ubicación</th><th>Genética</th><th>Incidencia</th><th>Severidad</th><th>Estado</th><th>Responsable</th><th>Acción/observación</th><th>Acciones</th></tr></thead>
     <tbody>{rows.map(f=>{const loc=findingLocation(state,f),inc=state.incidents.find(i=>i.id===f.incidentId),gen=state.genetics.find(g=>g.id===loc.plant?.geneticId),transitions=availableMipeFindingTransitions(f);return <tr key={f.id} className={isFollowUpDue(f)?'row-overdue':''}>
       <td>{formatDateTime(f.createdAt)}</td><td><span className={isFollowUpDue(f)?'tag danger-tag':'tag'}>{f.followUpDate||'Sin programar'}</span></td>
       <td>{loc.site?.name} · {loc.house?.name} · {loc.bed?.name}<small>{loc.plant?plantCode(state,loc.plant):''}</small></td>
       <td>{gen?.name||'Sin genética'}</td><td><span className="color-dot inline" style={{background:inc?.color}}/>{inc?.name||f.type||'Sin definir'}</td>
       <td>{severityLabels[f.severity]||f.severity}</td><td><span className={`tag ${f.status==='Resuelto'?'success':''}`}>{f.status}</span></td>
       <td>{f.responsible||'—'}</td><td><strong>{f.action||'—'}</strong><small>{f.notes||'Sin observación'}</small></td>
       <td className="row-actions"><button onClick={()=>startCorrection(f)}>Corregir</button><button disabled={!transitions.length} onClick={()=>startTransition(f)}>Cambiar estado</button></td>
      </tr>})}</tbody>
    </table>
   </div>}
  </Card>

  <Modal open={Boolean(editing)} title="Corrección auditable del hallazgo" onClose={()=>setEditing(null)}>
   {editing&&<form id="mipe-finding-correction" data-module="Hallazgo MIPE" data-record-id={editing.id} className="form-grid modal-form" onSubmit={saveCorrection}>
    <ValidationMessage type="info">La fecha original y el estado no se reescriben. La corrección conserva evidencia antes/después y exige un motivo.</ValidationMessage>
    <Field label="Fecha original"><input value={formatDateTime(editing.createdAt)} disabled/></Field>
    <Field label="Estado actual"><input value={editing.status||''} disabled/></Field>
    <Field label="Incidencia"><select value={editing.incidentId||''} onChange={e=>setEditing({...editing,incidentId:e.target.value})}>{state.incidents.map(i=><option key={i.id} value={i.id}>{i.name}</option>)}</select></Field>
    <Field label="Severidad"><select value={editing.severity} onChange={e=>setEditing({...editing,severity:Number(e.target.value)})}>{Object.entries(severityLabels).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></Field>
    <Field label="Responsable"><input value={editing.responsible||''} onChange={e=>setEditing({...editing,responsible:e.target.value})}/></Field>
    <Field label="Fecha de seguimiento"><input type="date" value={editing.followUpDate||''} onChange={e=>setEditing({...editing,followUpDate:e.target.value})}/></Field>
    <Field label="Acción tomada"><input value={editing.action||''} onChange={e=>setEditing({...editing,action:e.target.value})}/></Field>
    <Field label="Observación técnica"><textarea value={editing.notes||''} onChange={e=>setEditing({...editing,notes:e.target.value})}/></Field>
    <Field label="Motivo de la corrección"><textarea required value={editing.correctionReason||''} onChange={e=>setEditing({...editing,correctionReason:e.target.value})}/></Field>
    <FormActions><button type="button" className="button secondary" onClick={()=>setEditing(null)}>Cancelar</button><button className="button primary">Registrar corrección</button></FormActions>
   </form>}
  </Modal>

  <Modal open={Boolean(transitioning)} title="Cambiar estado del hallazgo" onClose={()=>setTransitioning(null)}>
   {transitioning&&<form id="mipe-finding-transition" data-module="Hallazgo MIPE" data-record-id={transitioning.finding.id} className="form-grid modal-form" onSubmit={applyTransition}>
    <ValidationMessage type="info">Solo se muestran transiciones permitidas desde el estado actual. Cada cambio queda agregado al historial MIPE.</ValidationMessage>
    <Field label="Estado actual"><input value={transitioning.finding.status||''} disabled/></Field>
    <Field label="Transición"><select required value={transitioning.transition} onChange={e=>setTransitioning({...transitioning,transition:e.target.value})}>{transitioning.options.map(option=><option key={option.name} value={option.name}>{option.label} → {option.to}</option>)}</select></Field>
    <Field label="Motivo / observación"><textarea value={transitioning.reason} onChange={e=>setTransitioning({...transitioning,reason:e.target.value})}/></Field>
    <FormActions><button type="button" className="button secondary" onClick={()=>setTransitioning(null)}>Cancelar</button><button className="button primary">Aplicar transición</button></FormActions>
   </form>}
  </Modal>
 </>
}
