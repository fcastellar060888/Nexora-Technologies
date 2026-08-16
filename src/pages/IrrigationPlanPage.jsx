import{useState}from'react'
import Card from'../components/Card'
import Field from'../components/Field'
import PageHeader from'../components/PageHeader'
import{stages}from'../domain/irrigation'
import{MAX_IRRIGATION_TANK_CAPACITY_LITERS}from'../domain/irrigationTankPlanning'
import{IRRIGATION_MIRFE_OPERATIONS,useIrrigationMirfeCommandStore}from'../services/irrigationMirfeCommandStore'

export default function IrrigationPlanPage(){
 const{state,execute}=useIrrigationMirfeCommandStore()
 const[form,setForm]=useState({siteId:state.sites[0]?.id||'',houseId:'',sectorId:'',geneticId:state.genetics[0]?.id||'',stage:'Vegetativo fuerte',apps:6,minutes:5,tank:1000})
 const houses=state.houses.filter(item=>item.siteId===form.siteId)
 const sectors=(state.irrigationSectors||[]).filter(item=>item.active!==false&&item.siteId===form.siteId&&(!form.houseId||!item.houseId||item.houseId===form.houseId))
 const topologyConfigured=(state.irrigationAssignments||[]).some(item=>item.active!==false&&item.siteId===form.siteId)
 async function calculate(){
  try{await execute({operation:IRRIGATION_MIRFE_OPERATIONS.CREATE_IRRIGATION_PLAN,input:form})}catch(error){alert(error.message)}
 }
 const latest=state.irrigationPlans.at(-1)
 const canonical=latest?.calculationMode==='CANONICAL_TOPOLOGY'
 return <>
  <PageHeader title="Plan diario de riego" subtitle="Calcula caudal y pulsos desde Emitter → Sector → Assignment → Position; conserva compatibilidad explícita donde aún no existe topología canónica."/>
  <div className="content-grid two">
   <Card title="Parámetros">
    <div className="form-grid one">
     <Field label="Sede"><select value={form.siteId} onChange={event=>setForm({...form,siteId:event.target.value,houseId:'',sectorId:''})}>{state.sites.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
     <Field label="Nave"><select value={form.houseId} onChange={event=>setForm({...form,houseId:event.target.value,sectorId:''})}><option value="">Todas</option>{houses.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
     <Field label="Sector"><select value={form.sectorId} onChange={event=>setForm({...form,sectorId:event.target.value})}><option value="">Todos los sectores</option>{sectors.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
     <Field label="Genética"><select value={form.geneticId} onChange={event=>setForm({...form,geneticId:event.target.value})}>{state.genetics.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
     <Field label="Etapa"><select value={form.stage} onChange={event=>setForm({...form,stage:event.target.value})}>{stages.map(item=><option key={item}>{item}</option>)}</select></Field>
     <Field label="Aplicaciones/día"><input type="number" min="1" step="1" value={form.apps} onChange={event=>setForm({...form,apps:Number(event.target.value)})}/></Field>
     <Field label="Minutos/aplicación"><input type="number" min="0.01" step="0.01" value={form.minutes} onChange={event=>setForm({...form,minutes:Number(event.target.value)})}/></Field>
     <Field label="Capacidad tanque L"><input type="number" min="1" max={MAX_IRRIGATION_TANK_CAPACITY_LITERS} step="1" value={form.tank} onChange={event=>setForm({...form,tank:Number(event.target.value)})}/><small>Máximo operativo: {MAX_IRRIGATION_TANK_CAPACITY_LITERS.toLocaleString('es-US')} L.</small></Field>
     <small className={topologyConfigured?'ok':'warn'}>{topologyConfigured?'Topología canónica configurada para la sede.':'Compatibilidad legacy: la sede aún no tiene Assignments canónicos.'}</small>
     <button className="button primary" onClick={calculate}>Calcular y guardar</button>
    </div>
   </Card>
   <Card title="Último resultado">
    {latest?<><div className="detail-grid">
     <div><span>Modo</span><strong className={canonical?'ok':'warn'}>{canonical?'Topología canónica':'Camas legacy'}</strong></div>
     <div><span>Plantas</span><strong>{latest.plants}</strong></div>
     <div><span>L/pulso</span><strong>{Number(latest.pulse||0).toFixed(1)}</strong></div>
     <div><span>L/día</span><strong>{Number(latest.daily||0).toFixed(1)}</strong></div>
     <div><span>Preparaciones/día</span><strong>{latest.preparationCount??latest.loads}</strong></div>
     <div><span>Por aplicación</span><strong>{latest.preparationsPerApplication??'—'}</strong></div>
     <div><span>Última carga</span><strong>{Number(latest.last||0).toFixed(1)} L</strong></div>
     <div><span>Capacidad tanque</span><strong>{Number(latest.tankCapacityLiters||latest.tank||0).toFixed(1)} L</strong></div>
     <div><span>Caudal/planta</span><strong>{Number(latest.perPlantFlowLitersPerHour||0).toFixed(2)} L/h</strong></div>
     {canonical&&<><div><span>Assignments</span><strong>{latest.assignmentCount}</strong></div><div><span>Emitters</span><strong>{latest.emitterCount}</strong></div><div><span>Sectores</span><strong>{latest.sectorCount}</strong></div></>}
     <div><span>Agua</span><strong className={latest.waterStatus==='Vigente'?'ok':'warn'}>{latest.waterStatus}</strong></div>
    </div>{latest.loadSchedule?.length>0&&<div className="table-scroll"><table><thead><tr><th>Preparación</th><th>Aplicación</th><th>Carga</th><th>Volumen</th><th>Estado</th></tr></thead><tbody>{latest.loadSchedule.map(load=><tr key={load.id}><td>{load.sequence}</td><td>{load.applicationSequence}</td><td>{load.loadSequence}</td><td>{Number(load.volumeLiters).toFixed(1)} L</td><td>{load.status==='PREPARATION_CREATED'?'Preparación creada':'Planificada'}</td></tr>)}</tbody></table></div>}</>:<p className="muted">Sin cálculo.</p>}
   </Card>
  </div>
 </>
}
