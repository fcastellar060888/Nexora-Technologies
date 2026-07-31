import{useMemo,useState}from'react'
import Card from'../components/Card'
import Field from'../components/Field'
import PageHeader from'../components/PageHeader'
import{FormActions,ValidationMessage}from'../components/forms/FormKit.jsx'
import{hydraulics,stages,waterForSite}from'../domain/irrigation'
import{useStore}from'../services/store'

export default function IrrigationPlanPage(){
 const{state,update}=useStore()
 const[form,setForm]=useState({siteId:state.sites[0]?.id||'',houseId:'',geneticId:state.genetics[0]?.id||'',stage:'Vegetativo fuerte',apps:6,minutes:5,tank:1000})
 const[msg,setMsg]=useState('')
 const houses=state.houses.filter(x=>x.siteId===form.siteId)
 const latest=state.irrigationPlans.at(-1)
 const selectedBeds=useMemo(()=>state.beds.filter(b=>b.houseId===form.houseId&&(!form.geneticId||b.geneticId===form.geneticId)),[state.beds,form.houseId,form.geneticId])
 function calculate(e){
  e.preventDefault()
  if(!form.siteId||!form.houseId)return setMsg('Selecciona la sede y la nave.')
  if(Number(form.apps)<=0||Number(form.minutes)<=0||Number(form.tank)<=0)return setMsg('Aplicaciones, minutos y capacidad del tanque deben ser mayores que cero.')
  if(!selectedBeds.length)return setMsg('No hay camas configuradas para la nave y genética seleccionadas.')
  const rows=selectedBeds.map(b=>({...b,drippers:b.drippers||1,flow:b.flow||2}))
  const result=hydraulics(rows,form.apps,form.minutes,form.tank)
  const water=waterForSite(state,form.siteId)
  const record={id:crypto.randomUUID(),date:new Date().toISOString().slice(0,10),...form,...result,waterStatus:water?'Vigente':'Pendiente'}
  update(s=>({...s,irrigationPlans:[...s.irrigationPlans,record]}),{module:'Riego',action:'Crear plan diario',detail:record.id})
  setMsg(`Plan guardado: ${result.daily.toFixed(1)} L diarios en ${result.loads} carga(s).`)
 }
 return <>
  <PageHeader title="Plan diario de riego" subtitle="Calcula plantas, caudal, litros por pulso, consumo diario y cargas máximas del tanque."/>
  <div className="content-grid two">
   <Card title="Parámetros del plan">
    <form id="irrigation-plan-new" data-module="Plan diario de riego" data-record-id="new-plan" className="form-grid one" onSubmit={calculate}>
     {msg&&<ValidationMessage type={msg.startsWith('Plan guardado')?'success':'error'}>{msg}</ValidationMessage>}
     <Field label="Sede"><select required value={form.siteId} onChange={e=>setForm({...form,siteId:e.target.value,houseId:''})}><option value="">Selecciona una sede</option>{state.sites.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
     <Field label="Nave"><select required value={form.houseId} onChange={e=>setForm({...form,houseId:e.target.value})}><option value="">Selecciona una nave</option>{houses.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
     <Field label="Genética"><select value={form.geneticId} onChange={e=>setForm({...form,geneticId:e.target.value})}><option value="">Todas las genéticas</option>{state.genetics.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
     <Field label="Etapa"><select value={form.stage} onChange={e=>setForm({...form,stage:e.target.value})}>{stages.map(x=><option key={x}>{x}</option>)}</select></Field>
     <Field label="Aplicaciones por día"><input min="1" type="number" value={form.apps} onChange={e=>setForm({...form,apps:Number(e.target.value)})}/></Field>
     <Field label="Minutos por aplicación"><input min="0.1" step=".1" type="number" value={form.minutes} onChange={e=>setForm({...form,minutes:Number(e.target.value)})}/></Field>
     <Field label="Capacidad del tanque (L)"><input min="1" type="number" value={form.tank} onChange={e=>setForm({...form,tank:Number(e.target.value)})}/></Field>
     <ValidationMessage type="info">Camas incluidas en el cálculo: {selectedBeds.length}.</ValidationMessage>
     <FormActions><button type="button" className="button secondary" onClick={()=>setForm({...form,houseId:'',apps:6,minutes:5,tank:1000})}>Restablecer</button><button className="button primary">Calcular y guardar</button></FormActions>
    </form>
   </Card>
   <Card title="Último resultado">{latest?<div className="detail-grid"><div><span>Plantas</span><strong>{latest.plants}</strong></div><div><span>Litros por pulso</span><strong>{latest.pulse.toFixed(1)} L</strong></div><div><span>Litros por día</span><strong>{latest.daily.toFixed(1)} L</strong></div><div><span>Cargas requeridas</span><strong>{latest.loads}</strong></div><div><span>Última carga</span><strong>{latest.last.toFixed(1)} L</strong></div><div><span>Análisis de agua</span><strong className={latest.waterStatus==='Vigente'?'ok':'warn'}>{latest.waterStatus}</strong></div></div>:<p className="muted">Todavía no hay cálculos guardados.</p>}</Card>
  </div>
 </>
}
