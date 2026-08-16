import { useState } from 'react'
import Card from '../components/Card'
import Field from '../components/Field'
import PageHeader from '../components/PageHeader'
import StateMessage from '../components/StateMessage'
import {FormActions,ValidationMessage} from'../components/forms/FormKit.jsx'
import { calculateVpd, deltaEc } from '../domain/mirfe'
import {IRRIGATION_MIRFE_OPERATIONS,useIrrigationMirfeCommandStore} from '../services/irrigationMirfeCommandStore'

const empty={siteId:'',houseId:'',bedId:'',geneticId:'',stage:'Vegetativo fuerte',week:1,date:new Date().toISOString().slice(0,10),temp:24,humidity:65,ppfd:0,volumeApplied:0,drainPercent:0,ecInput:0,ecDrain:0,phInput:0,phDrain:0,n:0,p:0,k:0,ca:0,mg:0,s:0,diagnosis:''}

export default function MirfeMonitoringPage(){
 const {state,execute}=useIrrigationMirfeCommandStore()
 const [form,setForm]=useState({...empty,siteId:state.sites[0]?.id||'',houseId:state.houses[0]?.id||'',geneticId:state.genetics[0]?.id||''})
 const[msg,setMsg]=useState('')
 const siteHouses=state.houses.filter(h=>h.siteId===form.siteId)
 const beds=state.beds.filter(x=>x.houseId===form.houseId)
 const hasSites=state.sites.length>0,hasHouses=state.houses.length>0,hasGenetics=state.genetics.length>0
 const prerequisitesReady=hasSites&&hasHouses&&hasGenetics
 const canSave=prerequisitesReady&&Boolean(form.siteId&&form.houseId&&form.geneticId&&form.diagnosis.trim())
 const missingConfiguration=[!hasSites?'una sede':!hasHouses?'una nave':!hasGenetics?'una genética':''].filter(Boolean).join(', ')
 async function save(e){
  e.preventDefault();if(!canSave)return
  try{
   await execute({operation:IRRIGATION_MIRFE_OPERATIONS.RECORD_MIRFE_MONITORING,input:form})
   setMsg('Monitoreo MIRFE registrado correctamente.')
   setForm(current=>({...empty,siteId:current.siteId,houseId:current.houseId,geneticId:current.geneticId,date:new Date().toISOString().slice(0,10)}))
  }catch(error){setMsg(error.message)}
 }
 return <>
  <PageHeader title="Monitoreo integral MIRFE" subtitle="Registra evidencia inmutable del contexto, ambiente, riego, drenaje, solución nutritiva y diagnóstico."/>
  <Card title="Nuevo monitoreo">
   {!prerequisitesReady&&<StateMessage type="error" title="Configuración incompleta" message={`Para registrar monitoreos MIRFE primero configura ${missingConfiguration}.`}/>} 
   <form id="mirfe-monitoring-new" data-module="Monitoreo MIRFE" data-record-id="new-monitoring" className="stacked-form" onSubmit={save}>
    <ValidationMessage type="info">El command boundary recalcula VPD y ΔEC, conserva actor/tiempo y publica el registro al Ledger/Timeline.</ValidationMessage>
    {msg&&<ValidationMessage type={msg.includes('correctamente')?'success':'error'}>{msg}</ValidationMessage>}
    <section className="form-section"><h4>1. Contexto del cultivo</h4><div className="form-grid">
     <Field label="Sede"><select disabled={!hasSites} value={form.siteId} onChange={e=>{const siteId=e.target.value,houseId=state.houses.find(h=>h.siteId===siteId)?.id||'';setForm({...form,siteId,houseId,bedId:''})}}><option value="">Seleccionar sede</option>{state.sites.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
     <Field label="Nave"><select disabled={!hasHouses||!form.siteId} value={form.houseId} onChange={e=>setForm({...form,houseId:e.target.value,bedId:''})}><option value="">Seleccionar nave</option>{siteHouses.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
     <Field label="Cama / bloque"><select disabled={!form.houseId} value={form.bedId} onChange={e=>setForm({...form,bedId:e.target.value})}><option value="">Toda la nave</option>{beds.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
     <Field label="Genética"><select disabled={!hasGenetics} value={form.geneticId} onChange={e=>setForm({...form,geneticId:e.target.value})}><option value="">Seleccionar genética</option>{state.genetics.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
     <Field label="Etapa"><select value={form.stage} onChange={e=>setForm({...form,stage:e.target.value})}>{['Clones/enraizamiento','Vegetativo temprano','Vegetativo fuerte','Madres','Floración inicial','Floración media','Floración final'].map(x=><option key={x}>{x}</option>)}</select></Field>
     <Field label="Semana"><input type="number" min="1" value={form.week} onChange={e=>setForm({...form,week:Number(e.target.value)})}/></Field>
     <Field label="Fecha"><input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></Field>
    </div></section>
    <section className="form-section"><h4>2. Ambiente e iluminación</h4><div className="form-grid"><Field label="Temperatura °C"><input type="number" step=".1" value={form.temp} onChange={e=>setForm({...form,temp:Number(e.target.value)})}/></Field><Field label="Humedad relativa %"><input type="number" min="0" max="100" step=".1" value={form.humidity} onChange={e=>setForm({...form,humidity:Number(e.target.value)})}/></Field><Field label="PPFD"><input type="number" min="0" value={form.ppfd} onChange={e=>setForm({...form,ppfd:Number(e.target.value)})}/></Field><div className="calculated-field"><span>VPD calculado</span><strong>{calculateVpd(form.temp,form.humidity).toFixed(2)} kPa</strong></div></div></section>
    <section className="form-section"><h4>3. Riego, drenaje y solución</h4><div className="form-grid"><Field label="Volumen aplicado L"><input type="number" min="0" step=".1" value={form.volumeApplied} onChange={e=>setForm({...form,volumeApplied:Number(e.target.value)})}/></Field><Field label="Drenaje %"><input type="number" min="0" step=".1" value={form.drainPercent} onChange={e=>setForm({...form,drainPercent:Number(e.target.value)})}/></Field><Field label="EC entrada"><input type="number" min="0" step=".01" value={form.ecInput} onChange={e=>setForm({...form,ecInput:Number(e.target.value)})}/></Field><Field label="EC drenaje"><input type="number" min="0" step=".01" value={form.ecDrain} onChange={e=>setForm({...form,ecDrain:Number(e.target.value)})}/></Field><Field label="pH entrada"><input type="number" min="0" step=".01" value={form.phInput} onChange={e=>setForm({...form,phInput:Number(e.target.value)})}/></Field><Field label="pH drenaje"><input type="number" min="0" step=".01" value={form.phDrain} onChange={e=>setForm({...form,phDrain:Number(e.target.value)})}/></Field><div className="calculated-field"><span>ΔEC calculado</span><strong className={Math.abs(deltaEc(form.ecInput,form.ecDrain))>=.5?'warn':'ok'}>{deltaEc(form.ecInput,form.ecDrain).toFixed(2)}</strong></div></div></section>
    <section className="form-section"><h4>4. Nutrición observada / analizada</h4><div className="form-grid nutrient-grid">{['n','p','k','ca','mg','s'].map(key=><Field key={key} label={`${key.toUpperCase()} ppm`}><input type="number" min="0" value={form[key]} onChange={e=>setForm({...form,[key]:Number(e.target.value)})}/></Field>)}</div></section>
    <section className="form-section"><h4>5. Diagnóstico y decisión</h4><div className="form-grid one"><Field label="Diagnóstico / acción sugerida"><textarea required value={form.diagnosis} onChange={e=>setForm({...form,diagnosis:e.target.value})}/></Field></div></section>
    <FormActions><button className="button primary" disabled={!canSave}>Guardar monitoreo</button></FormActions>
   </form>
  </Card>
  <Card title="Registros recientes">{!state.mirfeMonitoring.length?<StateMessage title="No hay monitoreos registrados" message="Registra la primera lectura MIRFE para empezar a comparar ambiente, drenaje, EC, nutrición y diagnóstico por nave y genética."/>:<div className="table-scroll"><table><thead><tr><th>Fecha</th><th>Nave</th><th>Genética</th><th>Etapa</th><th>VPD</th><th>Drenaje</th><th>EC entrada</th><th>EC drenaje</th><th>ΔEC</th><th>Diagnóstico</th></tr></thead><tbody>{[...state.mirfeMonitoring].reverse().map(x=><tr key={x.id}><td>{x.date}</td><td>{state.houses.find(h=>h.id===x.houseId)?.name}</td><td>{state.genetics.find(g=>g.id===x.geneticId)?.name}</td><td>{x.stage}</td><td>{Number(x.vpd).toFixed(2)}</td><td>{x.drainPercent}%</td><td>{x.ecInput}</td><td>{x.ecDrain}</td><td className={Math.abs(x.deltaEc)>=.5?'warn':'ok'}>{Number(x.deltaEc).toFixed(2)}</td><td>{x.diagnosis||'—'}</td></tr>)}</tbody></table></div>}</Card>
 </>
}
