import { useState } from 'react'
import Card from '../components/Card'
import Field from '../components/Field'
import PageHeader from '../components/PageHeader'
import { mirfeCategories } from '../domain/mirfe'
import { useStore } from '../services/store'

export default function MirfeProgramsPage(){
 const {state,update}=useStore()
 const [form,setForm]=useState({name:'',category:'Nutrición',geneticId:'Todos',stage:'Floración media',triggerVariable:'',triggerOperator:'>',triggerValue:0,targetValue:0,objective:'',reviewHours:72,active:true})
 function add(e){e.preventDefault();if(!form.name)return;update(s=>({...s,mirfePrograms:[...s.mirfePrograms,{id:crypto.randomUUID(),...form}]}));setForm({...form,name:'',objective:''})}
 return <>
  <PageHeader title="Programas y objetivos MIRFE" subtitle="Define reglas por genética, etapa, variable disparadora, meta y tiempo de verificación."/>
  <Card title="Nuevo programa"><form className="form-grid" onSubmit={add}>
   <Field label="Nombre del programa"><input value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></Field>
   <Field label="Categoría"><select value={form.category} onChange={e=>setForm({...form,category:e.target.value})}>{mirfeCategories.map(x=><option key={x}>{x}</option>)}</select></Field>
   <Field label="Genética"><select value={form.geneticId} onChange={e=>setForm({...form,geneticId:e.target.value})}><option value="Todos">Todas</option>{state.genetics.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
   <Field label="Etapa"><select value={form.stage} onChange={e=>setForm({...form,stage:e.target.value})}>{['Clones/enraizamiento','Vegetativo temprano','Vegetativo fuerte','Madres','Floración inicial','Floración media','Floración final'].map(x=><option key={x}>{x}</option>)}</select></Field>
   <Field label="Variable disparadora"><input placeholder="Ej. ΔEC, drenaje %, Ca ppm" value={form.triggerVariable} onChange={e=>setForm({...form,triggerVariable:e.target.value})}/></Field>
   <Field label="Operador"><select value={form.triggerOperator} onChange={e=>setForm({...form,triggerOperator:e.target.value})}><option>&gt;</option><option>&lt;</option><option>=</option><option>fuera de rango</option></select></Field>
   <Field label="Valor disparador"><input type="number" step=".01" value={form.triggerValue} onChange={e=>setForm({...form,triggerValue:Number(e.target.value)})}/></Field>
   <Field label="Meta esperada"><input type="number" step=".01" value={form.targetValue} onChange={e=>setForm({...form,targetValue:Number(e.target.value)})}/></Field>
   <Field label="Revisión después de horas"><input type="number" value={form.reviewHours} onChange={e=>setForm({...form,reviewHours:Number(e.target.value)})}/></Field>
   <Field label="Objetivo agronómico"><textarea value={form.objective} onChange={e=>setForm({...form,objective:e.target.value})}/></Field>
   <div className="form-actions"><button className="button primary">Guardar programa</button></div>
  </form></Card>
  <Card title="Programas activos"><div className="table-scroll"><table><thead><tr><th>Programa</th><th>Categoría</th><th>Genética</th><th>Etapa</th><th>Disparador</th><th>Meta</th><th>Revisión</th></tr></thead><tbody>
   {state.mirfePrograms.map(x=><tr key={x.id}><td>{x.name}</td><td>{x.category}</td><td>{x.geneticId==='Todos'?'Todas':state.genetics.find(g=>g.id===x.geneticId)?.name}</td><td>{x.stage}</td><td>{x.triggerVariable} {x.triggerOperator} {x.triggerValue}</td><td>{x.targetValue}</td><td>{x.reviewHours} h</td></tr>)}
  </tbody></table></div></Card>
 </>
}
