import{useMemo,useState}from'react'
import Card from'../components/Card'
import Field from'../components/Field'
import PageHeader from'../components/PageHeader'
import{GENETIC_CLASSIFICATIONS,geneticProfilesForOrganization}from'../domain/geneticProfile.js'
import{activeOrganizationId,explicitOrganizationId}from'../domain/organizationOwnership.js'
import{executeGeneticProfileCommand,GENETIC_OPERATIONS}from'../services/geneticProfileCommand.js'
import{useStore}from'../services/store'

const emptyForm=()=>({name:'',color:'#2e7d32',classification:GENETIC_CLASSIFICATIONS.UNSPECIFIED,vegetativeDays:'',floweringDays:'',thcTargetPercent:'',cbdTargetPercent:''})

export default function GeneticsPage(){
 const{state,update}=useStore()
 const[form,setForm]=useState(emptyForm)
 const[editingId,setEditingId]=useState(null)
 const[busy,setBusy]=useState(false)
 const[notice,setNotice]=useState('')
 const organizationId=activeOrganizationId(state)
 const genetics=useMemo(()=>geneticProfilesForOrganization(state,organizationId),[state,organizationId])
 const positions=state.plantPositions||[]
 const plantCount=geneticId=>positions.filter(position=>position.geneticId===geneticId&&position.active!==false&&(!explicitOrganizationId(position)||explicitOrganizationId(position)===organizationId)).length
 const reset=()=>{setEditingId(null);setForm(emptyForm());setNotice('')}
 const payload=()=>({name:form.name,color:form.color,classification:form.classification,agronomicParameters:{vegetativeDays:form.vegetativeDays,floweringDays:form.floweringDays,thcTargetPercent:form.thcTargetPercent,cbdTargetPercent:form.cbdTargetPercent}})
 async function save(event){
  event.preventDefault();if(!form.name.trim()||busy)return
  setBusy(true);setNotice('')
  try{
   await executeGeneticProfileCommand(state,{operation:editingId?GENETIC_OPERATIONS.UPDATE:GENETIC_OPERATIONS.CREATE,geneticId:editingId||'',input:payload()},{commit:update})
   reset()
  }catch(error){setNotice(error instanceof Error?error.message:'No fue posible guardar la genética.')}
  finally{setBusy(false)}
 }
 async function archive(profile){
  if(busy||!confirm(`¿Archivar ${profile.name}? El historial y las relaciones se conservarán.`))return
  setBusy(true);setNotice('')
  try{await executeGeneticProfileCommand(state,{operation:GENETIC_OPERATIONS.ARCHIVE,geneticId:profile.id},{commit:update});if(editingId===profile.id)reset()}
  catch(error){setNotice(error instanceof Error?error.message:'No fue posible archivar la genética.')}
  finally{setBusy(false)}
 }
 function edit(profile){
  setEditingId(profile.id)
  setForm({name:profile.name,color:profile.color,classification:profile.classification,vegetativeDays:profile.agronomicParameters?.vegetativeDays??'',floweringDays:profile.agronomicParameters?.floweringDays??'',thcTargetPercent:profile.agronomicParameters?.thcTargetPercent??'',cbdTargetPercent:profile.agronomicParameters?.cbdTargetPercent??''})
  setNotice('')
 }
 return <>
  <PageHeader title="Genéticas" subtitle="Perfiles genéticos por organización, con clasificación, parámetros agronómicos y trazabilidad no destructiva."/>
  <Card title={editingId?'Editar perfil genético':'Nuevo perfil genético'}>
   <form className="form-grid" onSubmit={save}>
    <Field label="Nombre" required><input required value={form.name} onChange={event=>setForm({...form,name:event.target.value})}/></Field>
    <Field label="Clasificación"><select value={form.classification} onChange={event=>setForm({...form,classification:event.target.value})}><option value="UNSPECIFIED">Sin clasificar</option><option value="THC">THC</option><option value="CBD">CBD</option><option value="MIXED">Mixta THC/CBD</option><option value="OTHER">Otra</option></select></Field>
    <Field label="Color"><input type="color" value={form.color} onChange={event=>setForm({...form,color:event.target.value})}/></Field>
    <Field label="Vegetativo objetivo (días)"><input type="number" min="0" value={form.vegetativeDays} onChange={event=>setForm({...form,vegetativeDays:event.target.value})}/></Field>
    <Field label="Floración objetivo (días)"><input type="number" min="0" value={form.floweringDays} onChange={event=>setForm({...form,floweringDays:event.target.value})}/></Field>
    <Field label="THC objetivo (%)"><input type="number" min="0" step="0.01" value={form.thcTargetPercent} onChange={event=>setForm({...form,thcTargetPercent:event.target.value})}/></Field>
    <Field label="CBD objetivo (%)"><input type="number" min="0" step="0.01" value={form.cbdTargetPercent} onChange={event=>setForm({...form,cbdTargetPercent:event.target.value})}/></Field>
    <div className="form-actions"><button className="button primary" disabled={busy}>{busy?'Guardando…':editingId?'Guardar cambios':'Crear genética'}</button>{editingId&&<button type="button" className="button secondary" onClick={reset} disabled={busy}>Cancelar</button>}</div>
   </form>
   {notice&&<p className="auth-status error" role="alert">{notice}</p>}
  </Card>
  <Card title="Catálogo de la organización">
   <div className="table-scroll"><table><thead><tr><th></th><th>Genética</th><th>Clasificación</th><th>Plantas activas</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{genetics.map(profile=><tr key={`${profile.organizationId}:${profile.id}`}><td><span className="color-dot" style={{background:profile.color}}/></td><td><strong>{profile.name}</strong></td><td>{profile.classification}</td><td>{plantCount(profile.id)}</td><td>{profile.active?'Activa':'Archivada'}</td><td><div className="form-actions"><button type="button" className="button secondary" onClick={()=>edit(profile)} disabled={busy||!profile.active}>Editar</button><button type="button" className="button secondary" onClick={()=>archive(profile)} disabled={busy||!profile.active}>Archivar</button></div></td></tr>)}</tbody></table></div>
  </Card>
 </>
}
