import{useMemo,useState}from'react'
import{X,Leaf,AlertTriangle,History,Link2}from'lucide-react'
import{createMaterialPlantPassportFromState}from'../core/passport/index.js'
import{MATERIAL_PLANT_TYPES,projectLotPlantUnits}from'../domain/materialPlantIdentity.js'

const labelFor=type=>type===MATERIAL_PLANT_TYPES.GRANDMOTHER?'Abuelas':'Madres'
const lotsFor=(state,type)=>type===MATERIAL_PLANT_TYPES.GRANDMOTHER?state.grandmotherPlants:state.motherPlants

export default function MaterialPlantMapLayer({state,siteId}){
 const[activeId,setActiveId]=useState(null)
 const groups=useMemo(()=>[MATERIAL_PLANT_TYPES.GRANDMOTHER,MATERIAL_PLANT_TYPES.MOTHER].map(type=>({
  type,
  lots:lotsFor(state,type).filter(lot=>!siteId||lot.siteId===siteId).map(lot=>({lot,units:projectLotPlantUnits(lot,{plantType:type,overrides:state.materialPlantUnits})}))
 })),[state,siteId])
 const active=groups.flatMap(group=>group.lots.flatMap(entry=>entry.units)).find(unit=>unit.id===activeId)||null
 const passport=active?createMaterialPlantPassportFromState(state,{unitId:active.id}):null
 return <section className="material-map-layer" aria-label="Material vegetal individual">
  <header className="admin-summary-row"><div><strong>Material vegetal individual</strong><span>Abuelas y Madres de la sede seleccionada</span></div></header>
  <div className="material-map-groups">{groups.map(group=><section key={group.type} className="material-map-group"><h3>{labelFor(group.type)}</h3>{group.lots.length?group.lots.map(({lot,units})=><article key={lot.id} className="material-map-lot"><header><strong>{lot.lotCode||lot.code||lot.id}</strong><span>{units.length} plantas</span></header><div className="material-unit-grid">{units.map(unit=><button type="button" key={unit.id} className={`material-unit-card${unit.healthStatus&&unit.healthStatus!=='Sana'?' is-risk':''}`} onClick={()=>setActiveId(unit.id)} title={`${unit.code} · ${unit.healthStatus||'Sin sanidad'}`}><Leaf size={15}/><span><strong>{unit.code}</strong><small>{unit.healthStatus||'Sin sanidad'}</small></span></button>)}</div></article>):<p className="inline-empty">Sin {labelFor(group.type).toLowerCase()} en esta sede.</p>}</section>)}</div>
  {active&&passport&&<aside className="material-unit-passport" aria-label={`Passport de ${active.code}`}><button type="button" className="map-side-close" onClick={()=>setActiveId(null)}><X size={18}/> Cerrar</button><div className="plant-drawer-hero"><Leaf size={24}/><div><span>Passport universal</span><h3>{passport.object.label}</h3></div></div><div className="detail-grid"><div><span>Estado</span><strong>{passport.object.status}</strong></div><div><span>Sanidad</span><strong>{passport.object.attributes.healthStatus||'—'}</strong></div><div><span>Tipo</span><strong>{labelFor(active.plantType).slice(0,-1)}</strong></div><div><span>Lote</span><strong>{active.sourceLot?.lotCode||'—'}</strong></div></div>{passport.risks.length>0&&<section className="drawer-findings"><h4><AlertTriangle size={17}/> Riesgos</h4>{passport.risks.map(item=><p key={item.id}>{item.label}</p>)}</section>}<section className="drawer-findings"><h4><Link2 size={17}/> Relaciones</h4>{passport.relationships.length?passport.relationships.map(item=><p key={`${item.type}:${item.targetId}`}>{item.label}</p>):<p className="inline-empty">Sin relaciones.</p>}</section><section className="drawer-findings"><h4><History size={17}/> Timeline</h4>{passport.timeline.length?passport.timeline.slice(0,8).map((item,index)=><p key={item.id||index}>{item.title||item.eventName||'Actividad'}</p>):<p className="inline-empty">Sin eventos individuales.</p>}</section></aside>}
 </section>
}
