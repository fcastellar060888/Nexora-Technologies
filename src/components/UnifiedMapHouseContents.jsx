import{lotTiming}from'../domain/lifecycle'
import{isSelected}from'../core/selection/index.js'

const plantLabel=plant=>plant.code||plant.plantCode||`F${plant.row||1}-P${plant.position||1}`

export default function UnifiedMapHouseContents({state,houseId,layer,selectPlant,selection,selectionMode}){
 const beds=state.beds.filter(bed=>bed.houseId===houseId&&bed.active!==false).sort((a,b)=>(a.order||0)-(b.order||0))
 return <div className="unified-bed-list">{beds.map(bed=>{
  const plants=state.plantPositions.filter(plant=>plant.bedId===bed.id).sort((a,b)=>(a.row||0)-(b.row||0)||(a.position||0)-(b.position||0))
  const lot=state.propagationBatches.find(value=>value.id===bed.lotId)
  return <article className="unified-bed" key={bed.id}>
   <header><div><strong>{bed.name}</strong><span>{plants.filter(plant=>plant.active!==false&&plant.status!=='Vacía').length} activas</span></div>{lot&&<small>{lot.code} · {layer==='Fase'?`${lot.phase} S${lotTiming(state,lot).week}`:layer==='Genética'?state.genetics.find(genetic=>genetic.id===lot.geneticId)?.name||'Sin genética':lot.phase}</small>}</header>
   <div className="unified-plant-grid" style={{gridTemplateColumns:`repeat(${Math.max(1,Number(bed.plantsPerRow)||1)},minmax(18px,1fr))`}}>{plants.map(plant=><PlantCell key={plant.id} state={state} plant={plant} bed={bed} lot={lot} layer={layer} selected={isSelected(selection,plant.id)} selectionMode={selectionMode} onClick={()=>selectPlant({kind:'plant',plant,bed,lot})}/>)}</div>
  </article>
 })}{!beds.length&&<div className="inline-empty">Sin camas activas configuradas</div>}</div>
}

function PlantCell({state,plant,bed,lot,layer,onClick,selected,selectionMode}){
 const findings=state.findings.filter(item=>item.plantPositionId===plant.id&&!['Resuelto','Falso positivo'].includes(item.status))
 const genetic=state.genetics.find(item=>item.id===(plant.geneticId||bed.geneticId||lot?.geneticId))
 let label=plantLabel(plant)
 if(layer==='Genética')label=genetic?.name?.slice(0,3)||'—'
 if(layer==='Fase')label=lot?.phase?.slice(0,3)||'—'
 return <button type="button" aria-pressed={selectionMode?selected:undefined} className={`unified-plant-cell ${plant.active!==false&&plant.status!=='Vacía'?'active':'empty'} ${findings.length?'risk':''} ${selected?'selected':''}`} title={`${plantLabel(plant)} · ${findings.length} hallazgos abiertos${selected?' · seleccionada':''}`} onClick={event=>{event.stopPropagation();onClick()}}><span>{label}</span>{findings.length>0&&<b>{findings.length}</b>}</button>
}
