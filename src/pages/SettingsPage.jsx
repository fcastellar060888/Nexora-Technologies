import{useState}from'react'
import Card from'../components/Card'
import PageHeader from'../components/PageHeader'
import{exportState}from'../services/storage'
import{useStore}from'../services/store'

export default function SettingsPage(){
 const{state,update}=useStore();const[msg,setMsg]=useState('')
 function restore(e){
  const file=e.target.files?.[0];if(!file)return
  const reader=new FileReader()
  reader.onload=()=>{
   try{
    const data=JSON.parse(reader.result)
    if(!data||!Array.isArray(data.companies)||!Array.isArray(data.sites))throw new Error('El archivo no parece un respaldo de Cannapa ERP')
    if(!confirm('Esta acción reemplazará los datos locales actuales. ¿Continuar?'))return
    update(data,{module:'Sistema',action:'Respaldo restaurado',detail:file.name,audit:false})
    setMsg('Respaldo restaurado correctamente')
  }catch(err){setMsg(err.message)}
  }
  reader.readAsText(file)
 }
 return <><PageHeader title="Configuración y respaldos" subtitle="Exporta, restaura y protege la información antes de cada prueba importante."/>
 <div className="content-grid two"><Card title="Descargar respaldo"><p>Incluye toda la operación local: infraestructura, MIPE, MIRFE, riego, inventario, producción, costos y auditoría.</p><button className="button primary" onClick={()=>exportState(state)}>Descargar JSON</button></Card>
 <Card title="Restaurar respaldo"><p>Selecciona un JSON generado por Cannapa ERP. La restauración reemplaza los datos locales.</p><label className="button secondary file-button">Seleccionar respaldo<input type="file" accept=".json,application/json" onChange={restore}/></label>{msg&&<p>{msg}</p>}</Card></div>
 </>}
