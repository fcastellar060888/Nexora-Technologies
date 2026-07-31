import { useState } from 'react'
import Card from '../components/Card'
import Field from '../components/Field'
import PageHeader from '../components/PageHeader'
import { mirfeCategories, mirfeStatuses, quantityFromDose } from '../domain/mirfe'
import { useStore } from '../services/store'

export default function MirfeReinforcementsPage(){
 const {state,update}=useStore()
 const [form,setForm]=useState({monitoringId:'',programId:'',siteId:state.sites[0]?.id||'',houseId:state.houses[0]?.id||'',bedId:'',geneticId:state.genetics[0]?.id||'',stage:'Floración media',week:1,category:'Nutrición',reason:'',triggerVariable:'',observedValue:0,targetValue:0,productId:'',objective:'',dose:0,doseUnit:'mL/L',volumePrepared:0,route:'Riego',ecBefore:0,ecAfter:0,phBefore:0,phAfter:0,responsible:'',status:'Pendiente aprobación',nextReview:'',notes:''})
 const beds=state.beds.filter(x=>x.houseId===form.houseId)
 function save(e){
   e.preventDefault()
   const quantity=quantityFromDose(form.dose,form.doseUnit,form.volumePrepared)
   update(s=>({...s,mirfeReinforcements:[...s.mirfeReinforcements,{id:crypto.randomUUID(),date:new Date().toISOString().slice(0,10),quantityApplied:quantity,result:'',...form}]}))
 }
 return <>
  <PageHeader title="Refuerzos y órdenes MIRFE" subtitle="Toda intervención queda ligada a una causa, una meta, una dosis, una orden y una próxima revisión."/>
  <Card title="Nuevo refuerzo"><form className="form-grid" onSubmit={save}>
   <Field label="Programa"><select value={form.programId} onChange={e=>{const p=state.mirfePrograms.find(x=>x.id===e.target.value);setForm({...form,programId:e.target.value,category:p?.category||form.category,geneticId:p?.geneticId==='Todos'?form.geneticId:p?.geneticId||form.geneticId,stage:p?.stage||form.stage,triggerVariable:p?.triggerVariable||'',targetValue:p?.targetValue||0,objective:p?.objective||''})}}><option value="">Sin programa</option>{state.mirfePrograms.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
   <Field label="Monitoreo origen"><select value={form.monitoringId} onChange={e=>{const m=state.mirfeMonitoring.find(x=>x.id===e.target.value);setForm({...form,monitoringId:e.target.value,siteId:m?.siteId||form.siteId,houseId:m?.houseId||form.houseId,bedId:m?.bedId||'',geneticId:m?.geneticId||form.geneticId,stage:m?.stage||form.stage,week:m?.week||form.week,ecBefore:m?.ecInput||0,phBefore:m?.phInput||0})}}><option value="">Sin monitoreo</option>{state.mirfeMonitoring.map(x=><option key={x.id} value={x.id}>{x.date} · {state.houses.find(h=>h.id===x.houseId)?.name}</option>)}</select></Field>
   <Field label="Sede"><select value={form.siteId} onChange={e=>setForm({...form,siteId:e.target.value})}>{state.sites.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
   <Field label="Nave"><select value={form.houseId} onChange={e=>setForm({...form,houseId:e.target.value,bedId:''})}>{state.houses.filter(x=>x.siteId===form.siteId).map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
   <Field label="Cama / bloque"><select value={form.bedId} onChange={e=>setForm({...form,bedId:e.target.value})}><option value="">Toda la nave</option>{beds.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
   <Field label="Genética"><select value={form.geneticId} onChange={e=>setForm({...form,geneticId:e.target.value})}>{state.genetics.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
   <Field label="Etapa"><input value={form.stage} onChange={e=>setForm({...form,stage:e.target.value})}/></Field>
   <Field label="Semana"><input type="number" value={form.week} onChange={e=>setForm({...form,week:Number(e.target.value)})}/></Field>
   <Field label="Categoría"><select value={form.category} onChange={e=>setForm({...form,category:e.target.value})}>{mirfeCategories.map(x=><option key={x}>{x}</option>)}</select></Field>
   <Field label="Motivo / diagnóstico"><input value={form.reason} onChange={e=>setForm({...form,reason:e.target.value})}/></Field>
   <Field label="Variable disparadora"><input value={form.triggerVariable} onChange={e=>setForm({...form,triggerVariable:e.target.value})}/></Field>
   <Field label="Valor observado"><input type="number" step=".01" value={form.observedValue} onChange={e=>setForm({...form,observedValue:Number(e.target.value)})}/></Field>
   <Field label="Meta esperada"><input type="number" step=".01" value={form.targetValue} onChange={e=>setForm({...form,targetValue:Number(e.target.value)})}/></Field>
   <Field label="Producto / insumo"><select value={form.productId} onChange={e=>setForm({...form,productId:e.target.value})}><option value="">Seleccionar</option>{state.products.filter(x=>['MIRFE','Fertilizante','Adyuvante','Corrector pH'].includes(x.category)).map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
   <Field label="Objetivo del refuerzo"><textarea value={form.objective} onChange={e=>setForm({...form,objective:e.target.value})}/></Field>
   <Field label="Dosis"><input type="number" step=".01" value={form.dose} onChange={e=>setForm({...form,dose:Number(e.target.value)})}/></Field>
   <Field label="Unidad dosis"><select value={form.doseUnit} onChange={e=>setForm({...form,doseUnit:e.target.value})}><option>mL/L</option><option>g/L</option><option>mL/100 L</option><option>g/100 L</option></select></Field>
   <Field label="Volumen preparado L"><input type="number" step=".1" value={form.volumePrepared} onChange={e=>setForm({...form,volumePrepared:Number(e.target.value)})}/></Field>
   <Field label="Vía"><select value={form.route} onChange={e=>setForm({...form,route:e.target.value})}><option>Riego</option><option>Foliar</option><option>Drench</option><option>Inyección</option><option>Otra</option></select></Field>
   <Field label="EC antes"><input type="number" step=".01" value={form.ecBefore} onChange={e=>setForm({...form,ecBefore:Number(e.target.value)})}/></Field>
   <Field label="pH antes"><input type="number" step=".01" value={form.phBefore} onChange={e=>setForm({...form,phBefore:Number(e.target.value)})}/></Field>
   <Field label="Responsable"><input value={form.responsible} onChange={e=>setForm({...form,responsible:e.target.value})}/></Field>
   <Field label="Estado"><select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>{mirfeStatuses.map(x=><option key={x}>{x}</option>)}</select></Field>
   <Field label="Próxima revisión"><input type="date" value={form.nextReview} onChange={e=>setForm({...form,nextReview:e.target.value})}/></Field>
   <Field label="Observaciones"><textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></Field>
   <div className="form-actions"><button className="button primary">Crear orden MIRFE</button></div>
  </form></Card>
  <Card title="Órdenes y refuerzos"><div className="table-scroll"><table><thead><tr><th>Fecha</th><th>Ubicación</th><th>Genética</th><th>Categoría</th><th>Motivo</th><th>Producto</th><th>Cantidad</th><th>Vía</th><th>Estado</th><th>Revisión</th></tr></thead><tbody>
   {[...state.mirfeReinforcements].reverse().map(x=><tr key={x.id}><td>{x.date}</td><td>{state.sites.find(s=>s.id===x.siteId)?.name} · {state.houses.find(h=>h.id===x.houseId)?.name}</td><td>{state.genetics.find(g=>g.id===x.geneticId)?.name}</td><td>{x.category}</td><td>{x.reason}</td><td>{state.products.find(p=>p.id===x.productId)?.name||'—'}</td><td>{Number(x.quantityApplied).toFixed(2)} {x.doseUnit.startsWith('mL')?'mL':'g'}</td><td>{x.route}</td><td>{x.status}</td><td>{x.nextReview||'—'}</td></tr>)}
  </tbody></table></div></Card>
 </>
}
