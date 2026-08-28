import{NavLink,Outlet,useNavigate}from'react-router-dom'
import{Activity,AlertTriangle,BarChart3,Boxes,Building2,Bug,ClipboardList,Dna,Factory,Gauge,History,Map,Menu,Droplets,FlaskConical,Leaf,ClipboardCheck,Layers3,CircleDollarSign,Users,LogIn,Route,ScanSearch,BookOpenCheck,ShieldCheck,GitBranch,Sprout,Settings,Target,TestTubes,X,ChevronDown,Search,ShoppingCart,PackageCheck,Coins,Wrench,RefreshCw,CloudOff,DatabaseBackup,Database,Radio,PenLine}from'lucide-react'
import{useEffect,useMemo,useState}from'react'
import ContextBar from'./ContextBar.jsx'
import{useStore}from'../services/store'
import{useRealtime}from'../services/realtimeContext.jsx'
import{statusLabel}from'../services/autoSyncRuntime.js'
import{capabilityForPath,hasEntitlement}from'../domain/entitlements.js'
import{hasPermission}from'../services/permissions.js'

const groups=[
 {label:'Operación',links:[['/dashboard','Centro de operaciones',BarChart3],['/operations','Agenda operativa',ClipboardCheck],['/cultivation-map','Mapa del cultivo',Map],['/infrastructure-map','Mapa de áreas',Layers3],['/infrastructure/operations','Activos y ambiente',Wrench]]},
 {label:'Material vegetal',links:[['/propagation/grandmothers','Lotes de abuelas',Sprout],['/propagation/mothers','Lotes de madres',Sprout],['/propagation/batches','Esquejes y lotes productivos',Route],['/phase-targets','Objetivos por fase',Target],['/propagation/lineage','Trazabilidad',GitBranch]]},
 {label:'Cultivo',links:[['/mirfe/dashboard','Panel MIRFE',Gauge],['/mirfe/monitoring','Monitoreo MIRFE',Activity],['/mirfe/programs','Programas MIRFE',Target],['/mirfe/reinforcements','Refuerzos MIRFE',TestTubes],['/mipe/dashboard','Panel MIPE',Gauge],['/mipe/incidents','Catálogo sanitario',Bug],['/mipe/findings','Hallazgos',AlertTriangle],['/mipe/treatments','Tratamientos',ClipboardList],['/irrigation/water','Análisis de agua',Droplets],['/irrigation/products','Productos fertirriego',FlaskConical],['/irrigation/objectives','Objetivos nutricionales',Leaf],['/irrigation/plan','Plan diario',Droplets],['/irrigation/formulation','Formulación',FlaskConical],['/irrigation/preparations','Preparaciones',Layers3],['/irigation/orders','Órdenes operativas',ClipboardCheck]]},
 {label:'Inventario y comercial',links:[['/inventory','Insumos',Boxes],['/inventory/movements','Kardex de insumos',History],['/finished-goods','Producto terminado',PackageCheck],['/sales','Ventas',ShoppingCart],['/costs','Costos por lote',CircleDollarSign],['/currencies','Monedas',Coins]]},
 {label:'Configuración',links:[['/companies','Empresas',Building2],['/sites','Sedes',Map],['/infrastructure','Áreas e infraestructura',Layers3],['/houses','Naves y camas (legado)',Factory],['/genetics','Genéticas',Dna],['/users','Usuarios y roles',Users],['/login','Acceso con Supabase',LogIn],['/sync','Centro de sincronización',RefreshCw],['/migration','Migración a PostgreSQL',DatabaseBackup],['/audit','Auditoría',BookOpenCheck],['/insights','Inteligencia',ScanSearch],['/diagnostics','Diagnóstico',ShieldCheck],['/settings','Configuración',Settings]]}
]

const inventoryPath=path=>path==='/inventory'||path.startsWith('/inventory/')

