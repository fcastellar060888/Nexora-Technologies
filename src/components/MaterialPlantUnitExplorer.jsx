import{useMemo,useState}from'react'
import{CheckSquare,Leaf,Square,X}from'lucide-react'
import{createSelection,toggleSelection,selectAll,clearSelection,isSelected,selectionSummary}from'../core/selection/index.js'
import{MATERIAL_PLANT_TYPES,projectLotPlantUnits}from'../domain/materialPlantIdentity.js'

const typeLabel=type=>type===MATERIAL_PLANT_TYPES.GRANDMOTHER?'Abuela':'Madre'

export default function MaterialPlantUnitExplorer({state,lots,plantType,title}){
 const units=useMemo(()=>lots.flatMap(lot=>projectLotPlantUnits(lot,{plantType,overrides:state.materialPlantUnits})),[lots,plantType,state.materialPlantUnits])
 const scopeId=plantType.toLowerCase()
 const[selection,setSelection]=useState(()=>createSelection({scopeType:'material.plant',scopeId}))
 const[activeId,setActiveId]=useState(null)
 const availableIds=units.map(unit=>unit.id)
 const summary=selectionSummary(selection,availableIds)
 const active=units.find(unit=>unit.id===activeId)||null
 const activeLot=active?.sourceLot||null
 const genetic=state.genetics.find(item=>item.id===active?.geneticId)||null
 const site=state.sites.find(item=>item.id===active?.siteId)||null
 const origin=plantType===MATERIAL_PLANT_TYPES.MOTHER?state.grandmotherPlants.find(item=>item.id===activeLot?.grandmotherPlantId):null
 function choose(unit){setActiveId(unit.id);setSelection(current=>toggleSelection(current,unit.id))}
 return <section className="material-unit-explorer">
  <div className="admin-summary-row">
   <div><strong>{title}</strong><span>{units.length} plantas individuales</span></div>
   <div className="button-row">
    <button type="button" className="button secondary" onClick={()=>setSelection(current=>selectAll(current,availableIds))}>Seleccionar todas</button>
    <button type="button" className="button ghost" disabled={summary.isEmpty} onClick={()=>setSelection(current=>clearSelection(current))}>Limpiar selección</button>
   </div>
  </div>
  <p className="form-help" aria-live="polite">{summary.selectedCount} de {summary.availableCount} plantas seleccionadas.</p>
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
     <div><span>Lote</span><strong>{activeLot?.lotCode||'—'}</strong></div>
     <div><span>Genética</span><strong>{genetic?.name||'Sin asignar'}</strong></div>
     <div><span>Sede</span><strong>{site?.name||'Sin asignar'}</strong></div>
     <div><span>Estado</span><strong>{active.status}</strong></div>
     <div><span>Sanidad</span><strong>{active.healthStatus}</strong></div>
     <div><span>Índice dentro del lote</span><strong>{active.unitIndex+1}</strong></div>
     <div><span>Inicio del ciclo</span><strong>{activeLot?.cycleStartedAt||active.createdAt||'—'}</strong></div>
     <div><span>Origen</span><strong>{origin?.lotCode||activeLot?.source||'—'}</strong></div>
    </div>
    <section className="drawer-findings"><h4>Observaciones</h4><p>{active.notes||activeLot?.notes||'Sin observaciones registradas.'}</p></section>
   </aside>}
  </div>}
 </section>
}
