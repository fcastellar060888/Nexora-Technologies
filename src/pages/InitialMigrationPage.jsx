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
function immutableSnapshot(value){return JSON.parse(JSON.stringify(value))}

export default function InitialMigrationPage(){
 const{state,update}=useStore()
 const[preview,setPreview]=useState(null)
 const[busy,setBusy]=useState(false)
 const[msg,setMsg]=useState('')
 const[confirmed,setConfirmed]=useState(false)
 const[backupHash,setBackupHash]=useState('')
 const[preparedManifest,setPreparedManifest]=useState(null)
 const[completed,setCompleted]=useState(null)
 const companyId=state.currentContext?.companyId||''
 const manifest=useMemo(()=>buildMigrationManifest(state,{companyId}),[state,companyId])
 const preparedForActiveCompany=Boolean(preparedManifest&&preparedManifest.companyId===companyId)

 function requirePrepared(){
  if(!preparedManifest)throw new Error('Crea primero un respaldo para fijar la fotografía de migración.')
  if(preparedManifest.companyId!==companyId)throw new Error('La empresa activa cambió después del respaldo. Crea un nuevo respaldo antes de continuar.')
  return preparedManifest
 }
 async function backup(){
  setBusy(true);setMsg('')
  try{
   const prepared=immutableSnapshot(manifest)
   if(!prepared.validation.valid)throw new Error(prepared.validation.errors.join(' '))
   const value=createMigrationBackup(state,prepared)
   const hash=await hashBackup(value)
   setPreparedManifest(prepared)
   setBackupHash(hash)
   setPreview(null);setConfirmed(false);setCompleted(null)
   downloadJson(value,`nexora-one-backup-${prepared.migrationId}.json`)
   setMsg(`Respaldo creado para ${prepared.migrationId}. SHA-256: ${hash}`)
  }catch(error){setMsg(error instanceof Error?error.message:'No fue posible crear el respaldo')}
  finally{setBusy(false)}
 }
 async function simulate(){setBusy(true);setMsg('');try{const prepared=requirePrepared();setPreview(await previewInitialMigration(prepared));setConfirmed(false);setMsg(`Simulación completada para ${prepared.migrationId}. Revisa el resultado antes de continuar.`)}catch(error){setMsg(error instanceof Error?error.message:'No fue posible simular la migración')}finally{setBusy(false)}}
 async function execute(){setBusy(true);setMsg('');try{
  const prepared=requirePrepared()
  if(!preview)throw new Error('Ejecuta y revisa la simulación de esta fotografía antes de migrar.')
  const result=await executeInitialMigration(prepared,{backupHash,confirmationToken:confirmed?'MIGRAR':''})
  const completion={...(result||{}),companyId:prepared.companyId,migrationId:prepared.migrationId,backupHash}
  setCompleted(completion)
  update(prev=>({...prev,syncMeta:{...(prev.syncMeta||{}),initialMigration:{migrationId:prepared.migrationId,companyId:prepared.companyId,completedAt:new Date().toISOString(),backupHash}}}),{sync:false,action:'Migración inicial a PostgreSQL',module:'Sistema'})
  setMsg(`Migración ${prepared.migrationId} completada: ${result?.inserted||0} insertados, ${result?.updated||0} actualizados.`)
 }catch(error){setMsg(error instanceof Error?error.message:'No fue posible ejecutar la migración')}finally{setBusy(false)}}
 async function rollback(){setBusy(true);setMsg('');try{
  if(!completed?.companyId||!completed?.migrationId)throw new Error('No existe una migración completada identificable para revertir.')
  if(companyId!==completed.companyId)throw new Error('Selecciona la empresa de la migración completada antes de revertirla.')
  const result=await rollbackInitialMigration({companyId:completed.companyId,migrationId:completed.migrationId})
  setMsg(`Reversión ${completed.migrationId} completada: ${result?.removed||0} registros retirados.`)
 }catch(error){setMsg(error instanceof Error?error.message:'No fue posible revertir la migración')}finally{setBusy(false)}}

 return <>
  <PageHeader title="Migración inicial a PostgreSQL" subtitle="Asistente seguro para trasladar los datos locales existentes a la base empresarial."/>
  <div className="content-grid four"><Card title="Colecciones"><strong>{manifest.collections.length}</strong></Card><Card title="Registros"><strong>{manifest.total}</strong></Card><Card title="Empresa"><strong>{companyId||'No seleccionada'}</strong></Card><Card title="Esquema local"><strong>v{manifest.schemaVersion}</strong></Card></div>
  <Card title="Validación previa">
   {manifest.validation.valid?<p>La estructura básica es válida.</p>:<ul>{manifest.validation.errors.map(item=><li key={item}>{item}</li>)}</ul>}
   {manifest.validation.warnings.length>0&&<><h3>Advertencias</h3><ul>{manifest.validation.warnings.map(item=><li key={item}>{item}</li>)}</ul></>}
  </Card>
  <Card title="Inventario de datos"><div className="table-wrap"><table><thead><tr><th>Colección</th><th>Registros</th></tr></thead><tbody>{manifest.collections.map(item=><tr key={item.collection}><td>{item.collection}</td><td>{item.count}</td></tr>)}</tbody></table></div></Card>
  <Card title="Proceso controlado">
   <ol><li>Descarga el respaldo local y fija una fotografía inmutable.</li><li>Ejecuta la simulación de esa misma fotografía.</li><li>Revisa duplicados, inserciones y actualizaciones.</li><li>Confirma y ejecuta exactamente el mismo manifest.</li></ol>
   {preparedManifest&&<p>Fotografía preparada: <strong>{preparedManifest.migrationId}</strong> · {preparedManifest.total} registros · {preparedManifest.companyId}{!preparedForActiveCompany?' · EMPRESA ACTIVA CAMBIÓ':''}</p>}
   <div className="form-actions"><button className="button secondary" disabled={busy||!manifest.validation.valid} onClick={backup}>1. Crear respaldo</button><button className="button secondary" disabled={busy||!backupHash||!preparedForActiveCompany} onClick={simulate}>2. Simular</button></div>
   {preview&&<pre>{JSON.stringify(preview,null,2)}</pre>}
   <label><input type="checkbox" checked={confirmed} disabled={!preview||!preparedForActiveCompany} onChange={event=>setConfirmed(event.target.checked)}/> Confirmo que revisé el respaldo y la simulación de esta fotografía.</label>
   <div className="form-actions"><button className="button primary" disabled={busy||!confirmed||!backupHash||!preview||!preparedForActiveCompany} onClick={execute}>3. Ejecutar migración</button>{completed&&<button className="button secondary" disabled={busy||companyId!==completed.companyId} onClick={rollback}>Revertir esta migración</button>}</div>
   {msg&&<p role="status">{msg}</p>}
  </Card>
 </>
}
