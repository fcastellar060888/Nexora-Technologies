import{useState}from'react'
import{publishDomainEvent}from'../core/events/publishDomainEvent.js'
import{appendMaterialPlantObservation}from'../domain/materialPlantActions.js'

const emptyDraft={title:'',detail:'',confirmed:false}

export default function MaterialPlantObservationPanel({state,update,plants,onComplete}){
 const[draft,setDraft]=useState(emptyDraft)
 const count=plants.length
 function submit(){
  if(!draft.title.trim())return alert('Escribe un título para la observación.')
  if(count>1&&!draft.confirmed)return alert('Confirma la observación masiva antes de continuar.')
  update(current=>appendMaterialPlantObservation(current,plants,{title:draft.title,detail:draft.detail}),{module:'Material vegetal',action:count>1?'Observación masiva registrada':'Observación registrada',detail:`${count} planta${count===1?'':'s'} · ${draft.title.trim()}`})
  for(const plant of plants){
   const site=state.sites.find(item=>item.id===plant.siteId)
   publishDomainEvent(state,{name:'material.plant.observation-recorded',aggregateType:'material.plant',aggregateId:plant.id,organizationId:site?.companyId||state.currentContext?.companyId||'local-installation',siteId:plant.siteId||null,payload:{plantType:plant.plantType,lotId:plant.lotId,code:plant.code,title:draft.title.trim(),detail:draft.detail.trim(),bulk:count>1,targetCount:count}})
  }
  setDraft(emptyDraft)
  onComplete?.()
 }
 if(!count)return null
 return <div className="inline-operational-form">
  <strong>{count>1?`Registrar observación en ${count} plantas`:'Registrar observación individual'}</strong>
  <input aria-label="Título de observación" placeholder="Título" value={draft.title} onChange={event=>setDraft({...draft,title:event.target.value})}/>
  <textarea aria-label="Detalle de observación" placeholder="Detalle opcional" value={draft.detail} onChange={event=>setDraft({...draft,detail:event.target.value})}/>
  {count>1&&<label className="checkbox-row"><input type="checkbox" checked={draft.confirmed} onChange={event=>setDraft({...draft,confirmed:event.target.checked})}/> Confirmo registrar esta observación en {count} plantas.</label>}
  <button type="button" className="button secondary" onClick={submit}>Registrar observación</button>
 </div>
}
