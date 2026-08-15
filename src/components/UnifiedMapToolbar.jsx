import Card from'./Card'
import Field from'./Field'

export default function UnifiedMapToolbar({activeSites,siteId,layer,selectionMode,onSite,onLayer,onToggleSelection}){
 return <Card><div className="form-grid unified-map-toolbar">
  <Field label="Sede"><select value={siteId} onChange={event=>onSite(event.target.value)}>{activeSites.map(site=><option key={site.id} value={site.id}>{site.name}</option>)}</select></Field>
  <Field label="Capa visual"><select value={layer} onChange={event=>onLayer(event.target.value)}>{['Estado','Fase','Genética','MIPE'].map(value=><option key={value}>{value}</option>)}</select></Field>
  <div className="field"><span>Selección</span><button className={`button ${selectionMode?'primary':'secondary'}`} onClick={onToggleSelection}>{selectionMode?'Finalizar selección':'Seleccionar plantas'}</button></div>
  <div className="unified-map-help"><strong>{selectionMode?'Selección múltiple':'Vista de sede y operación'}</strong><span>{selectionMode?'Toca plantas para agregarlas o retirarlas de la selección.':'La estructura se administra en Infraestructura; aquí solo se consulta y opera.'}</span></div>
 </div></Card>
}
