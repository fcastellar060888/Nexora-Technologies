import{useState}from'react'
import Card from'../components/Card'
import Field from'../components/Field'
import PageHeader from'../components/PageHeader'
import StateMessage from'../components/StateMessage'
import{MIPE_OPERATIONS}from'../services/mipeCommand.js'
import{useMipeCommandStore}from'../services/mipeCommandStore.js'

const emptyIncident={name:'',category:'Plaga',risk:'Medio',color:'#e67e22',scientificName:'',description:'',validFrom:'',validUntil:''}

export default function IncidentsPage(){
 const{state,execute}=useMipeCommandStore(),[f,setF]=useState(emptyIncident)
 async function add(e){
  e.preventDefault();if(!f.name.trim())return
  try{await execute({operation:MIPE_OPERATIONS.CREATE_INCIDENT,input:{active:true,...f}});setF(emptyIncident)}catch(error){alert(error.message)}
 }
 async function archive(id){
  if(!confirm('¿Archivar esta incidencia? Su identidad e historial se conservarán.'))return
  try{await execute({operation:MIPE_OPERATIONS.ARCHIVE_INCIDENT,entityId:id,input:{reason:'Retirada del catálogo sanitario activo'}})}catch(error){alert(error.message)}
 }
 return <><PageHeader title="Catálogo sanitario" subtitle="Plagas, enfermedades, deficiencias y daños con vigencia técnica e historial no destructivo."/>
  <Card title="Nueva incidencia"><form className="form-grid" onSubmit={add}>
   <Field label="Nombre"><input required value={f.name} onChange={e=>setF({...f,name:e.target.value})}/></Field>
   <Field label="Nombre científico"><input value={f.scientificName} onChange={e=>setF({...f,scientificName:e.target.value})}/></Field>
   <Field label="Categoría"><select value={f.category} onChange={e=>setF({...f,category:e.target.value})}><option>Plaga</option><option>Enfermedad</option><option>Nutricional</option><option>Ambiental</option><option>Daño físico</option><option>Otro</option></select></Field>
   <Field label="Riesgo"><select value={f.risk} onChange={e=>setF({...f,risk:e.target.value})}><option>Bajo</option><option>Medio</option><option>Alto</option><option>Crítico</option></select></Field>
   <Field label="Vigente desde"><input type="date" value={f.validFrom} onChange={e=>setF({...f,validFrom:e.target.value})}/></Field>
   <Field label="Vigente hasta"><input type="date" value={f.validUntil} onChange={e=>setF({...f,validUntil:e.target.value})}/></Field>
   <Field label="Color"><input type="color" value={f.color} onChange={e=>setF({...f,color:e.target.value})}/></Field>
   <Field label="Descripción"><textarea value={f.description} onChange={e=>setF({...f,description:e.target.value})}/></Field>
   <div className="form-actions"><button className="button primary">Guardar</button></div>
  </form></Card>
  <Card title="Incidencias">{!state.incidents.length?<StateMessage type="empty" title="No hay incidencias configuradas" message="Registra la primera plaga, enfermedad, deficiencia o daño para utilizarla en los hallazgos MIPE."/>:<div className="table-scroll"><table><thead><tr><th></th><th>Nombre</th><th>Categoría</th><th>Riesgo</th><th>Vigencia</th><th>Estado</th><th></th></tr></thead><tbody>{state.incidents.map(i=>{const archived=i.active===false||Boolean(i.archivedAt);return <tr key={i.id}><td><span className="color-dot" style={{background:i.color}}/></td><td><strong>{i.name}</strong>{i.scientificName&&<small>{i.scientificName}</small>}</td><td>{i.category}</td><td>{i.risk}</td><td>{i.validFrom?String(i.validFrom).slice(0,10):'Sin inicio'} → {i.validUntil?String(i.validUntil).slice(0,10):'Sin fin'}</td><td>{archived?'Archivada':'Activa'}</td><td>{!archived&&<button className="button text-danger" onClick={()=>archive(i.id)}>Archivar</button>}</td></tr>})}</tbody></table></div>}</Card>
 </>
}
