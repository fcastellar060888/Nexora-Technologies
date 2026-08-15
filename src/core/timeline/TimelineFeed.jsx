import{useMemo,useState}from'react'
import{Clock3,Search}from'lucide-react'
import{useTimeline}from'./useTimeline.js'

const categories=['','Organización','Identidad','Cultivo','MIPE','MIRFE','Inventario','Producción','Sistema']
const dateTime=value=>new Intl.DateTimeFormat('es-CO',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value))

export default function TimelineFeed({
 organizationId,
 siteId,
 aggregateType,
 aggregateId,
 title='Actividad reciente',
 subtitle='Historia operativa generada automáticamente por los eventos de Nexora.',
 limit=20,
 showFilters=true,
 emptyTitle='Aún no hay actividad',
 emptyText='Las próximas acciones registradas aparecerán aquí automáticamente.'
}){
 const[search,setSearch]=useState('')
 const[category,setCategory]=useState('')
 const filters=useMemo(()=>({organizationId,siteId,aggregateType,aggregateId,search,category,limit}),[organizationId,siteId,aggregateType,aggregateId,search,category,limit])
 const entries=useTimeline(filters)
 return <section className="timeline-panel" aria-labelledby="timeline-title">
  <header className="timeline-panel-header"><div><span className="timeline-eyebrow">Timeline universal</span><h3 id="timeline-title">{title}</h3>{subtitle&&<p>{subtitle}</p>}</div><span className="timeline-count">{entries.length} evento{entries.length===1?'':'s'}</span></header>
  {showFilters&&<div className="timeline-filters"><label><span className="sr-only">Buscar en actividad</span><Search size={16}/><input value={search} placeholder="Buscar actividad…" onChange={event=>setSearch(event.target.value)}/></label><select aria-label="Filtrar por categoría" value={category} onChange={event=>setCategory(event.target.value)}>{categories.map(value=><option key={value||'all'} value={value}>{value||'Todas las categorías'}</option>)}</select></div>}
  {entries.length?<ol className="timeline-list">{entries.map(entry=><li className={`timeline-item ${entry.tone||'neutral'}`} key={entry.id}><div className="timeline-marker" aria-hidden="true"><span/></div><article><div className="timeline-item-top"><div><span className="timeline-category">{entry.category}</span><h4>{entry.title}</h4></div><time dateTime={entry.occurredAt}><Clock3 size={14}/>{dateTime(entry.occurredAt)}</time></div>{entry.summary&&<p>{entry.summary}</p>}<footer><span>{entry.actorName||'Sistema'}</span><code>{entry.eventName}</code></footer></article></li>)}</ol>:<div className="timeline-empty"><Clock3 size={28}/><strong>{emptyTitle}</strong><p>{emptyText}</p></div>}
 </section>
}
