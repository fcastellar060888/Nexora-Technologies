import{useEffect,useMemo,useState}from'react'
import Card from'./Card'
import DateTimeFields from'./DateTimeFields'
import Field from'./Field'
import StateMessage from'./StateMessage'
import{
 CALIBRATION_RESULTS,ENVIRONMENT_DEVICE_KINDS,ENVIRONMENT_DEVICE_STATUSES,
 ENVIRONMENT_VARIABLES,MEASUREMENT_SOURCES
}from'../domain/environment.js'
import{ENVIRONMENT_OPERATIONS}from'../services/environmentCommandStore.js'

const now=()=>new Date().toISOString().slice(0,16)
const split=value=>value.split(',').map(item=>item.trim()).filter(Boolean)
const blankDevice=()=>({elementId:'',kind:ENVIRONMENT_DEVICE_KINDS.SENSOR,code:'',name:'',variables:'temperature, humidity, co2',externalId:''})
const blankCalibration=()=>({deviceId:'',performedAt:now(),validUntil:'',result:CALIBRATION_RESULTS.PASS,methodId:'',certificateId:'',notes:''})
const blankSetpoint=()=>({elementId:'',effectiveFrom:now(),tempMin:'',tempMax:'',humidityMin:'',humidityMax:'',co2Min:'',co2Max:'',notes:''})
const blankReading=()=>({elementId:'',recordedAt:now(),source:MEASUREMENT_SOURCES.MANUAL,deviceId:'',calibrationId:'',temperature:'',humidity:'',co2:'',evidenceId:'',calculationInputs:'',notes:''})

const sourceLabels={
 [MEASUREMENT_SOURCES.SENSOR]:'Sensor',
 [MEASUREMENT_SOURCES.CONTROLLER]:'Controlador',
 [MEASUREMENT_SOURCES.MANUAL]:'Manual',
 [MEASUREMENT_SOURCES.SAMPLE]:'Muestra',
 [MEASUREMENT_SOURCES.IMPORTED]:'Importado',
 [MEASUREMENT_SOURCES.CALCULATED]:'Calculado'
}

function target(minimum,maximum){
 if(minimum===''&&maximum==='')return null
 return{minimum:minimum===''?null:Number(minimum),maximum:maximum===''?null:Number(maximum)}
}

function valuesOf(reading){
 return Object.entries(reading.values||{}).map(([name,value])=>`${name}: ${value} ${reading.units?.[name]||''}`).join(' · ')
}

