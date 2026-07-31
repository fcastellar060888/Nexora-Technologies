import{useRef,useState}from'react'
import Card from'../components/Card'
import PageHeader from'../components/PageHeader'
import{exportState}from'../services/storage'
import{useStore}from'../services/store'

function validateBackup(data){
 if(!data||typeof data!=='object')throw new Error('El archivo no contiene un respaldo válido.')
 if(!Array.isArray(data.companies)||!Array.isArray(data.sites))throw new Error('El archivo no parece un respaldo compatible con Nexora One.')
 if(data.currentContext&&typeof data.currentContext!=='object')throw new Error('El contexto del respaldo no es válido.')
 return data
}

export default function SettingsPage(){
 const{state,update}=useStore()
 const[msg,setMsg]=useState({type:'',text:''})
 const[busy,setBusy]=useState(false)
 const fileInput=useRef(null)
 const collectionCount=Object.values(state).filter(Array.isArray).length
 const recordCount=Object.values(state).filter(Array.isArray).reduce((total,items)=>total+items.length,0)

 function download(){
  try{exportState(state);setMsg({type:'success',text:'Respaldo generado correctamente.'})}
  catch(error){setMsg({type:'error',text:error instanceof Error?error.message:'No fue posible generar el respaldo.'})}
 }

 function restore(e){
  const file=e.target.files?.[0]
  if(!file)return
  setBusy(true);setMsg({type:'',text:''})
  const reader=new FileReader()
  reader.onload=()=>{
   try{
    const data=validateBackup(JSON.parse(String(reader.result||'')))
    if(!confirm(`El respaldo “${file.name}” reemplazará todos los datos locales actuales. ¿Continuar?`))return
    update(data,{module:'Sistema',action:'Respaldo restaurado',detail:file.name,audit:false})
    setMsg({type:'success',text:`Respaldo ${file.name} restaurado correctamente.`})
   }catch(error){setMsg({type:'error',text:error instanceof Error?error.message:'No fue posible restaurar el respaldo.'})}
   finally{setBusy(false);if(fileInput.current)fileInput.current.value=''}
  }
  reader.onerror=()=>{setBusy(false);setMsg({type:'error',text:'No fue posible leer el archivo seleccionado.'});if(fileInput.current)fileInput.current.value=''}
  reader.readAsText(file)
 }

 return <>
  <PageHeader eyebrow="Sistema" title="Configuración y respaldos" subtitle="Protege la información local antes de pruebas, migraciones o cambios operativos importantes."/>
  <div className="summary-strip admin-summary">
   <div><span>Empresas</span><strong>{state.companies.length}</strong></div>
   <div><span>Sedes</span><strong>{state.sites.length}</strong></div>
   <div><span>Colecciones</span><strong>{collectionCount}</strong></div>
   <div><span>Registros locales</span><strong>{recordCount.toLocaleString('es-CO')}</strong></div>
  </div>
  <div className="content-grid two settings-grid">
   <Card title="Descargar respaldo" subtitle="Genera un archivo JSON con el estado local completo de Nexora One.">
    <div className="settings-action-body"><p>Incluye infraestructura, MIPE, MIRFE, riego, inventario, producción, costos, usuarios locales y auditoría.</p><div className="settings-notice"><strong>Recomendación</strong><span>Descarga un respaldo antes de restaurar datos, hacer migraciones o probar cambios estructurales.</span></div></div>
    <div className="card-footer-actions"><button className="button primary" onClick={download}>Descargar respaldo JSON</button></div>
   </Card>
   <Card title="Restaurar respaldo" subtitle="Reemplaza el estado local usando un JSON compatible generado por Nexora One.">
    <div className="settings-action-body"><p>La restauración sustituye todos los datos locales actuales. Esta acción no puede deshacerse desde la interfaz.</p><div className="settings-notice warning"><strong>Antes de continuar</strong><span>Confirma que el archivo corresponde a la empresa y al entorno correctos.</span></div></div>
    <div className="card-footer-actions"><label className={`button secondary file-button ${busy?'is-disabled':''}`}>{busy?'Leyendo respaldo…':'Seleccionar respaldo'}<input ref={fileInput} type="file" accept=".json,application/json" disabled={busy} onChange={restore}/></label></div>
   </Card>
  </div>
  {msg.text&&<p className={`validation-message settings-message ${msg.type}`} role={msg.type==='error'?'alert':'status'}>{msg.text}</p>}
 </>
}
