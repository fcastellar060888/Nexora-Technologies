import{useEffect,useMemo}from'react'
import Card from'../components/Card'
import Field from'../components/Field'
import PageHeader from'../components/PageHeader'
import{explicitOrganizationId}from'../domain/organizationOwnership.js'
import{operationalContextOptions,scopeOperationalState,transitionOperationalContext}from'../domain/operationalContext.js'
import{useStore}from'../services/store'
const labels={grandmothers:'Abuelas',mothers:'Madres',renewal:'Renovación',propagation:'Propagación',production:'Producción',drying:'Secado',processing:'Procesamiento',storage:'Bodega',laboratory:'Laboratorio',other:'Otra'}
export default function InfrastructureMapPage(){
 const{state,update}=useStore(),contextOptions=operationalContextOptions(state,state.currentContext),activeSites=contextOptions.sites.filter(item=>item.active!==false)
 const siteId=contextOptions.selected.site?.id||activeSites[0]?.id||''
 const mapState=useMemo(()=>scopeOperationalState(state,{...(state.currentContext||{}),siteId,houseId:'',bedId:'',plantId:''}),[state,siteId])
 useEffect(()=>{if(siteId&&state.currentContext?.siteId!==siteId)update(current=>({...current,currentContext:transitionOperationalContext(current,{siteId})}),{audit:false,sync:false})},[siteId,state.currentContext?.siteId,update])
 const site=mapState.sites.find(item=>item.id===siteId)
 const areas=useMemo(()=>(mapState.operationalAreas||[]).filter(item=>item.siteId===siteId).sort((a,b)=>(a.sortOrder||0)-(b.sortOrder||0)),[mapState.operationalAreas,siteId])
 const organizationId=mapState.currentContext?.companyId||''
 const areaIds=new Set(areas.map(item=>item.id))
 const nodes=(state.infrastructureElements||[]).filter(node=>{
  if(!areaIds.has(node.areaId))return false
  const owner=explicitOrganizationId(node)
  if(owner)return owner===organizationId
  return (state.operationalAreas||[]).filter(area=>area.id===node.areaId).length===1
 })
 const changeSite=nextSiteId=>update(current=>({...current,currentContext:transitionOperationalContext(current,{siteId:nextSiteId})}),{audit:false,sync:false})
 return <><PageHeader title="Mapa de áreas" subtitle="Vista física de la sede dentro del contexto operativo compartido. La fase productiva y la ocupación se conservan en movimientos, no como historia fija de la infraestructura."/>
 <Card><div className="form-grid compact"><Field label="Sede"><select value={siteId} onChange={e=>changeSite(e.target.value)} disabled={!activeSites.length}><option value="" disabled>Seleccionar</option>{activeSites.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></Field></div></Card>
 <Card title={site?.name||'Sede'} subtitle={`${areas.length} áreas operativas`}>{!areas.length?<p className="muted">Configura las áreas desde Configuración → Áreas e infraestructura.</p>:<div className="area-map-grid">{areas.map(a=>{const areaNodes=nodes.filter(x=>x.areaId===a.id),roots=areaNodes.filter(x=>!x.parentId);return <article className={`area-map-card area-${a.type}`} key={a.id}><header><div><strong>{a.name}</strong><small>{labels[a.type]||a.type}</small></div><span>{areaNodes.length}</span></header><div className="area-map-roots">{roots.length?roots.map(r=><div className="area-root" key={r.id}><b>{r.name}</b><small>{r.type} · {r.status}</small><div className="area-root-children">{areaNodes.filter(x=>x.parentId===r.id).slice(0,8).map(x=><span key={x.id}>{x.name}</span>)}</div></div>):<em>Sin infraestructura</em>}</div></article>})}</div>}</Card></>
}
