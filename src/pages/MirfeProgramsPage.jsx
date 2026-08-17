import { useState } from 'react'
import Card from '../components/Card'
import Field from '../components/Field'
import PageHeader from '../components/PageHeader'
import StateMessage from '../components/StateMessage'
import {FormActions,ValidationMessage} from '../components/forms/FormKit.jsx'
import { mirfeCategories } from '../domain/mirfe'
import {IRRIGATION_MIRFE_OPERATIONS,useIrrigationMirfeCommandStore} from '../services/irrigationMirfeCommandStore'

export default function MirfeProgramsPage(){
 const {state,execute}=useIrrigationMirfeCommandStore()
 const [form,setForm]=useState({name:'',category:'Nutrición',geneticId:'Todos',stage:'Floración media',triggerVariable:'',triggerOperator:'>',triggerValue:0,targetValue:0,objective:'',reviewHours:72,active:true})
 const[msg,setMsg]=useState('')
 async function add(e){
  e.preventDefault();setMsg('')
  try{
   await execute({operation:IRRIGATION_MIRFE_OPERATIONS.CREATE_MIRFE_PROGRAM,input:form})
   setMsg('Programa MIRFE guardado correctamente.')
   setForm(current=>({...current,name:'',triggerVariable:'',triggerValue:0,targetValue:0,objective:''}))
  }catch(error){setMsg(error.message)}
 }
 return <>
  <PageHeader title="Programas y objetivos MIRFE" subtitle="Define reglas tenant-aware por genética, etapa, variable disparadora, meta y tiempo de verificación."/>
  <Card title="Nuevo programa"><form id="mirfe-program-new" data-module="Programa MIRFE" data-record-id="new-program" className="stacked-form" onSubmit={add}>
   {msg&&<ValidationMessage type={msg.includes('correctamente')?'success':'error'}>{msg}</ValidationMessage>}
   <section className="form-section"><h4>1. Alcance del programa</h4><div className="form-grid">
    <Field label="Nombre del programa"><input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></Field>
    <Field label="Categoría"><select value={form.category} onChange={e=>setForm({...form,category:e.target.value})}>{mirfeCategories.map(x=><option key={x}>{x}</option>)}</select></Field>
    <Field label="Genética"><select value={form.geneticId} onChange={e=>setForm({...form,geneticId:e.target.value})}><option value="Todos">Todas</option>{state.genetics.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
    <Field label="Etapa"><select value={form.stage} onChange={e=>setForm({...form,stage:e.target.value})}>{['Clones/enraizamiento','Vegetativo temprano','Vegetativo fuerte','Madres','Floración inicial','Floración media','Floración final'].map(x=><option key={x}>{x}</option>)}</select></Field>
   </div></section>
   <section className="form-section"><h4>2. Regla de activación y meta</h4><div className="form-grid">
    <Field label="Variable disparadora"><input placeholder="Ej. ΔEC, drenaje %, Ca ppm" value={form.triggerVariable} onChange={e=>setForm({...form,triggerVariable:e.target.value})}/></Field>
    <Field label="Condición"><select value={form.triggerOperator} onChange={e=>setForm({...form,triggerOperator:e.target.value})}><option>&gt;</option><option>&lt;</option><option>=</option><option>fuera de rango</option></select></Field>
    <Field label="Valor disparador"><input type="number" step=".01" value={form.triggerValue} onChange={e=>setForm({...form,triggerValue:Number(e.target.value)})}/></Field>
    <Field label="Meta esperada"><input type="number" step=".01" value={form.targetValue} onChange={e=>setForm({...form,targetValue:Number(e.target.value)})}/></Field>
    <Field label="Horas hasta la revisión"><input type="number" min="1" value={form.reviewHours} onChange={e=>setForm({...form,reviewHours:Number(e.target.value)})}/></Field>
   </div></section>
   <section className="form-section"><h4>3. Objetivo agronómico</h4><div className="form-grid one"><Field label="Objetivo y criterio de éxito"><textarea required value={form.objective} onChange={e=>setForm({...form,objective:e.target.value})}/></Field></div></section>
   <FormActions><button className="button primary">Guardar programa</button></FormActions>
  </form></Card>
  <Card title="Programas activos">{!state.mirfePrograms.length?<StateMessage title="No hay programas MIRFE configurados" message="Crea el primer programa para definir reglas de activación, metas agronómicas y tiempos de verificación por etapa o genética."/>:<div className="table-scroll"><table><thead><tr><th>Programa</th><th>Categoría</th><th>Genética</th><th>Etapa</th><th>Disparador</th><th>Meta</th><th>Revisión</th><th>Estado</th></tr></thead><tbody>{state.mirfePrograms.map(x=><tr key={x.id}><td>{x.name}</td><td>{x.category}</td><td>{x.geneticId==='Todos'?'Todas':state.genetics.find(g=>g.id===x.geneticId)?.name}</td><td>{x.stage}</td><td>{x.triggerVariable} {x.triggerOperator} {x.triggerValue}</td><td>{x.targetValue}</td><td>{x.reviewHours} h</td><td>{x.status||'ACTIVE'}</td></tr>)}</tbody></table></div>}</Card>
 </>
}
