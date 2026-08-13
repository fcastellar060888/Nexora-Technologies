import Card from'./Card'
import Field from'./Field'
import{clearSelection,selectAll}from'../core/selection/index.js'

export default function UnifiedMapSelectionPanel({summary,availablePlantIds,setSelection,draft,setDraft,onSubmit}){
 return <Card title="Acciones sobre plantas seleccionadas" subtitle={`${summary.selectedCount} de ${summary.availableCount} plantas activas seleccionadas.`}>
  <div className="bulk-selection-actions">
   <button className="button secondary" type="button" onClick={()=>setSelection(current=>selectAll(current,availablePlantIds))} disabled={summary.isAll||!summary.availableCount}>Seleccionar todas</button>
   <button className="button secondary" type="button" onClick={()=>setSelection(current=>clearSelection(current))} disabled={summary.isEmpty}>Limpiar selección</button>
   <span>{summary.isAll?'Selección total':summary.isPartial?'Selección parcial':'Sin selección'}</span>
  </div>
  <form className="form-grid bulk-observation-form" onSubmit={onSubmit}>
   <Field label="Título de la observación"><input required value={draft.title} onChange={event=>setDraft({...draft,title:event.target.value,confirmed:false})} disabled={summary.isEmpty}/></Field>
   <Field label="Detalle"><textarea value={draft.detail} onChange={event=>setDraft({...draft,detail:event.target.value,confirmed:false})} disabled={summary.isEmpty}/></Field>
   <label className="bulk-confirmation"><input type="checkbox" checked={draft.confirmed} onChange={event=>setDraft({...draft,confirmed:event.target.checked})} disabled={summary.isEmpty}/><span>Confirmo registrar esta observación en {summary.selectedCount} plantas.</span></label>
   <button className="button primary" disabled={summary.isEmpty||!draft.confirmed||!draft.title.trim()}>Registrar observación masiva</button>
  </form>
  <small className="muted">La acción se reconcilia contra las plantas todavía disponibles antes de ejecutarse y genera un evento individual por planta.</small>
 </Card>
}
