import{useState}from'react'
import Card from'./Card'
import CrudActions from'./CrudActions'
import Field from'./Field'
import{DomainEvents,publishDomainEvent}from'../core/events/index.js'
import{assertBankCapacity,archivePropagationBank}from'../domain/facilityLifecycle.js'
import{areaSquareMeters,bankCapacity,formatArea,occupancyPercent,plantDensity,formatDensity}from'../domain/spaceMetrics.js'
import{bankOccupancy}from'../domain/propagationAllocation.js'

const emptyTray=()=>({id:crypto.randomUUID(),quantity:1,cellsPerTray:30,label:'Bandeja',substrate:'Turba',usesJiffy:false,plugType:'Plug estándar',plugSize:'',volumePerCavityMl:0,mediumLot:''})
const emptyBank=siteId=>({siteId:siteId||'',name:'Banco 1',dimensionUnit:'m',length:0,width:0,height:0,currentPlants:0,trays:[emptyTray()],notes:''})
const trayVolumeLiters=tray=>Number(tray.quantity||0)*Number(tray.cellsPerTray||0)*Number(tray.volumePerCavityMl||0)/1000
const bankVolumeLiters=bank=>(bank.trays||[]).reduce((sum,tray)=>sum+trayVolumeLiters(tray),0)

export default function PropagationBankManager({state,update}){
 const activeSites=state.sites.filter(site=>site.active!==false)
 const defaultSite=state.currentContext?.siteId||activeSites[0]?.id||''
 const[bank,setBank]=useState(()=>emptyBank(defaultSite)),[editingBankId,setEditingBankId]=useState(null)
 const banks=state.propagationBanks||[]
 function normalizeTrays(){return bank.trays.map(item=>({...item,id:item.id||crypto.randomUUID(),label:String(item.label||'Bandeja').trim()||'Bandeja',quantity:Math.max(0,Number(item.quantity)||0),cellsPerTray:Math.max(0,Number(item.cellsPerTray)||0),substrate:String(item.substrate||'').trim(),usesJiffy:Boolean(item.usesJiffy),plugType:String(item.plugType||'').trim(),plugSize:String(item.plugSize||'').trim(),volumePerCavityMl:Math.max(0,Number(item.volumePerCavityMl)||0),mediumLot:String(item.mediumLot||'').trim()}))}
 function saveBank(event){
  event.preventDefault()
  const site=activeSites.find(item=>item.id===bank.siteId),name=bank.name.trim()
  if(!site)return alert('Selecciona una sede activa.')
  if(!name)return alert('Escribe el nombre del banco.')
  if(banks.some(item=>item.id!==editingBankId&&item.active!==false&&item.siteId===bank.siteId&&item.name.trim().toLowerCase()===name.toLowerCase()))return alert('Ya existe un banco activo con ese nombre en la sede.')
  const trays=normalizeTrays()
  if(trays.some(item=>item.quantity<=0||item.cellsPerTray<=0))return alert('Cada tipo de bandeja debe tener cantidad y cavidades mayores que cero.')
  const payload={...bank,name,length:Math.max(0,Number(bank.length)||0),width:Math.max(0,Number(bank.width)||0),height:Math.max(0,Number(bank.height)||0),trays,updatedAt:new Date().toISOString()}
  try{assertBankCapacity({...payload,id:editingBankId||'new-bank'},state.propagationUnits)}catch(error){return alert(error.message)}
  if(editingBankId){
   const previous=banks.find(item=>item.id===editingBankId),after={...previous,...payload}
   update(store=>({...store,propagationBanks:store.propagationBanks.map(item=>item.id===editingBankId?after:item)}),{audit:false})
   void publishDomainEvent(state,{name:DomainEvents.PROPAGATION_BANK_UPDATED,aggregateType:'propagation.bank',aggregateId:editingBankId,organizationId:site.companyId,siteId:site.id,payload:{label:name,before:previous,after},metadata:{collections:['propagationBanks']}})
  }else{
   const id=crypto.randomUUID(),createdAt=new Date().toISOString(),created={id,active:true,createdAt,...payload}
   update(store=>({...store,propagationBanks:[...store.propagationBanks,created]}),{audit:false})
   void publishDomainEvent(state,{name:DomainEvents.PROPAGATION_BANK_CREATED,aggregateType:'propagation.bank',aggregateId:id,organizationId:site.companyId,siteId:site.id,payload:{label:name,bank:created},metadata:{collections:['propagationBanks']}})
  }
  setEditingBankId(null);setBank(emptyBank(bank.siteId))
 }
 function editBank(item){setEditingBankId(item.id);setBank({...emptyBank(item.siteId),...item,trays:(item.trays?.length?item.trays:[{...emptyTray(),quantity:item.trayCount||1,cellsPerTray:item.cavitiesPerTray||30,substrate:item.substrate||'Turba',usesJiffy:Boolean(item.usesJiffy),plugType:item.plugType||'',plugSize:item.plugSize||'',volumePerCavityMl:item.volumePerCavityMl||0,mediumLot:item.mediumLot||''}]).map(tray=>({...emptyTray(),...tray,id:tray.id||crypto.randomUUID()}))})}
 function archiveBank(item){
  if(!confirm(`¿Archivar el banco ${item.name}? Su configuración e historial se conservarán.`))return
  try{
   const next=archivePropagationBank(state,item.id),after=next.propagationBanks.find(value=>value.id===item.id),site=state.sites.find(value=>value.id===item.siteId)
   update(()=>next,{audit:false})
   void publishDomainEvent(state,{name:DomainEvents.PROPAGATION_BANK_ARCHIVED,aggregateType:'propagation.bank',aggregateId:item.id,organizationId:site?.companyId||state.currentContext?.companyId,siteId:item.siteId,payload:{label:item.name,before:item,after},metadata:{collections:['propagationBanks']}})
   if(editingBankId===item.id){setEditingBankId(null);setBank(emptyBank(defaultSite))}
  }catch(error){alert(error.message)}
 }
 function setTray(id,patch){setBank(current=>({...current,trays:current.trays.map(item=>item.id===id?{...item,...patch}:item)}))}
 function removeTray(id){
  if(bank.trays.length===1)return
  const next={...bank,trays:bank.trays.filter(item=>item.id!==id)}
  try{assertBankCapacity({...next,id:editingBankId||'new-bank'},state.propagationUnits);setBank(next)}catch(error){alert(error.message)}
 }
 const area=areaSquareMeters(bank.length,bank.width,bank.dimensionUnit),capacity=bankCapacity(bank.trays),density=plantDensity(bank.currentPlants,area),occupancy=occupancyPercent(bank.currentPlants,capacity)
 return <>
  <Card title={editingBankId?'Editar banco de propagación':'Nuevo banco de propagación'} subtitle="Los bancos y bandejas son infraestructura física. Se configuran aquí y el mapa solo los representa."><form className="form-grid" onSubmit={saveBank}><Field label="Sede" required><select value={bank.siteId} onChange={event=>setBank({...bank,siteId:event.target.value})}><option value="">Seleccionar</option>{activeSites.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><Field label="Nombre" required><input value={bank.name} onChange={event=>setBank({...bank,name:event.target.value})}/></Field><Field label="Unidad"><select value={bank.dimensionUnit} onChange={event=>setBank({...bank,dimensionUnit:event.target.value})}><option value="m">Metros</option><option value="cm">Centímetros</option></select></Field><Field label="Largo"><input type="number" min="0" step="0.01" value={bank.length} onChange={event=>setBank({...bank,length:event.target.value})}/></Field><Field label="Ancho"><input type="number" min="0" step="0.01" value={bank.width} onChange={event=>setBank({...bank,width:event.target.value})}/></Field><Field label="Alto"><input type="number" min="0" step="0.01" value={bank.height} onChange={event=>setBank({...bank,height:event.target.value})}/></Field><Field label="Observaciones"><input value={bank.notes} onChange={event=>setBank({...bank,notes:event.target.value})}/></Field><div className="span-all"><strong>Bandejas y medio de propagación</strong>{bank.trays.map((tray,index)=><div className="form-grid compact-form" key={tray.id}><Field label={`Tipo ${index+1}`}><input value={tray.label} onChange={event=>setTray(tray.id,{label:event.target.value})}/></Field><Field label="Cantidad"><input type="number" min="1" value={tray.quantity} onChange={event=>setTray(tray.id,{quantity:event.target.value})}/></Field><Field label="Cavidades"><input type="number" min="1" value={tray.cellsPerTray} onChange={event=>setTray(tray.id,{cellsPerTray:event.target.value})}/></Field><Field label="Medio"><select value={tray.substrate||''} onChange={event=>setTray(tray.id,{substrate:event.target.value})}><option value="">Seleccionar</option><option>Coco</option><option>Turba</option><option>Mezcla</option><option>Otro</option></select></Field><Field label="Usa jiffy"><select value={tray.usesJiffy?'Sí':'No'} onChange={event=>setTray(tray.id,{usesJiffy:event.target.value==='Sí'})}><option>No</option><option>Sí</option></select></Field><Field label="Tipo de plug"><input value={tray.plugType||''} onChange={event=>setTray(tray.id,{plugType:event.target.value})}/></Field><Field label="Tamaño del plug"><input value={tray.plugSize||''} onChange={event=>setTray(tray.id,{plugSize:event.target.value})} placeholder="Ej. 30 mm"/></Field><Field label="Volumen/cavidad (ml)"><input type="number" min="0" step="0.1" value={tray.volumePerCavityMl||0} onChange={event=>setTray(tray.id,{volumePerCavityMl:event.target.value})}/></Field><Field label="Lote del medio"><input value={tray.mediumLot||''} onChange={event=>setTray(tray.id,{mediumLot:event.target.value})}/></Field><div className="form-actions"><span className="form-help">{trayVolumeLiters(tray).toFixed(2)} L configurados</span><button type="button" className="button secondary" disabled={bank.trays.length===1} onClick={()=>removeTray(tray.id)}>Quitar</button></div></div>)}<button type="button" className="button secondary" onClick={()=>setBank({...bank,trays:[...bank.trays,emptyTray()]})}>Agregar tipo de bandeja</button></div><div className="management-summary span-all"><div><span>Área</span><strong>{formatArea(area)}</strong></div><div><span>Capacidad</span><strong>{capacity} plantas</strong></div><div><span>Volumen de medio</span><strong>{bankVolumeLiters(bank).toFixed(2)} L</strong></div><div><span>Ocupación manual</span><strong>{occupancy.toFixed(1)}%</strong></div><div><span>Densidad</span><strong>{formatDensity(density)}</strong></div></div><div className="form-actions"><button className="button primary">{editingBankId?'Guardar banco':'Crear banco'}</button>{editingBankId&&<button type="button" className="button secondary" onClick={()=>{setEditingBankId(null);setBank(emptyBank(defaultSite))}}>Cancelar</button>}</div></form></Card>
  <Card title="Bancos de propagación" subtitle="Resumen físico por sede. Los bancos archivados conservan su historial." flush>{banks.length?<div className="table-scroll"><table><thead><tr><th>Banco</th><th>Sede</th><th>Bandejas</th><th>Capacidad</th><th>Ocupados</th><th>Disponibles</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{banks.map(item=>{const normalizedTrays=item.trays?.length?item.trays:[{quantity:item.trayCount||0,cellsPerTray:item.cavitiesPerTray||0}],metrics=bankOccupancy({...item,trays:normalizedTrays},state.propagationUnits);return <tr key={item.id}><td><strong>{item.name}</strong></td><td>{state.sites.find(site=>site.id===item.siteId)?.name||'—'}</td><td>{normalizedTrays.reduce((sum,tray)=>sum+Number(tray.quantity||0),0)}</td><td>{metrics.capacity}</td><td>{metrics.occupied}</td><td>{metrics.available}</td><td><span className={`tag ${item.active===false?'':'success'}`}>{item.active===false?'Archivado':'Activo'}</span></td><td><CrudActions onEdit={()=>editBank(item)} onDelete={item.active===false?undefined:()=>archiveBank(item)}/></td></tr>})}</tbody></table></div>:<div className="empty-state"><strong>No hay bancos registrados</strong><p>Crea el primer banco de propagación como parte de la infraestructura física de la sede.</p></div>}</Card>
 </>
}