export default function AppShell(){
 const[open,setOpen]=useState(false)
 const[collapsed,setCollapsed]=useState(()=>Object.fromEntries(groups.map((g,i)=>[g.label,i>0])))
 const[query,setQuery]=useState('')
 const{state,synchronize,syncRuntime,dataRuntime,hydrateFromPostgres}=useStore()
 const{runtime:realtimeRuntime,onlineUsers,currentEditors}=useRealtime()
 const navigate=useNavigate()
 const visibleGroups=useMemo(()=>groups.map(group=>({...group,links:group.links.filter(([path])=>hasEntitlement(state,capabilityForPath(path))&&(!inventoryPath(path)||hasPermission(state,'view_inventory')))})).filter(group=>group.links.length>0),[state])
 const matches=useMemo(()=>query.trim()?visibleGroups.flatMap(g=>g.links).filter(x=>x[1].toLowerCase().includes(query.toLowerCase())).slice(0,8):[],[query,visibleGroups])
 const SyncIcon=syncRuntime.online===false?CloudOff:RefreshCw
 const syncLabel=statusLabel(syncRuntime,state)
 const dataLabel=dataRuntime.status==='loading'?'Cargando PostgreSQL':dataRuntime.source==='postgres'?'PostgreSQL':'Caché local'
 const realtimeLabel=realtimeRuntime.status==='connected'?`${onlineUsers} en línea`:realtimeRuntime.status==='reconnecting'?'Reconectando':realtimeRuntime.status==='connecting'?'Conectando':'Tiempo real desactivado'
 const editorLabel=currentEditors.length===1?`${currentEditors[0].actorName} está editando`:currentEditors.length>1?`${currentEditors.length} personas editando`:''
 useEffect(()=>{
  if(!open)return undefined
  const previousOverflow=document.body.style.overflow
  const closeOnEscape=event=>{if(event.key==='Escape')setOpen(false)}
  document.body.style.overflow='hidden'
  window.addEventListener('keydown',closeOnEscape)
  return()=>{document.body.style.overflow=previousOverflow;window.removeEventListener('keydown',closeOnEscape)}
 },[open])
 return <div className="app-shell">
  <header className="topbar">
   <button className="icon-button mobile-only" onClick={()=>setOpen(true)} aria-label="Abrir menú principal" aria-expanded={open} aria-controls="navegacion-principal"><Menu size={22}/></button>
   <div className="topbar-brand"><h1>Nexora One</h1><p>Inteligencia operativa para agricultura de alto valor</p></div>
   <div className="global-search" role="search">
    <Search size={17} aria-hidden="true"/>
    <input aria-label="Buscar en Nexora" placeholder="Buscar módulo…" value={query} onChange={e=>setQuery(e.target.value)} autoComplete="off"/>
    {matches.length>0&&<div className="search-results" role="listbox" aria-label="Resultados de búsqueda">{matches.map(([path,label])=><button role="option" key={path} onClick={()=>{navigate(path);setQuery('')}}>{label}</button>)}</div>}
   </div>
   {editorLabel&&<span className="editor-status" title={currentEditors.map(item=>`${item.actorName}: ${item.label}`).join('\n')}><PenLine size={15}/><span>{editorLabel}</span></span>}
   <span className={`realtime-status ${realtimeRuntime.status}`} title={realtimeRuntime.error||'Presencia en tiempo real por empresa'}><Radio size={15}/><span>{realtimeLabel}</span></span>
   <button className={`data-source-status ${dataRuntime.status}`} onClick={()=>hydrateFromPostgres(state.currentContext?.companyId,{force:true})} disabled={dataRuntime.status==='loading'||!state.currentContext?.companyId} title={dataRuntime.lastError||`Origen actual: ${dataLabel}`} aria-label={`Actualizar datos desde ${dataLabel}`}><Database size={16}/><span>{dataLabel}</span></button>
   <button className={`sync-status ${syncRuntime.status}`} onClick={()=>synchronize('manual',{force:true})} disabled={syncRuntime.running} title={syncRuntime.lastError||'Sincronización automática activa'} aria-label={syncRuntime.running?'Sincronizando datos':`Sincronizar ahora. Estado: ${syncLabel}`}><SyncIcon size={16} className={syncRuntime.running?'spinning':''}/><span>{syncLabel}</span></button>
   <span className="version-badge">v7.0</span>
  </header>
  {open&&<button className="scrim mobile-only" onClick={()=>setOpen(false)} aria-label="Cerrar menú principal"/>}
  <aside id="navegacion-principal" className={`sidebar ${open?'open':''}`} aria-label="Navegación principal" aria-hidden={!open&&undefined}>
   <div className="sidebar-head mobile-only"><strong>Menú</strong><button className="icon-button" onClick={()=>setOpen(false)} aria-label="Cerrar menú"><X size={20}/></button></div>
   <nav>{visibleGroups.map(group=><section className="nav-group" key={group.label}>
    <button className="nav-group-toggle" onClick={()=>setCollapsed(current=>({...current,[group.label]:!current[group.label]}))} aria-expanded={!collapsed[group.label]}><span className="nav-group-label">{group.label}</span><ChevronDown size={15} className={collapsed[group.label]?'rotated':''}/></button>
    {!collapsed[group.label]&&<div className="nav-group-links">{group.links.map(([path,label,Icon])=><NavLink key={path} to={path} onClick={()=>setOpen(false)} className={({isActive})=>`nav-link ${isActive?'active':''}`}><Icon size={18}/><span>{label}</span></NavLink>)}</div>}
   </section>)}</nav>
   <div className="sidebar-footer">Nexora One · by Nexora Technologies</div>
  </aside>
  <main className="main-content" id="contenido-principal"><ContextBar/><Outlet/></main>
 </div>
}
