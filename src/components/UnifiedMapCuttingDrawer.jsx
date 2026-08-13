import{X,Leaf,AlertTriangle}from'lucide-react'

const plantLabel=plant=>plant.code||plant.plantCode||`F${plant.row||1}-P${plant.position||1}`

export default function UnifiedMapCuttingDrawer({state,selection,onClose}){
 const plant=selection.unit,lot=selection.batch
 const genetic=state.genetics.find(value=>value.id===(plant.geneticId||lot?.geneticId))
 const findings=state.findings.filter(item=>item.propagationUnitId===plant.id)
 const open=findings.filter(item=>!['Resuelto','Falso positivo'].includes(item.status))
 return <aside className="unified-map-drawer" aria-label="Información del esqueje">
  <button className="map-side-close" onClick={onClose}><X size={18}/> Cerrar</button>
  <div className="plant-drawer-hero"><Leaf size={24}/><div><span>Esqueje</span><h3>{plant.code||plantLabel(plant)}</h3></div></div>
  <div className="detail-grid"><div><span>Estado</span><strong>{plant.status||'Activo'}</strong></div><div><span>Genética</span><strong>{genetic?.name||'Sin asignar'}</strong></div><div><span>Lote</span><strong>{lot?.code||'Sin lote'}</strong></div><div><span>Fase</span><strong>{lot?.phase||'—'}</strong></div><div><span>Ubicación</span><strong>{`${selection.bank.name} · ${selection.tray.label||'Bandeja'} ${selection.tray.index} · P${selection.slot}`}</strong></div><div><span>Hallazgos abiertos</span><strong className={open.length?'text-danger':''}>{open.length}</strong></div></div>
  <section className="drawer-findings"><h4><AlertTriangle size={17}/> Hallazgos</h4>{findings.length?findings.map(item=><article key={item.id}><strong>{item.type||item.pest||'Hallazgo MIPE'}</strong><span>{item.status||'Abierto'} · Severidad {item.severity||'—'}</span><p>{item.notes||item.observation||'Sin observaciones'}</p></article>):<p className="inline-empty">No hay hallazgos asociados.</p>}</section>
 </aside>
}
