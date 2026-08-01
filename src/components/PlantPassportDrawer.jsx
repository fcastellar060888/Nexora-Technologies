import{AlertTriangle,FileText,Leaf,X}from'lucide-react'
import{createCultivationPlantPassportFromState}from'../core/passport/index.js'

const relation=(passport,type,targetType)=>passport.relationships.find(item=>item.type===type&&(!targetType||item.targetType===targetType))
const indicator=(passport,key)=>passport.indicators.find(item=>item.key===key)?.value||0

export default function PlantPassportDrawer({state,plantId,onClose,onOpen}){
 let passport=null
 try{passport=createCultivationPlantPassportFromState(state,{plantId})}catch{return null}
 const{object}=passport,attributes=object.attributes,identity=object.identity
 const bed=relation(passport,'located_in','cultivation.bed')
 const house=relation(passport,'located_in','cultivation.house')
 const site=relation(passport,'located_in','organization.site')
 const lot=relation(passport,'member_of_lot','cultivation.lot')
 const mother=relation(passport,'descends_from','cultivation.mother')
 const grandmother=relation(passport,'descends_from','cultivation.grandmother')
 return <aside className="unified-map-drawer" aria-label="Passport de la planta">
  <button className="map-side-close" onClick={onClose}><X size={18}/> Cerrar</button>
  <div className="plant-drawer-hero"><Leaf size={24}/><div><span>Passport universal</span><h3>{object.label}</h3></div></div>
  <div className="detail-grid">
   <div><span>Estado</span><strong>{object.status}</strong></div>
   <div><span>Genética</span><strong>{attributes.geneticName||'Sin asignar'}</strong></div>
   <div><span>Lote</span><strong>{lot?.label||'Sin lote'}</strong></div>
   <div><span>Fase</span><strong>{attributes.phase||'—'}</strong></div>
   <div><span>Ubicación</span><strong>{`${site?.label||'Sin sede'} · ${house?.label||'Sin nave'} · ${bed?.label||'Sin cama'} · F${identity.row??'—'} P${identity.position??'—'}`}</strong></div>
   <div><span>Hallazgos abiertos</span><strong className={indicator(passport,'open_mipe_findings')?'text-danger':''}>{indicator(passport,'open_mipe_findings')}</strong></div>
  </div>
  <section className="drawer-findings"><h4><AlertTriangle size={17}/> Riesgos MIPE</h4>{passport.risks.length?passport.risks.map(item=><article key={item.id}><strong>{item.label}</strong><span>{item.status||'Abierto'} · Severidad {item.severity??'—'}</span></article>):<p className="inline-empty">No hay hallazgos asociados.</p>}</section>
  <section className="drawer-findings"><h4><FileText size={17}/> Genealogía y documentos</h4><p><strong>Madre:</strong> {mother?.label||'Sin registrar'}</p><p><strong>Abuela:</strong> {grandmother?.label||'Sin registrar'}</p><p><strong>Adjuntos:</strong> {passport.documents.length}</p><p><strong>Eventos:</strong> {passport.timeline.length}</p></section>
  <button className="button primary full-width" onClick={onOpen}>Abrir perfil completo</button>
 </aside>
}
