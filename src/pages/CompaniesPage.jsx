import{useMemo,useState}from'react'
import Card from'../components/Card'
import CrudActions from'../components/CrudActions'
import Field from'../components/Field'
import PageHeader from'../components/PageHeader'
import{useStore}from'../services/store'

const empty={name:'',taxId:''}
const normalize=value=>value.trim().replace(/\s+/g,' ')
const normalizeTaxId=value=>value.trim().replace(/\s+/g,'').toUpperCase()

export default function CompaniesPage(){
 const{state,update}=useStore()
 const[form,setForm]=useState(empty)
 const[editingId,setEditingId]=useState(null)
 const[message,setMessage]=useState(null)
 const siteCountByCompany=useMemo(()=>state.sites.reduce((counts,site)=>({...counts,[site.companyId]:(counts[site.companyId]||0)+1}),{}),[state.sites])

 function resetForm(){setEditingId(null);setForm(empty);setMessage(null)}

 function save(event){
  event.preventDefault()
  const name=normalize(form.name)
  const taxId=normalizeTaxId(form.taxId)
  if(!name){setMessage({tone:'error',text:'Escribe la razón social de la empresa.'});return}
  const duplicateName=state.companies.some(company=>company.id!==editingId&&normalize(company.name).toLocaleLowerCase('es')===name.toLocaleLowerCase('es'))
  if(duplicateName){setMessage({tone:'error',text:'Ya existe una empresa con esa razón social.'});return}
  const duplicateTaxId=taxId&&state.companies.some(company=>company.id!==editingId&&normalizeTaxId(company.taxId||'')===taxId)
  if(duplicateTaxId){setMessage({tone:'error',text:'Ya existe una empresa registrada con ese NIT.'});return}
  const payload={name,taxId}
  if(editingId){
   update(store=>({...store,companies:store.companies.map(company=>company.id===editingId?{...company,...payload}:company)}),{action:'Actualizar empresa',module:'Configuración',detail:name})
   setMessage({tone:'success',text:'Empresa actualizada correctamente.'})
  }else{
   update(store=>({...store,companies:[...store.companies,{id:crypto.randomUUID(),active:true,...payload}]}),{action:'Crear empresa',module:'Configuración',detail:name})
   setMessage({tone:'success',text:'Empresa creada correctamente.'})
  }
  setEditingId(null)
  setForm(empty)
 }

 function edit(company){
  setEditingId(company.id)
  setForm({name:company.name,taxId:company.taxId||''})
  setMessage(null)
  window.scrollTo({top:0,behavior:'smooth'})
 }

 function remove(company){
  const siteCount=siteCountByCompany[company.id]||0
  if(siteCount){setMessage({tone:'error',text:`No se puede eliminar ${company.name}: tiene ${siteCount} sede${siteCount===1?'':'s'} asociada${siteCount===1?'':'s'}.`});return}
  if(confirm(`¿Eliminar la empresa ${company.name}? Esta acción no se puede deshacer.`)){
   update(store=>({...store,companies:store.companies.filter(item=>item.id!==company.id)}),{action:'Eliminar empresa',module:'Configuración',detail:company.name})
   if(editingId===company.id)resetForm()
   setMessage({tone:'success',text:'Empresa eliminada.'})
  }
 }

 return <>
  <PageHeader eyebrow="Estructura organizacional" title="Empresas" subtitle="Administra las organizaciones que operan dentro de Nexora One."/>
  <div className="management-summary" aria-label="Resumen de empresas"><div><span>Empresas registradas</span><strong>{state.companies.length}</strong></div><div><span>Sedes relacionadas</span><strong>{state.sites.length}</strong></div></div>
  <Card title={editingId?'Editar empresa':'Nueva empresa'} subtitle="La razón social debe ser única. El NIT es opcional, pero no puede repetirse.">
   <form className="form-grid management-form" onSubmit={save} noValidate>
    <Field label="Razón social" required error={message?.tone==='error'&&!normalize(form.name)?message.text:null} help="Nombre legal o comercial con el que identificarás la organización."><input value={form.name} required autoComplete="organization" placeholder="Ej. Canapa S.A.S." onChange={event=>{setForm({...form,name:event.target.value});setMessage(null)}}/></Field>
    <Field label="NIT" help="Incluye el dígito de verificación cuando aplique."><input value={form.taxId} inputMode="text" autoComplete="off" placeholder="Ej. 901234567-8" onChange={event=>{setForm({...form,taxId:event.target.value});setMessage(null)}}/></Field>
    <div className="form-actions"><button className="button primary">{editingId?'Guardar cambios':'Crear empresa'}</button>{editingId&&<button type="button" className="button secondary" onClick={resetForm}>Cancelar edición</button>}</div>
   </form>
   {message&&<p className={`validation-message ${message.tone}`} role={message.tone==='error'?'alert':'status'}>{message.text}</p>}
  </Card>
  <Card title="Empresas registradas" subtitle="Selecciona una empresa para editarla o revisa cuántas sedes dependen de ella." flush>
   {state.companies.length?<div className="table-scroll"><table><thead><tr><th scope="col">Empresa</th><th scope="col">NIT</th><th scope="col">Sedes</th><th scope="col">Estado</th><th scope="col">Acciones</th></tr></thead><tbody>{state.companies.map(company=><tr key={company.id}><td><strong>{company.name}</strong></td><td>{company.taxId||'Sin registrar'}</td><td>{siteCountByCompany[company.id]||0}</td><td><span className={`tag ${company.active===false?'':'success'}`}>{company.active===false?'Inactiva':'Activa'}</span></td><td><CrudActions onEdit={()=>edit(company)} onDelete={()=>remove(company)}/></td></tr>)}</tbody></table></div>:<div className="empty-state"><strong>Aún no hay empresas</strong><p>Crea la primera organización para poder registrar sedes, usuarios y operaciones.</p></div>}
  </Card>
 </>
}
