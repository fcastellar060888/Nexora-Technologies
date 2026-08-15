import{Leaf,X}from'lucide-react'
import{createMaterialPlantPassportFromState}from'../core/passport/index.js'
import{MATERIAL_PLANT_TYPES,projectLotPlantUnits}from'../domain/materialPlantIdentity.js'

const labelFor=type=>type===MATERIAL_PLANT_TYPES.GRANDMOTHER?'Abuelas':'Madres'

export function MaterialPlantMapContents({state,siteId,plantType,onSelect}){
 const lots=(plantType===MATERIAL_PLANT_TYPES.GRANDMOTHER?state.grandmotherPlants:state.motherPlants).filter(item=>item.siteId===siteId&&item.status!=='Retirada')
 const units=lots.flatMap(lot=>projectLotPlantUnits(lot,{plantType,overrides:state.materialPlantUnits}))
 return <div className="unified-bed-list">
  {lots.map(lot=>{const lotUnits=units.filter(unit=>unit.lotId===lot.id),genetic=state.genetics.find(item=>item.id===lot.geneticId);return <article className="unified-bed" key={lot.id}>
   <header><div><strong>{lot.lotCode}</strong><span>{lotUnits.length} plantas</span></div><small>{genetic?.name||'Sin genética'}</small></header>
   <div className="unified-plant-grid" style={{gridTemplateColumns:'repeat(auto-fill,minmax(46px,1fr))'}}>{lotUnits.map(unit=><button type="button" key={unit.id} className={`unified-plant-cell active ${unit.healthStatus==='No apta'?'risk':''}`} title={`${unit.code} · ${unit.status} · ${unit.healthStatus}`} onClick={event=>{event.stopPropagation();onSelect({kind:'material',unit,plantType})}}><span>{unit.code.split('-').at(-1)}</span></button>)}</div>
  </article>})}
  {!lots.length&&<div className="inline-empty">Sin {labelFor(plantType).toLowerCase()} configuradas en esta sede</div>}
 </div>
}

export function MaterialPlantMapDrawer({state,selection,onClose}){
 let passport=null
 try{passport=createMaterialPlantPassportFromState(state,{unitId:selection.unit.id})}catch{return null}
 const unit=selection.unit
 const lot=unit.sourceLot
 const genetic=state.genetics.find(item=>item.id===unit.geneticId)
 const site=state.sites.find(item=>item.id===unit.siteId)
 return <aside className="unified-map-drawer" aria-label={`Passport de ${unit.code}`}>
  <button className="map-side-close" onClick={onClose}><X size={18}/> Cerrar</button>
  <div className="plant-drawer-hero"><Leaf size={24}/><div><span>Passport universal · {selection.plantType===MATERIAL_PLANT_TYPES.GRANDMOTHER?'Abuela':'Madre'}</span><h3>{passport.object.label}</h3></div></div>
  <div className="detail-grid"><div><span>Lote</span><strong>{lot?.lotCode||'—'}</strong></div><div><span>Genética</span><strong>{genetic?.name||'Sin asignar'}</strong></div><div><span>Sede</span><strong>{site?.name||'Sin asignar'}</strong></div><div><span>Estado</span><strong>{passport.object.status}</strong></div><div><span>Sanidad</span><strong>{passport.object.attributes.healthStatus||'—'}</strong></div><div><span>Relaciones</span><strong>{passport.relationships.length}</strong></div><div><span>Documentos</span><strong>{passport.documents.length}</strong></div><div><span>Eventos</span><strong>{passport.timeline.length}</strong></div></div>
  <section className="drawer-findings"><h4>Genealogía y relaciones</h4>{passport.relationships.length?passport.relationships.map(item=><p key={`${item.type}:${item.targetId}`}><strong>{item.type.replaceAll('_',' ')}:</strong> {item.label}</p>):<p className="inline-empty">Sin relaciones registradas.</p>}</section>
  <section className="drawer-findings"><h4>Timeline</h4>{passport.timeline.length?passport.timeline.slice(0,8).map((item,index)=><article key={item.id||index}><strong>{item.title||item.eventName||'Actividad'}</strong><span>{item.summary||item.detail||''}</span></article>):<p className="inline-empty">Sin eventos individuales todavía.</p>}</section>
 </aside>
}
