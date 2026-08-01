import{useMemo,useState}from'react'
import Card from'./Card'
import CrudActions from'./CrudActions'
import Field from'./Field'

export const SPACE_CAPABILITIES=['Material vegetal','Producción','Recepción','Secado','Destalle','Manicura','Selección','Empaque','Almacenamiento','Cuarentena','Compostaje','Destrucción','Extracción','Laboratorio','Limpieza']
const emptyArea=siteId=>({siteId:siteId||'',name:'',type:'Área operativa',capabilities:[],shared:false,dimensionUnit:'m',length:0,width:0,height:0,notes:''})

export default function FacilityAreaManager({state,update}){
 const areas=state.facilityAreas||[],defaultSite=state.currentContext?.siteId||state.sites?.[0]?.id||''
 const[form,setForm]=useState(()=>emptyArea(defaultSite)),[editingId,setEditingId]=useState(null)
 const grouped=useMemo(()=>state.sites.map(site=>({site,areas:areas.filter(area=>area.siteId===site.id)})).filter(group=>group.areas.length),[state.sites,areas])
 function toggleCapability(value){setForm(current=>({...current,capabilities:current.capabilities.includes(value)?current.capabilities.filter(item=>item!==value):[...current.capabilities,value]}))}
 function save(event){
  event.preventDefault()
  const name=form.name.trim()
  if(!name)return alert('Escribe el nombre del área.')
  if(!form.siteId)return alert('Selecciona la sede.')
  if(!form.capabilities.length)return alert('Selecciona al menos una capacidad operativa.')
  if(areas.some(item=>item.id!==editingId&&item.siteId===form.siteId&&item.name.trim().toLowerCase()===name.toLowerCase()))return alert('Ya existe un área con ese nombre en la sede.')
  const payload={...form,name,shared:form.capabilities.length>1||Boolean(form.shared),length:Math.max(0,Number(form.length)||0),width:Math.max(0,Number(form.width)||0),height:Math.max(0,Number(form.height)||0)}
  update(store=>({...store,facilityAreas:editingId?areas.map(item=>item.id===editingId?{...item,...payload}:item):[...areas,{id:crypto.randomUUID(),createdAt:new Date().toISOString(),active:true,...payload}]}),{module:'Infraestructura',action:editingId?'Área actualizada':'Área creada',detail:`${name} · ${payload.capabilities.join(', ')}`})
  setEditingId(null);setForm(emptyArea(form.siteId))
 }
 function edit(area){setEditingId(area.id);setForm({...emptyArea(area.siteId),...area,capabilities:[...(area.capabilities||[])]})}
 function remove(area){
  const linked=(state.houses||[]).filter(item=>item.areaId===area.id).length+(state.propagationBanks||[]).filter(item=>item.areaId===area.id).length
  if(linked)return alert(`No puedes eliminar el área porque tiene ${linked} espacios vinculados.`)
  if(!confirm(`¿Eliminar el área ${area.name}?`))return
  update(store=>({...store,facilityAreas:areas.filter(item=>item.id!==area.id)}),{module:'Infraestructura',action:'Área eliminada',detail:area.name})
 }
 return <>
  <Card title={editingId?'Editar área física':'Nueva área física'} subtitle="El espacio es único; sus capacidades pueden ser exclusivas, compartidas o cambiar por programación.">
   <form className="form-grid" onSubmit={save}>
    <Field label="Sede" required><select value={form.siteId} onChange={event=>setForm({...form,siteId:event.target.value})}><option value="">Seleccionar</option>{state.sites.map(site=><option key={site.id} value={site.id}>{site.name}</option>)}</select></Field>
    <Field label="Nombre" required><input value={form.name} onChange={event=>setForm({...form,name:event.target.value})} placeholder="Sala de procesamiento"/></Field>
    <Field label="Tipo de espacio"><select value={form.type} onChange={event=>setForm({...form,type:event.target.value})}><option>Área operativa</option><option>Nave</option><option>Sala</option><option>Cuarto</option><option>Almacén</option><option>Zona exterior</option><option>Laboratorio</option><option>Otro</option></select></Field>
    <Field label="Unidad"><select value={form.dimensionUnit} onChange={event=>setForm({...form,dimensionUnit:event.target.value})}><option value="m">Metros</option><option value="cm">Centímetros</option></select></Field>
    <Field label="Largo"><input type="number" min="0" step="0.01" value={form.length} onChange={event=>setForm({...form,length:event.target.value})}/></Field>
    <Field label="Ancho"><input type="number" min="0" step="0.01" value={form.width} onChange={event=>setForm({...form,width:event.target.value})}/></Field>
    <Field label="Alto"><input type="number" min="0" step="0.01" value={form.height} onChange={event=>setForm({...form,height:event.target.value})}/></Field>
    <Field label="Observaciones"><textarea value={form.notes} onChange={event=>setForm({...form,notes:event.target.value})}/></Field>
    <div className="span-all"><strong>Capacidades operativas</strong><div className="selection-toolbar">{SPACE_CAPABILITIES.map(value=><label className="selection-chip" key={value}><input type="checkbox" checked={form.capabilities.includes(value)} onChange={()=>toggleCapability(value)}/><span>{value}</span></label>)}</div></div>
    <div className="management-summary span-all"><div><span>Modalidad</span><strong>{form.capabilities.length>1?'Área compartida':'Uso exclusivo'}</strong></div><div><span>Capacidades</span><strong>{form.capabilities.length}</strong></div></div>
    <div className="form-actions"><button className="button primary">{editingId?'Guardar área':'Crear área'}</button>{editingId&&<button type="button" className="button secondary" onClick={()=>{setEditingId(null);setForm(emptyArea(defaultSite))}}>Cancelar</button>}</div>
   </form>
  </Card>
  <Card title="Áreas configuradas">{grouped.length?grouped.map(({site,areas:siteAreas})=><div className="site-group" key={site.id}><div className="site-group-head"><h4>{site.name}</h4><span>{siteAreas.length} áreas</span></div><div className="house-list">{siteAreas.map(area=><div className="house-list-card" key={area.id}><div><strong>{area.name}</strong><small>{area.type} · {(area.capabilities||[]).join(' · ')}</small></div><span className="tag success">{area.shared||area.capabilities?.length>1?'Compartida':'Exclusiva'}</span><CrudActions onEdit={()=>edit(area)} onDelete={()=>remove(area)}/></div>)}</div></div>):<div className="empty-state"><strong>No hay áreas físicas configuradas</strong><p>Crea áreas para reflejar cultivo, postcosecha, almacenamiento y espacios compartidos.</p></div>}</Card>
 </>
}
