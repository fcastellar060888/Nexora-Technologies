import{useMemo,useState}from'react'
import{MIPE_INTERVENTION_TYPES,interventionsForFinding,isOpenMipeFinding,shouldSuggestMipeBlock}from'../domain/materialPlantMipe.js'
import{MIPE_OPERATIONS}from'../services/mipeCommand.js'
import{useMipeCommandStore}from'../services/mipeCommandStore.js'

const emptyDraft={type:'',severity:'Media',notes:'',restrictAvailability:false,confirmed:false}
const emptyResolution={findingId:'',status:'Resuelto',notes:'',releaseAvailability:true}
const emptyIntervention={type:MIPE_INTERVENTION_TYPES.TREATMENT,product:'',dose:'',responsible:'',outcome:'',notes:'',performedAt:'',nextReviewAt:''}

export default function MaterialPlantMipePanel({plants,onComplete}){
 const{state,execute}=useMipeCommandStore()
 const[draft,setDraft]=useState(emptyDraft),[resolution,setResolution]=useState(emptyResolution),[intervention,setIntervention]=useState(emptyIntervention)
 const count=plants.length,plantIds=useMemo(()=>new Set(plants.map(item=>item.id)),[plants])
 const openFindings=useMemo(()=>(state.findings||[]).filter(item=>plantIds.has(item.materialPlantId)&&isOpenMipeFinding(item)),[state.findings,plantIds])
 const selectedFinding=openFindings.find(item=>item.id===resolution.findingId)||null
 const selectedInterventions=useMemo(()=>selectedFinding?interventionsForFinding(state,selectedFinding.id):[],[state,selectedFinding])
 function changeSeverity(severity){setDraft(current=>({...current,severity,restrictAvailability:shouldSuggestMipeBlock(severity)}))}
 async function submit(){
  if(!draft.type.trim())return alert('Escribe el tipo de hallazgo MIPE.')
  if(count>1&&!draft.confirmed)return alert('Confirma el registro MIPE masivo antes de continuar.')
  try{await execute({operation:MIPE_OPERATIONS.CREATE_MATERIAL_FINDINGS,input:{plantIds:plants.map(item=>item.id),type:draft.type,severity:draft.severity,notes:draft.notes,restrictAvailability:draft.restrictAvailability}})}catch(error){return alert(error.message)}
  setDraft(emptyDraft);onComplete?.()
 }
 async function registerIntervention(){
  if(!selectedFinding)return alert('Selecciona primero un hallazgo abierto.')
  try{await execute({operation:MIPE_OPERATIONS.RECORD_INTERVENTION,input:{findingId:selectedFinding.id,...intervention,performedAt:intervention.performedAt||new Date().toISOString()}})}catch(error){return alert(error.message)}
  setIntervention(emptyIntervention)
 }
 async function resolveFinding(){
  if(!selectedFinding)return alert('Selecciona un hallazgo abierto.')
  try{await execute({operation:MIPE_OPERATIONS.RESOLVE_FINDING,entityId:selectedFinding.id,input:{status:resolution.status,resolutionNotes:resolution.notes,releaseAvailability:resolution.releaseAvailability}})}catch(error){return alert(error.message)}
  setResolution(emptyResolution);setIntervention(emptyIntervention)
 }
 if(!count)return null
 return <div className="inline-operational-form">
  <strong>{count>1?`Registrar MIPE en ${count} plantas`:'Registrar MIPE individual'}</strong>
  <input aria-label="Tipo de hallazgo MIPE" placeholder="Plaga, enfermedad o hallazgo" value={draft.type} onChange={event=>setDraft({...draft,type:event.target.value})}/>
  <select aria-label="Severidad MIPE" value={draft.severity} onChange={event=>changeSeverity(event.target.value)}><option>Baja</option><option>Media</option><option>Alta</option><option>Crítica</option></select>
  <textarea aria-label="Observaciones MIPE" placeholder="Observaciones opcionales" value={draft.notes} onChange={event=>setDraft({...draft,notes:event.target.value})}/>
  <label className="checkbox-row"><input type="checkbox" checked={draft.restrictAvailability} onChange={event=>setDraft({...draft,restrictAvailability:event.target.checked})}/><span>Bloquear estas plantas para corte de esquejes hasta revisión y rehabilitación.</span></label>
  {shouldSuggestMipeBlock(draft.severity)&&<p className="form-help text-danger">La severidad crítica sugiere bloquear temporalmente la propagación. Puedes desactivar la acción si el responsable técnico determina que no aplica.</p>}
  {count>1&&<label className="checkbox-row"><input type="checkbox" checked={draft.confirmed} onChange={event=>setDraft({...draft,confirmed:event.target.checked})}/> Confirmo registrar este hallazgo en {count} plantas.</label>}
  <button type="button" className="button warning" onClick={submit}>Registrar hallazgo MIPE</button>
  {openFindings.length>0&&<div className="drawer-findings span-all"><strong>Intervenir, seguir y resolver hallazgo</strong><select aria-label="Hallazgo MIPE abierto" value={resolution.findingId} onChange={event=>{setResolution({...resolution,findingId:event.target.value});setIntervention(emptyIntervention)}}><option value="">Seleccionar hallazgo abierto</option>{openFindings.map(item=><option key={item.id} value={item.id}>{item.type} · {item.severity} · {item.materialPlantId}</option>)}</select>
   {selectedFinding&&<><div className="management-summary"><div><span>Hallazgo</span><strong>{selectedFinding.type}</strong></div><div><span>Severidad</span><strong>{selectedFinding.severity}</strong></div><div><span>Intervenciones</span><strong>{selectedInterventions.length}</strong></div></div><select aria-label="Tipo de intervención MIPE" value={intervention.type} onChange={event=>setIntervention({...intervention,type:event.target.value})}><option>Tratamiento</option><option>Seguimiento</option></select>{intervention.type==='Tratamiento'?<><input aria-label="Producto o tratamiento MIPE" placeholder="Producto o tratamiento aplicado" value={intervention.product} onChange={event=>setIntervention({...intervention,product:event.target.value})}/><input aria-label="Dosis MIPE" placeholder="Dosis, concentración o volumen" value={intervention.dose} onChange={event=>setIntervention({...intervention,dose:event.target.value})}/></>:<input aria-label="Resultado seguimiento MIPE" placeholder="Resultado de la inspección" value={intervention.outcome} onChange={event=>setIntervention({...intervention,outcome:event.target.value})}/>}<input aria-label="Responsable intervención MIPE" placeholder="Responsable" value={intervention.responsible} onChange={event=>setIntervention({...intervention,responsible:event.target.value})}/><input aria-label="Fecha intervención MIPE" type="datetime-local" value={intervention.performedAt} onChange={event=>setIntervention({...intervention,performedAt:event.target.value})}/><input aria-label="Próxima revisión MIPE" type="datetime-local" value={intervention.nextReviewAt} onChange={event=>setIntervention({...intervention,nextReviewAt:event.target.value})}/><textarea aria-label="Notas intervención MIPE" placeholder="Observaciones de la intervención" value={intervention.notes} onChange={event=>setIntervention({...intervention,notes:event.target.value})}/><button type="button" className="button secondary" onClick={registerIntervention}>Registrar intervención</button>{selectedInterventions.length>0&&<div className="drawer-findings">{selectedInterventions.map(item=><article key={item.id}><strong>{item.type}: {item.product||item.outcome}</strong><span>{item.responsible||'Sin responsable'} · {new Date(item.performedAt).toLocaleString()}</span>{item.dose&&<p>Dosis: {item.dose}</p>}{item.notes&&<p>{item.notes}</p>}</article>)}</div>}</>}
   <select aria-label="Resultado del hallazgo MIPE" value={resolution.status} onChange={event=>setResolution({...resolution,status:event.target.value})}><option>Resuelto</option><option>Falso positivo</option></select><textarea aria-label="Notas de resolución MIPE" placeholder="Verificación final y criterio técnico" value={resolution.notes} onChange={event=>setResolution({...resolution,notes:event.target.value})}/><label className="checkbox-row"><input type="checkbox" checked={resolution.releaseAvailability} onChange={event=>setResolution({...resolution,releaseAvailability:event.target.checked})}/><span>Rehabilitar para corte únicamente si no quedan otros hallazgos MIPE abiertos que restrinjan propagación.</span></label>{selectedFinding?.restrictsPropagation&&<p className="form-help">Nexora verificará todos los bloqueos abiertos de esta planta antes de habilitarla.</p>}<button type="button" className="button secondary" disabled={!selectedFinding} onClick={resolveFinding}>Cerrar hallazgo y evaluar rehabilitación</button></div>}
 </div>
}
