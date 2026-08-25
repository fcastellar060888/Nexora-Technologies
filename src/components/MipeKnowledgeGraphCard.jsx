import Card from'./Card.jsx'

const ORDER=['mipe.finding','mipe.incident','mipe.intervention','mipe.treatment','inventory.product','inventory.lot','mipe.restriction','mipe.resolution']
const LABELS={
 'mipe.finding':'Hallazgo','mipe.incident':'Incidencia','mipe.intervention':'Intervención','mipe.treatment':'Tratamiento','inventory.product':'Producto','inventory.lot':'Lote de inventario','mipe.restriction':'Restricción','mipe.resolution':'Resolución'
}
const indicator=(passport,key)=>passport?.indicators?.find(item=>item.key===key)?.value||0
const text=value=>String(value??'').trim()
const formatDate=value=>{if(!value||Number.isNaN(Date.parse(value)))return'';return new Intl.DateTimeFormat('es-CO',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value))}
function detail(item){
 if(item.targetType==='mipe.finding')return[ text(item.status),item.severity!=null?`Severidad ${item.severity}`:''].filter(Boolean).join(' · ')
 if(item.targetType==='mipe.incident')return item.catalogPresent===false?'Identidad histórica · catálogo no disponible':item.active===false?'Archivada':'Catálogo vigente'
 if(item.targetType==='mipe.intervention')return[text(item.outcome),text(item.responsible),formatDate(item.performedAt)].filter(Boolean).join(' · ')
 if(item.targetType==='mipe.treatment')return[text(item.status),item.dose!=null?`${item.dose} ${text(item.doseUnit)}`:'',formatDate(item.executedAt)].filter(Boolean).join(' · ')
 if(item.targetType==='inventory.product')return`${item.treatmentIds?.length||0} tratamiento(s) causal(es)`
 if(item.targetType==='inventory.lot')return`${item.treatmentIds?.length||0} consumo(s) MIPE`
 if(item.targetType==='mipe.restriction')return[text(item.restrictionType),formatDate(item.startsAt),item.endsAt?`hasta ${formatDate(item.endsAt)}`:'sin fin hasta resolución'].filter(Boolean).join(' · ')
 if(item.targetType==='mipe.resolution')return[text(item.status),formatDate(item.occurredAt),text(item.notes)].filter(Boolean).join(' · ')
 return''
}

export default function MipeKnowledgeGraphCard({passport}){
 const relations=(passport?.relationships||[]).filter(item=>ORDER.includes(item.targetType)).sort((a,b)=>ORDER.indexOf(a.targetType)-ORDER.indexOf(b.targetType)||text(a.targetId).localeCompare(text(b.targetId)))
 if(!relations.length)return <Card title="Trazabilidad MIPE / Knowledge Graph"><p className="muted">Sin evidencia MIPE relacionada con este objeto.</p></Card>
 const summary=[['Hallazgos',indicator(passport,'mipe_graph_findings')],['Intervenciones',indicator(passport,'mipe_graph_interventions')],['Tratamientos',indicator(passport,'mipe_graph_treatments')],['Restricciones',indicator(passport,'mipe_graph_restrictions')],['Resoluciones',indicator(passport,'mipe_graph_resolutions')]]
 return <Card title="Trazabilidad MIPE / Knowledge Graph" subtitle="Finding → Incident → Intervention/Treatment → Product/Lot → Restriction → Resolution">
  <div className="management-summary">{summary.map(([label,value])=><div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
  <div className="drawer-findings">{relations.map(item=><article key={`${item.type}:${item.targetType}:${item.targetId}`}><strong>{LABELS[item.targetType]||item.targetType}: {item.label}</strong><span>{detail(item)||item.targetId}</span></article>)}</div>
 </Card>
}
