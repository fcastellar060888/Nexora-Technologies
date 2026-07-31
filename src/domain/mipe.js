export const findingStatuses=['Detectado','En evaluación','Tratamiento aprobado','En tratamiento','Seguimiento','Resuelto','Planta eliminada','Falso positivo']
export const severityLabels={1:'Leve',2:'Moderada',3:'Grave',4:'Crítica'}

export function plantCode(state,plant){
 const bed=state.beds.find(x=>x.id===plant?.bedId)
 const house=state.houses.find(x=>x.id===bed?.houseId)
 const site=state.sites.find(x=>x.id===house?.siteId)
 return `${(site?.name||'SED').slice(0,3).toUpperCase()}-${house?.name||'N'}-${bed?.name||'C'}-F${plant?.row||0}-P${plant?.position||0}`.replaceAll(' ','')
}
export function findingLocation(state,finding){
 const plant=state.plantPositions.find(x=>x.id===finding?.plantPositionId)
 const bed=state.beds.find(x=>x.id===plant?.bedId)
 const house=state.houses.find(x=>x.id===bed?.houseId)
 const site=state.sites.find(x=>x.id===house?.siteId)
 const company=state.companies.find(x=>x.id===site?.companyId)
 return{plant,bed,house,site,company}
}
export function formatDateTime(value){
 if(!value)return'—';const d=new Date(value)
 return Number.isNaN(d.getTime())?String(value):d.toLocaleString('es-CO',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})
}
export function isFollowUpDue(f){
 if(!f?.followUpDate||['Resuelto','Falso positivo'].includes(f.status))return false
 const t=new Date();t.setHours(0,0,0,0);return new Date(f.followUpDate+'T00:00:00')<=t
}
export function plantTimeline(state,plantId){
 const findings=state.findings.filter(x=>x.plantPositionId===plantId).map(x=>({id:x.id,date:x.createdAt,type:'MIPE',title:state.incidents.find(i=>i.id===x.incidentId)?.name||'Hallazgo',detail:`${x.status} · severidad ${x.severity}`,status:x.status}))
 const treatments=state.treatments.filter(t=>findings.some(f=>f.id===t.findingId)).map(t=>({id:t.id,date:t.date||t.createdAt,type:'Tratamiento',title:state.products.find(p=>p.id===t.productId)?.name||'Tratamiento',detail:`${t.dose||''} ${t.doseUnit||''}`,status:t.status}))
 const events=state.plantEvents.filter(x=>x.plantId===plantId)
 return[...findings,...treatments,...events].sort((a,b)=>String(b.date).localeCompare(String(a.date)))
}