export default function EnvironmentMeasurementsPanel({state,execute,siteId,elements=[]}){
 const[device,setDevice]=useState(blankDevice),[calibration,setCalibration]=useState(blankCalibration),[setpoint,setSetpoint]=useState(blankSetpoint),[reading,setReading]=useState(blankReading)
 const[feedback,setFeedback]=useState({type:'',message:''}),[busy,setBusy]=useState(false)
 useEffect(()=>{
  setDevice(blankDevice());setCalibration(blankCalibration());setSetpoint(blankSetpoint());setReading(blankReading());setFeedback({type:'',message:''})
 },[siteId])
 const environmentalElements=useMemo(()=>elements.filter(item=>['room','nave','rack','storage','other'].includes(item.type)),[elements])
 const devices=(state.environmentDevices||[]).filter(item=>item.siteId===siteId)
 const calibrations=(state.environmentCalibrations||[]).filter(item=>item.siteId===siteId)
 const setpoints=(state.environmentSetpoints||[]).filter(item=>item.siteId===siteId).sort((left,right)=>Date.parse(right.effectiveFrom)-Date.parse(left.effectiveFrom))
 const readings=(state.environmentalReadings||[]).filter(item=>item.siteId===siteId).sort((left,right)=>Date.parse(right.recordedAt)-Date.parse(left.recordedAt))
 const alerts=(state.environmentAlerts||[]).filter(item=>item.siteId===siteId).sort((left,right)=>Date.parse(right.triggeredAt)-Date.parse(left.triggeredAt))
 const selectedDevice=devices.find(item=>item.id===calibration.deviceId)
 const readingDevices=devices.filter(item=>item.elementId===reading.elementId&&item.status===ENVIRONMENT_DEVICE_STATUSES.ACTIVE&&item.kind===reading.source)
 const readingCalibrations=calibrations.filter(item=>item.deviceId===reading.deviceId&&item.result===CALIBRATION_RESULTS.PASS)

 async function submit(command,message,reset){
  setBusy(true);setFeedback({type:'',message:''})
  try{await execute(command);reset();setFeedback({type:'success',message})}
  catch(error){setFeedback({type:'error',message:error?.message||'No fue posible completar la operación ambiental.'})}
  finally{setBusy(false)}
 }

 function saveDevice(event){
  event.preventDefault()
  submit({operation:ENVIRONMENT_OPERATIONS.REGISTER_DEVICE,entityId:crypto.randomUUID(),input:{...device,siteId,variables:split(device.variables)}},'Dispositivo ambiental registrado.',()=>setDevice(blankDevice()))
 }

 function saveCalibration(event){
  event.preventDefault()
  submit({operation:ENVIRONMENT_OPERATIONS.RECORD_CALIBRATION,entityId:crypto.randomUUID(),input:{...calibration,validUntil:calibration.validUntil||null,variables:selectedDevice?.variables||[]}},'Calibración registrada.',()=>setCalibration(blankCalibration()))
 }

 function saveSetpoint(event){
  event.preventDefault()
  const targets={temperature:target(setpoint.tempMin,setpoint.tempMax),humidity:target(setpoint.humidityMin,setpoint.humidityMax),co2:target(setpoint.co2Min,setpoint.co2Max)}
  for(const key of Object.keys(targets))if(!targets[key])delete targets[key]
  submit({operation:ENVIRONMENT_OPERATIONS.CREATE_SETPOINT,entityId:crypto.randomUUID(),input:{siteId,elementId:setpoint.elementId,setpointKey:`${siteId}:${setpoint.elementId}:climate`,effectiveFrom:setpoint.effectiveFrom,targets,notes:setpoint.notes}},'Nueva versión de setpoint creada.',()=>setSetpoint(blankSetpoint()))
 }

 function readingEvidence(){
  if(reading.source===MEASUREMENT_SOURCES.SAMPLE)return{sampleId:reading.evidenceId}
  if(reading.source===MEASUREMENT_SOURCES.IMPORTED)return{importId:reading.evidenceId}
  if(reading.source===MEASUREMENT_SOURCES.CALCULATED)return{methodId:reading.evidenceId,inputReadingIds:split(reading.calculationInputs)}
  return{}
 }

 function saveReading(event){
  event.preventDefault()
  const values={temperature:reading.temperature,humidity:reading.humidity,co2:reading.co2}
  for(const key of Object.keys(values))if(values[key]==='')delete values[key]
  submit({operation:ENVIRONMENT_OPERATIONS.RECORD_READING,entityId:crypto.randomUUID(),input:{siteId,elementId:reading.elementId,recordedAt:reading.recordedAt,source:reading.source,deviceId:reading.deviceId,calibrationId:reading.calibrationId,values,sourceEvidence:readingEvidence(),setpointKey:`${siteId}:${reading.elementId}:climate`,notes:reading.notes}},'Lectura y alertas canónicas registradas.',()=>setReading(blankReading()))
 }

 return <>
  {feedback.message&&<StateMessage type={feedback.type} title={feedback.type==='error'?'Operación rechazada':'Autoridad ambiental actualizada'} message={feedback.message} compact/>}
  <div className="content-grid two">
   <Card title="Dispositivo ambiental"><form className="form-grid" onSubmit={saveDevice}>
    <Field label="Zona"><select value={device.elementId} onChange={event=>setDevice({...device,elementId:event.target.value})} required><option value="">Seleccionar</option>{environmentalElements.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
    <Field label="Tipo"><select value={device.kind} onChange={event=>setDevice({...device,kind:event.target.value})}>{Object.values(ENVIRONMENT_DEVICE_KINDS).map(kind=><option key={kind} value={kind}>{sourceLabels[kind]}</option>)}</select></Field>
    <Field label="Código"><input value={device.code} onChange={event=>setDevice({...device,code:event.target.value})} required/></Field>
    <Field label="Nombre"><input value={device.name} onChange={event=>setDevice({...device,name:event.target.value})} required/></Field>
    <Field label="Variables canónicas"><input value={device.variables} onChange={event=>setDevice({...device,variables:event.target.value})} placeholder={Object.keys(ENVIRONMENT_VARIABLES).join(', ')}/></Field>
    <Field label="ID de integración"><input value={device.externalId} onChange={event=>setDevice({...device,externalId:event.target.value})}/></Field>
    <div className="form-actions"><button className="button primary" disabled={busy||!siteId}>Registrar dispositivo</button></div>
   </form></Card>
   <Card title="Calibración canónica"><form className="form-grid" onSubmit={saveCalibration}>
    <Field label="Dispositivo"><select value={calibration.deviceId} onChange={event=>setCalibration({...calibration,deviceId:event.target.value})} required><option value="">Seleccionar</option>{devices.filter(item=>item.status===ENVIRONMENT_DEVICE_STATUSES.ACTIVE).map(item=><option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></Field>
    <Field label="Resultado"><select value={calibration.result} onChange={event=>setCalibration({...calibration,result:event.target.value})}>{Object.values(CALIBRATION_RESULTS).map(result=><option key={result}>{result}</option>)}</select></Field>
    <Field label="Calibrado en"><DateTimeFields value={calibration.performedAt} onChange={performedAt=>setCalibration({...calibration,performedAt})} required/></Field>
    <Field label="Válido hasta"><DateTimeFields value={calibration.validUntil} onChange={validUntil=>setCalibration({...calibration,validUntil})}/></Field>
    <Field label="Método"><input value={calibration.methodId} onChange={event=>setCalibration({...calibration,methodId:event.target.value})} required/></Field>
    <Field label="Certificado"><input value={calibration.certificateId} onChange={event=>setCalibration({...calibration,certificateId:event.target.value})}/></Field>
    <Field label="Notas"><textarea value={calibration.notes} onChange={event=>setCalibration({...calibration,notes:event.target.value})}/></Field>
    <div className="form-actions"><button className="button primary" disabled={busy}>Registrar calibración</button></div>
   </form></Card>
  </div>
  <div className="content-grid two">
   <Card title="Setpoint versionado"><form className="form-grid" onSubmit={saveSetpoint}>
    <Field label="Zona"><select value={setpoint.elementId} onChange={event=>setSetpoint({...setpoint,elementId:event.target.value})} required><option value="">Seleccionar</option>{environmentalElements.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
    <Field label="Vigente desde"><DateTimeFields value={setpoint.effectiveFrom} onChange={effectiveFrom=>setSetpoint({...setpoint,effectiveFrom})} required/></Field>
    <Field label="Temperatura mínima °C"><input type="number" step="0.1" value={setpoint.tempMin} onChange={event=>setSetpoint({...setpoint,tempMin:event.target.value})}/></Field>
    <Field label="Temperatura máxima °C"><input type="number" step="0.1" value={setpoint.tempMax} onChange={event=>setSetpoint({...setpoint,tempMax:event.target.value})}/></Field>
    <Field label="Humedad mínima %"><input type="number" step="0.1" value={setpoint.humidityMin} onChange={event=>setSetpoint({...setpoint,humidityMin:event.target.value})}/></Field>
    <Field label="Humedad máxima %"><input type="number" step="0.1" value={setpoint.humidityMax} onChange={event=>setSetpoint({...setpoint,humidityMax:event.target.value})}/></Field>
    <Field label="CO₂ mínimo ppm"><input type="number" value={setpoint.co2Min} onChange={event=>setSetpoint({...setpoint,co2Min:event.target.value})}/></Field>
    <Field label="CO₂ máximo ppm"><input type="number" value={setpoint.co2Max} onChange={event=>setSetpoint({...setpoint,co2Max:event.target.value})}/></Field>
    <Field label="Notas"><textarea value={setpoint.notes} onChange={event=>setSetpoint({...setpoint,notes:event.target.value})}/></Field>
    <div className="form-actions"><button className="button primary" disabled={busy}>Crear nueva versión</button></div>
   </form></Card>
   <Card title="Lectura ambiental"><form className="form-grid" onSubmit={saveReading}>
    <Field label="Zona"><select value={reading.elementId} onChange={event=>setReading({...reading,elementId:event.target.value,deviceId:'',calibrationId:''})} required><option value="">Seleccionar</option>{environmentalElements.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
    <Field label="Fuente"><select value={reading.source} onChange={event=>setReading({...reading,source:event.target.value,deviceId:'',calibrationId:'',evidenceId:'',calculationInputs:''})}>{Object.values(MEASUREMENT_SOURCES).map(source=><option key={source} value={source}>{sourceLabels[source]}</option>)}</select></Field>
    <Field label="Fecha y hora"><DateTimeFields value={reading.recordedAt} onChange={recordedAt=>setReading({...reading,recordedAt})} required/></Field>
    {(reading.source===MEASUREMENT_SOURCES.SENSOR||reading.source===MEASUREMENT_SOURCES.CONTROLLER)&&<>
     <Field label="Dispositivo"><select value={reading.deviceId} onChange={event=>setReading({...reading,deviceId:event.target.value,calibrationId:''})} required><option value="">Seleccionar</option>{readingDevices.map(item=><option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></Field>
     <Field label="Calibración"><select value={reading.calibrationId} onChange={event=>setReading({...reading,calibrationId:event.target.value})}><option value="">Última vigente compatible</option>{readingCalibrations.map(item=><option key={item.id} value={item.id}>{item.performedAt} · {item.methodId}</option>)}</select></Field>
    </>}
    {[MEASUREMENT_SOURCES.SAMPLE,MEASUREMENT_SOURCES.IMPORTED,MEASUREMENT_SOURCES.CALCULATED].includes(reading.source)&&<Field label={reading.source===MEASUREMENT_SOURCES.SAMPLE?'ID de muestra':reading.source===MEASUREMENT_SOURCES.IMPORTED?'ID de importación':'Método de cálculo'}><input value={reading.evidenceId} onChange={event=>setReading({...reading,evidenceId:event.target.value})} required/></Field>}
    {reading.source===MEASUREMENT_SOURCES.CALCULATED&&<Field label="Lecturas causales"><input value={reading.calculationInputs} onChange={event=>setReading({...reading,calculationInputs:event.target.value})} placeholder="id-1, id-2" required/></Field>}
    <Field label="Temperatura °C"><input type="number" step="0.1" value={reading.temperature} onChange={event=>setReading({...reading,temperature:event.target.value})}/></Field>
    <Field label="Humedad %"><input type="number" step="0.1" value={reading.humidity} onChange={event=>setReading({...reading,humidity:event.target.value})}/></Field>
    <Field label="CO₂ ppm"><input type="number" value={reading.co2} onChange={event=>setReading({...reading,co2:event.target.value})}/></Field>
    <Field label="Notas"><textarea value={reading.notes} onChange={event=>setReading({...reading,notes:event.target.value})}/></Field>
    <div className="form-actions"><button className="button primary" disabled={busy}>Registrar lectura</button></div>
   </form></Card>
  </div>
  <div className="content-grid two">
   <Card title="Historial de setpoints">{!setpoints.length?<StateMessage title="Sin setpoints" message="Crea la primera versión para evaluar lecturas sin duplicar targets." compact/>:<div className="table-wrap"><table><thead><tr><th>Versión</th><th>Zona</th><th>Vigente desde</th><th>Variables</th></tr></thead><tbody>{setpoints.map(item=><tr key={item.id}><td>{item.version}</td><td>{environmentalElements.find(element=>element.id===item.elementId)?.name||item.elementId}</td><td>{item.effectiveFrom}</td><td>{Object.keys(item.targets).join(', ')}</td></tr>)}</tbody></table></div>}</Card>
   <Card title="Alertas ambientales canónicas">{!alerts.length?<StateMessage type="success" title="Sin alertas" message="No hay lecturas fuera de los setpoints vigentes." compact/>:<div className="table-wrap"><table><thead><tr><th>Fecha</th><th>Variable</th><th>Dirección</th><th>Valor</th><th>Setpoint</th></tr></thead><tbody>{alerts.slice(0,20).map(item=><tr key={item.id}><td>{item.triggeredAt}</td><td>{item.variable}</td><td>{item.direction}</td><td>{item.observedValue} {item.unit}</td><td>{item.setpointId}</td></tr>)}</tbody></table></div>}</Card>
  </div>
  <Card title="Lecturas con trazabilidad">{!readings.length?<StateMessage title="Sin lecturas" message="Registra una lectura con fuente y evidencia canónicas." compact/>:<div className="table-wrap"><table><thead><tr><th>Fecha</th><th>Zona</th><th>Fuente</th><th>Valores</th><th>Dispositivo / calibración</th><th>Setpoint</th></tr></thead><tbody>{readings.slice(0,20).map(item=><tr key={item.id}><td>{item.recordedAt}</td><td>{environmentalElements.find(element=>element.id===item.elementId)?.name||item.elementId}</td><td>{sourceLabels[item.source]||item.source}</td><td>{valuesOf(item)}</td><td>{item.deviceId||'—'}<small>{item.calibrationId||''}</small></td><td>{item.setpointId||'Sin setpoint'}</td></tr>)}</tbody></table></div>}</Card>
 </>
}
