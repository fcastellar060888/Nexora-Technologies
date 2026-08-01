import{useState}from'react'
import{publishDomainEvent}from'../core/events/publishDomainEvent.js'
import{appendMaterialPlantFindings,materialPlantFindingDetail}from'../domain/materialPlantMipe.js'

const emptyDraft={type:'',severity:'Media',notes:'',confirmed:false}

export default function MaterialPlantMipePanel({state,update,plants,onComplete}){
 const[draft,setDraft]=useState(emptyDraft)
 const count=plants.length
 function submit(){
  if(!draft.type.trim())return alert('Escribe el tipo de hallazgo MIPE.')
  if(count>1&&!draft.confirmed)return alert('Confirma el registro MIPE masivo antes de continuar.')
  update(current=>appendMaterialPlantFindings(current,plants,draft),{module:'MIPE',action:count>1?'Hallazgo masivo registrado':'Hallazgo registrado',detail:materialPlantFindingDetail(plants,draft)})
  for(const plant of plants){
   const site=state.sites.find(item=>item.id===plant.siteId)
   publishDomainEvent(state,{name:'mipe.finding.recorded',aggregateType:'material.plant',aggregateId:plant.id,organizationId:site?.companyId||state.currentContext?.companyId||'local-installation',siteId:plant.siteId||null,payload:{plantType:plant.plantType,lotId:plant.lotId,code:plant.code,type:draft.type.trim(),severity:draft.severity,notes:draft.notes.trim(),bulk:count>1,targetCount:count}})
  }
  setDraft(emptyDraft)
  onComplete?.()
 }
 if(!count)return null
 return <div className="inline-operational-form">
  <strong>{count>1?`Registrar MIPE en ${count} plantas`:'Registrar MIPE individual'}</strong>
  <input aria-label="Tipo de hallazgo MIPE" placeholder="Plaga, enfermedad o hallazgo" value={draft.type} onChange={event=>setDraft({...draft,type:event.target.value})}/>
  <select aria-label="Severidad MIPE" value={draft.severity} onChange={event=>setDraft({...draft,severity:event.target.value})}><option>Baja</option><option>Media</option><option>Alta</option><option>Crítica</option></select>
  <textarea aria-label="Observaciones MIPE" placeholder="Observaciones opcionales" value={draft.notes} onChange={event=>setDraft({...draft,notes:event.target.value})}/>
  {count>1&&<label className="checkbox-row"><input type="checkbox" checked={draft.confirmed} onChange={event=>setDraft({...draft,confirmed:event.target.checked})}/> Confirmo registrar este hallazgo en {count} plantas.</label>}
  <button type="button" className="button warning" onClick={submit}>Registrar hallazgo MIPE</button>
 </div>
}
