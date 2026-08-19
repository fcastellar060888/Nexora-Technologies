import Card from'../components/Card'
import PageHeader from'../components/PageHeader'
import{auditTrailForActiveOrganization}from'../core/audit/domainEventAudit.js'
import{observabilityViewForActiveOrganization}from'../domain/observability.js'
import{useStore}from'../services/store'

export default function AuditLogPage(){
 const{state}=useStore(),view=observabilityViewForActiveOrganization(state),trail=auditTrailForActiveOrganization(state)
 return <><PageHeader title="Auditoría" subtitle="Trazabilidad durable de la empresa activa desde Operational Ledger y auditoría genérica sincronizada."/><Card><div className="table-scroll"><table><thead><tr><th>Fecha</th><th>Usuario</th><th>Módulo</th><th>Acción</th><th>Detalle</th><th>Fuente</th></tr></thead><tbody>{[...trail].reverse().map(x=><tr key={`${x.organizationId}:${x.id}`}><td>{new Date(x.date||x.createdAt||x.recordedAt).toLocaleString('es-CO')}</td><td>{x.actor||x.user||'Usuario local'}</td><td>{friendly(x.module)}</td><td>{x.action}</td><td className="audit-detail">{humanDetail(view,x.detail)}</td><td>{x.source==='operational-ledger'?'Operational Ledger':'Auditoría sincronizada'}</td></tr>)}</tbody></table></div></Card></>
}
function friendly(v){const map={'houses, beds, plantPositions':'Infraestructura','sites':'Sedes'};return map[v]||v}
function humanDetail(view,v){if(!v)return'—';const plant=view.plantPositions.find(x=>x.id===v);if(plant){const bed=view.beds.find(x=>x.id===plant.bedId),house=view.houses.find(x=>x.id===bed?.houseId);return`${house?.name||''} · ${bed?.name||''} · F${plant.row} P${plant.position}`}return String(v)}
