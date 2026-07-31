import{useMemo,useState}from'react'
import Card from'../components/Card'
import PageHeader from'../components/PageHeader'
import{buildMigrationManifest,createMigrationBackup,executeInitialMigration,hashBackup,previewInitialMigration,rollbackInitialMigration}from'../services/initialMigration.js'
import{useStore}from'../services/store'

function downloadJson(value,name){
 const blob=new Blob([JSON.stringify(value,null,2)],{type:'application/json'})
 const url=URL.createObjectURL(blob)
 const anchor=document.createElement('a');anchor.href=url;anchor.download=name;anchor.click();URL.revokeObjectURL(url)
}

export default function InitialMigrationPage(){
 const{state,update}=useStore()
 const[preview,setPreview]=useState(null)
 const[busy,setBusy]=useState(false)
 const[msg,setMsg]=useState('')
 const[confirmed,setConfirmed]=useState(false)
 const[backupHash,setBackupHash]=useState('')
 const[completed,setCompleted]=useState(null)
 const companyId=state.currentContext?.companyId||''
 const manifest=useMemo(()=>buildMigrationManifest(state,{companyId}),[state,companyId])

 async function backup(){
  const value=createMigrationBackup(state,manifest)
  const hash=await hashBackup(value)
  setBackupHash(hash)
  downloadJson(value,`cannapa-backup-${manifest.migrationId}.json`)
  setMsg(`Respaldo creado. SHA-256: ${hash}`)
 }
 async function simulate(){setBusy(true);setMsg('');try{setPreview(await previewInitialMigration(manifest));setMsg('Simulación completada. Revisa el resultado antes de continuar.')}catch(error){setMsg(error.message)}finally{setBusy(false)}}
 async function execute(){setBusy(true);setMsg('');try{
  const result=await executeInitialMigration(manifest,{backupHash,confirmationToken:confirmed?'MIGRAR': ''})
  setCompleted(result)
  update(prev=>({...prev,syncMeta:{...(prev.syncMeta||{}),initialMigration:{migrationId:manifest.migrationId,completedAt:new Date().toISOString(),backupHash}}}),{sync:false,action:'Migración inicial a PostgreSQL',module:'Sistema'})
  setMsg(`Migración completada: ${result?.inserted||0} insertados, ${result?.updated||0} actualizados.`)
 }catch(error){setMsg(error.message)}finally{setBusy(false)}}
 async function rollback(){setBusy(true);setMsg('');try{const result=await rollbackInitialMigration({companyId,migrationId:manifest.migrationId});setMsg(`Reversión completada: ${result?.removed||0} registros retirados.`)}catch(error){setMsg(error.message)}finally{setBusy(false)}}

 return <>
  <PageHeader title="Migración inicial a PostgreSQL" subtitle="Asistente seguro para trasladar los datos locales existentes a la base empresarial."/>
  <div className="content-grid four"><Card title="Colecciones"><strong>{manifest.collections.length}</strong></Card><Card title="Registros"><strong>{manifest.total}</strong></Card><Card title="Empresa"><strong>{companyId||'No seleccionada'}</strong></Card><Card title="Esquema local"><strong>v{manifest.schemaVersion}</strong></Card></div>
  <Card title="Validación previa">
   {manifest.validation.valid?<p>La estructura básica es válida.</p>:<ul>{manifest.validation.errors.map(item=><li key={item}>{item}</li>)}</ul>}
   {manifest.validation.warnings.length>0&&<><h3>Advertencias</h3><ul>{manifest.validation.warnings.map(item=><li key={item}>{item}</li>)}</ul></>}
  </Card>
  <Card title="Inventario de datos"><div className="table-wrap"><table><thead><tr><th>Colección</th><th>Registros</th></tr></thead><tbody>{manifest.collections.map(item=><tr key={item.collection}><td>{item.collection}</td><td>{item.count}</td></tr>)}</tbody></table></div></Card>
  <Card title="Proceso controlado">
   <ol><li>Descarga el respaldo local.</li><li>Ejecuta la simulación contra PostgreSQL.</li><li>Revisa duplicados, inserciones y actualizaciones.</li><li>Confirma y ejecuta la migración.</li></ol>
   <div className="form-actions"><button className="button secondary" disabled={busy||!manifest.validation.valid} onClick={backup}>1. Crear respaldo</button><button className="button secondary" disabled={busy||!backupHash} onClick={simulate}>2. Simular</button></div>
   {preview&&<pre>{JSON.stringify(preview,null,2)}</pre>}
   <label><input type="checkbox" checked={confirmed} onChange={event=>setConfirmed(event.target.checked)}/> Confirmo que revisé el respaldo y la simulación.</label>
   <div className="form-actions"><button className="button primary" disabled={busy||!confirmed||!backupHash||!preview} onClick={execute}>3. Ejecutar migración</button>{completed&&<button className="button secondary" disabled={busy} onClick={rollback}>Revertir esta migración</button>}</div>
   {msg&&<p role="status">{msg}</p>}
  </Card>
 </>
}
