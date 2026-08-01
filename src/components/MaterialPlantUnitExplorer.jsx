import{useMemo,useState}from'react'
import{CheckSquare,Leaf,Square,X}from'lucide-react'
import{createSelection,toggleSelection,selectAll,clearSelection,isSelected,selectionSummary}from'../core/selection/index.js'
import{publishDomainEvent}from'../core/events/publishDomainEvent.js'
import{MATERIAL_PLANT_TYPES,projectLotPlantUnits}from'../domain/materialPlantIdentity.js'
import{applyMaterialPlantUnitPatch,materialPlantActionDetail}from'../domain/materialPlantActions.js'

const typeLabel=type=>type===MATERIAL_PLANT_TYPES.GRANDMOTHER?'Abuela':'Madre'
const emptyDraft={status:'',healthStatus:'',siteId:'',notes:'',confirmed:false}

export default function MaterialPlantUnitExplorer({state,update,lots,plantType,title}){
 const units=useMemo(()=>lots.flatMap(lot=>projectLotPlantUnits(lot,{plantType,overrides:state.materialPlantUnits})),[lots,plantType,state.materialPlantUnits])
 const scopeId=plantType.toLowerCase()
 const[selection,setSelection]=useState(()=>createSelection({scopeType:'material.plant',scopeId}))
 const[activeId,setActiveId]=useState(null)
 const[draft,setDraft]=useState(emptyDraft)
 const availableIds=units.map(unit=>unit.id)
 const summary=selectionSummary(selection,availableIds)
 const active=units.find(unit=>unit.id===activeId)||null
 const selectedUnits=units.filter(unit=>selection.selectedIds.includes(unit.id))
 const activeLot=active?.sourceLot||null
 const genetic=state.genetics.find(item=>item.id===active?.geneticId)||null
 const site=state.sites.find(item=>item.id===active?.siteId)||null
 const origin=plantType===MATERIAL_PLANT_TYPES.MOTHER?state.grandmotherPlants.find(item=>item.id===activeLot?.grandmotherPlantId):null
 function choose(unit){setActiveId(unit.id);setSelection(current=>toggleSelection(current,unit.id));setDraft({...emptyDraft,status:unit.status,healthStatus:unit.healthStatus,siteId:unit.siteId||'',notes:unit.notes||''})}
 function patchFromDraft(){return Object.fromEntries(Object.entries({status:draft.status,healthStatus:draft.healthStatus,siteId:draft.siteId,notes:draft.notes}).filter(([,value])=>value!==''))}
 function persist(targets,{bulk=false}={}){
  const patch=patchFromDraft()
  if(!Object.keys(patch).length)return alert('Selecciona al menos un cambio para guardar.')
  if(bulk&&!draft.confirmed)return alert('Confirma la acción masiva antes de continuar.')
  const detail=materialPlantActionDetail(targets,patch)
  update(current=>applyMaterialPlantUnitPatch(current,targets,patch),{module:'Material vegetal',action:bulk?'Plantas actualizadas masivamente':'Planta actualizada',detail})
  for(const plant of targets){
   const targetSite=state.sites.find(item=>item.id===(patch.siteId||plant.siteId))
   publishDomainEvent(state,{name:'material.plant.updated',aggregateType:'material.plant',aggregateId:plant.id,organizationId:targetSite?.companyId||state.currentContext?.companyId||'local-installation',siteId:patch.siteId||plant.siteId||null,payload:{plantType:plant.plantType,lotId:plant.lotId,code:plant.code,changes:patch,bulk,targetCount:targets.length}})
  }
  setDraft(value=>({...value,confirmed:false}))
 }
 return <section className="material-unit-explorer">
  <div className="admin-summary-row">
   <div><strong>{title}</strong><span>{units.length} plantas individuales</span></div>
   <div className="button-row">
    <button type="button" className="button secondary" onClick={()=>setSelection(current=>selectAll(current,availableIds))}>Seleccionar todas</button>
    <button type="button" className="button ghost" disabled={summary.isEmpty} onClick={()=>setSelection(current=>clearSelection(current))}>Limpiar selección</button>
   </div>
  </div>
  <p className="form-help" aria-live="polite">{summary.selectedCount} de {summary.availableCount} plantas seleccionadas.</p>
  {summary.selectedCount>1&&<div className="inline-operational-form">
   <strong>Acción masiva sobre {summary.selectedCount} plantas</strong>
   <select aria-label="Estado masivo" value={draft.status} onChange={event=>setDraft({...draft,status:event.target.value})}><option value="">Conservar estado</option><option>Activa</option><option>En seguimiento</option><option>Retirada</option><option>Descartada</option><option>Fallecida</option><option>Banco genético</option></select>
   <select aria-label="Sanidad masiva" value={draft.healthStatus} onChange={event=>setDraft({...draft,healthStatus:event.target.value})}><option value="">Conservar sanidad</option><option>Sana</option><option>En seguimiento</option><option>No apta</option></select>
   <select aria-label="Sede masiva" value={draft.siteId} onChange={event=>setDraft({...draft,siteId:event.target.value})}><option value="">Conservar sede</option>{state.sites.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select>
   <textarea aria-label="Observación masiva" placeholder="Observación común" value={draft.notes} onChange={event=>setDraft({...draft,notes:event.target.value})}/>
   <label className="checkbox-row"><input type="checkbox" checked={draft.confirmed} onChange={event=>setDraft({...draft,confirmed:event.target.checked})}/> Confirmo aplicar esta acción a {summary.selectedCount} plantas.</label>
   <button type="button" className="button primary" onClick={()=>persist(selectedUnits,{bulk:true})}>Aplicar cambios masivos</button>
  </div>}
  {!units.length?<p className="inline-empty">Aún no existen plantas individuales para mostrar.</p>:<div className="material-unit-layout">
   <div className="material-unit-grid" role="list" aria-label={title}>{units.map(unit=>{
    const selected=isSelected(selection,unit.id)
    const unitGenetic=state.genetics.find(item=>item.id===unit.geneticId)
    return <button type="button" role="listitem" aria-pressed={selected} className={`material-unit-card${selected?' is-selected':''}`} key={unit.id} onClick={()=>choose(unit)}>
     {selected?<CheckSquare size={18}/>:<Square size={18}/>}<span><strong>{unit.code}</strong><small>{unitGenetic?.name||'Sin genética'} · {unit.healthStatus}</small></span>
    </button>})}</div>
   {active&&<aside className="material-unit-passport" aria-label={`Passport de ${active.code}`}>
    <button type="button" className="map-side-close" onClick={()=>setActiveId(null)}><X size={18}/> Cerrar</button>
    <div className="plant-drawer-hero"><Leaf size={24}/><div><span>Passport individual · {typeLabel(plantType)}</span><h3>{active.code}</h3></div></div>
    <div className="detail-grid">
     <div><span>Lote</span><strong>{activeLot?.lotCode||'—'}</strong></div><div><span>Genética</span><strong>{genetic?.name||'Sin asignar'}</strong></div><div><span>Sede</span><strong>{site?.name||'Sin asignar'}</strong></div><div><span>Estado</span><strong>{active.status}</strong></div><div><span>Sanidad</span><strong>{active.healthStatus}</strong></div><div><span>Índice dentro del lote</span><strong>{active.unitIndex+1}</strong></div><div><span>Inicio del ciclo</span><strong>{activeLot?.cycleStartedAt||active.createdAt||'—'}</strong></div><div><span>Origen</span><strong>{origin?.lotCode||activeLot?.source||'—'}</strong></div>
    </div>
    <section className="drawer-findings"><h4>Actualizar planta</h4>
     <select aria-label="Estado individual" value={draft.status} onChange={event=>setDraft({...draft,status:event.target.value})}><option>Activa</option><option>En seguimiento</option><option>Retirada</option><option>Descartada</option><option>Fallecida</option><option>Banco genético</option></select>
     <select aria-label="Sanidad individual" value={draft.healthStatus} onChange={event=>setDraft({...draft,healthStatus:event.target.value})}><option>Sana</option><option>En seguimiento</option><option>No apta</option></select>
     <select aria-label="Sede individual" value={draft.siteId} onChange={event=>setDraft({...draft,siteId:event.target.value})}>{state.sites.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select>
     <textarea aria-label="Observaciones individuales" value={draft.notes} onChange={event=>setDraft({...draft,notes:event.target.value})} placeholder="Observaciones de esta planta"/>
     <button type="button" className="button primary full-width" onClick={()=>persist([active])}>Guardar planta</button>
    </section>
   </aside>}
  </div>}
 </section>
}
