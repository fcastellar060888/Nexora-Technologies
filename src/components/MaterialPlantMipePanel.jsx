import{useMemo,useState}from'react'
import{publishDomainEvent}from'../core/events/publishDomainEvent.js'
import{appendMaterialPlantFindings,isOpenMipeFinding,materialPlantFindingDetail,resolveMaterialPlantFinding,shouldSuggestMipeBlock}from'../domain/materialPlantMipe.js'

const emptyDraft={type:'',severity:'Media',notes:'',restrictAvailability:false,confirmed:false}
const emptyResolution={findingId:'',status:'Resuelto',notes:'',releaseAvailability:true}

export default function MaterialPlantMipePanel({state,update,plants,onComplete}){
 const[draft,setDraft]=useState(emptyDraft),[resolution,setResolution]=useState(emptyResolution)
 const count=plants.length,plantIds=useMemo(()=>new Set(plants.map(item=>item.id)),[plants])
 const openFindings=useMemo(()=>(state.findings||[]).filter(item=>plantIds.has(item.materialPlantId)&&isOpenMipeFinding(item)),[state.findings,plantIds])
 const selectedFinding=openFindings.find(item=>item.id===resolution.findingId)||null
 function changeSeverity(severity){setDraft(current=>({...current,severity,restrictAvailability:shouldSuggestMipeBlock(severity)}))}
 function submit(){
  if(!draft.type.trim())return alert('Escribe el tipo de hallazgo MIPE.')
  if(count>1&&!draft.confirmed)return alert('Confirma el registro MIPE masivo antes de continuar.')
  update(current=>appendMaterialPlantFindings(current,plants,draft),{module:'MIPE',action:count>1?'Hallazgo masivo registrado':'Hallazgo registrado',detail:materialPlantFindingDetail(plants,draft)})
  for(const plant of plants){
   const site=state.sites.find(item=>item.id===plant.siteId)
   publishDomainEvent(state,{name:'mipe.finding.recorded',aggregateType:'material.plant',aggregateId:plant.id,organizationId:site?.companyId||state.currentContext?.companyId||'local-installation',siteId:plant.siteId||null,payload:{plantType:plant.plantType,lotId:plant.lotId,code:plant.code,type:draft.type.trim(),severity:draft.severity,notes:draft.notes.trim(),restrictAvailability:draft.restrictAvailability,bulk:count>1,targetCount:count}})
  }
  setDraft(emptyDraft);onComplete?.()
 }
 function resolveFinding(){
  if(!selectedFinding)return alert('Selecciona un hallazgo abierto.')
  let outcome
  try{
   update(current=>{const result=resolveMaterialPlantFinding(current,{findingId:selectedFinding.id,status:resolution.status,resolutionNotes:resolution.notes,releaseAvailability:resolution.releaseAvailability});outcome=result;return result.state},{module:'MIPE',action:'Hallazgo resuelto',detail:`${selectedFinding.type} · ${resolution.status}`})
  }catch(error){return alert(error.message)}
  const plant=plants.find(item=>item.id===selectedFinding.materialPlantId),site=state.sites.find(item=>item.id===selectedFinding.siteId)
  publishDomainEvent(state,{name:'mipe.finding.resolved',aggregateType:'material.plant',aggregateId:selectedFinding.materialPlantId,organizationId:site?.companyId||state.currentContext?.companyId||'local-installation',siteId:selectedFinding.siteId||null,payload:{findingId:selectedFinding.id,type:selectedFinding.type,status:resolution.status,resolutionNotes:resolution.notes.trim(),released:Boolean(outcome?.released),remainingBlockingFindings:outcome?.remainingBlockingFindings??0,plantType:plant?.plantType||selectedFinding.plantType,lotId:plant?.lotId||selectedFinding.lotId}})
  setResolution(emptyResolution)
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
  {openFindings.length>0&&<div className="drawer-findings span-all"><strong>Resolver hallazgo y revisar rehabilitación</strong><select aria-label="Hallazgo MIPE abierto" value={resolution.findingId} onChange={event=>setResolution({...resolution,findingId:event.target.value})}><option value="">Seleccionar hallazgo abierto</option>{openFindings.map(item=><option key={item.id} value={item.id}>{item.type} · {item.severity} · {item.materialPlantId}</option>)}</select><select aria-label="Resultado del hallazgo MIPE" value={resolution.status} onChange={event=>setResolution({...resolution,status:event.target.value})}><option>Resuelto</option><option>Falso positivo</option></select><textarea aria-label="Notas de resolución MIPE" placeholder="Verificación, tratamiento aplicado y criterio técnico" value={resolution.notes} onChange={event=>setResolution({...resolution,notes:event.target.value})}/><label className="checkbox-row"><input type="checkbox" checked={resolution.releaseAvailability} onChange={event=>setResolution({...resolution,releaseAvailability:event.target.checked})}/><span>Rehabilitar para corte únicamente si no quedan otros hallazgos MIPE abiertos que restrinjan propagación.</span></label>{selectedFinding?.restrictsPropagation&&<p className="form-help">Nexora verificará todos los bloqueos abiertos de esta planta antes de habilitarla.</p>}<button type="button" className="button secondary" disabled={!selectedFinding} onClick={resolveFinding}>Cerrar hallazgo y evaluar rehabilitación</button></div>}
 </div>
}
