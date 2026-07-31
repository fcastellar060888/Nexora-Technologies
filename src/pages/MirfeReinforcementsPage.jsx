import {useMemo,useState} from'react'
import Card from'../components/Card'
import Field from'../components/Field'
import PageHeader from'../components/PageHeader'
import{FormActions,ValidationMessage}from'../components/forms/FormKit.jsx'
import{mirfeCategories,mirfeStatuses,quantityFromDose}from'../domain/mirfe'
import{useStore}from'../services/store'

const initialForm=state=>({monitoringId:'',programId:'',siteId:state.sites[0]?.id||'',houseId:state.houses[0]?.id||'',bedId:'',geneticId:state.genetics[0]?.id||'',stage:'Floración media',week:1,category:'Nutrición',reason:'',triggerVariable:'',observedValue:0,targetValue:0,productId:'',objective:'',dose:0,doseUnit:'mL/L',volumePrepared:0,route:'Riego',ecBefore:0,ecAfter:0,phBefore:0,phAfter:0,responsible:'',status:'Pendiente aprobación',nextReview:'',notes:''})

export default function MirfeReinforcementsPage(){
 const{state,update}=useStore()
 const[form,setForm]=useState(()=>initialForm(state))
 const[msg,setMsg]=useState('')
 const beds=state.beds.filter(x=>x.houseId===form.houseId)
 const products=useMemo(()=>state.products.filter(x=>['MIRFE','Fertilizante','Adyuvante','Corrector pH'].includes(x.category)),[state.products])
 const quantity=quantityFromDose(form.dose,form.doseUnit,form.volumePrepared)
 const quantityUnit=form.doseUnit.startsWith('mL')?'mL':'g'

 function save(e){
  e.preventDefault()
  if(!form.siteId||!form.houseId)return setMsg('Selecciona la sede y la nave.')
  if(!form.reason.trim())return setMsg('El motivo o diagnóstico es obligatorio.')
  if(!form.productId)return setMsg('Selecciona el producto o insumo.')
  if(Number(form.dose)<=0||Number(form.volumePrepared)<=0)return setMsg('La dosis y el volumen preparado deben ser mayores que cero.')
  const record={id:crypto.randomUUID(),date:new Date().toISOString().slice(0,10),quantityApplied:quantity,result:'',...form,reason:form.reason.trim(),objective:form.objective.trim(),notes:form.notes.trim()}
  update(s=>({...s,mirfeReinforcements:[...s.mirfeReinforcements,record]}),{module:'MIRFE',action:'Crear orden de refuerzo',detail:record.id})
  setMsg(`Orden MIRFE creada. Cantidad calculada: ${quantity.toFixed(2)} ${quantityUnit}.`)
  setForm(current=>({...initialForm(state),siteId:current.siteId,houseId:current.houseId,geneticId:current.geneticId,responsible:current.responsible}))
 }

 function selectProgram(value){
  const program=state.mirfePrograms.find(x=>x.id===value)
  setForm(current=>({...current,programId:value,category:program?.category||current.category,geneticId:program?.geneticId==='Todos'?current.geneticId:program?.geneticId||current.geneticId,stage:program?.stage||current.stage,triggerVariable:program?.triggerVariable||'',targetValue:program?.targetValue||0,objective:program?.objective||''}))
 }
 function selectMonitoring(value){
  const monitoring=state.mirfeMonitoring.find(x=>x.id===value)
  setForm(current=>({...current,monitoringId:value,siteId:monitoring?.siteId||current.siteId,houseId:monitoring?.houseId||current.houseId,bedId:monitoring?.bedId||'',geneticId:monitoring?.geneticId||current.geneticId,stage:monitoring?.stage||current.stage,week:monitoring?.week||current.week,ecBefore:monitoring?.ecInput||0,phBefore:monitoring?.phInput||0}))
 }

 return <>
  <PageHeader title="Refuerzos y órdenes MIRFE" subtitle="Define el origen, la causa, la formulación, los controles y la revisión de cada intervención."/>
  <Card title="Nueva orden de refuerzo">
   <form id="mirfe-reinforcement-new" data-module="Orden de refuerzo MIRFE" data-record-id="new-reinforcement" className="stacked-form" onSubmit={save}>
    {msg&&<ValidationMessage type={msg.startsWith('Orden')?'success':'error'}>{msg}</ValidationMessage>}

    <section className="form-section"><h4>1. Origen de la decisión</h4><div className="form-grid two">
     <Field label="Programa MIRFE"><select value={form.programId} onChange={e=>selectProgram(e.target.value)}><option value="">Sin programa asociado</option>{state.mirfePrograms.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
     <Field label="Monitoreo de origen"><select value={form.monitoringId} onChange={e=>selectMonitoring(e.target.value)}><option value="">Sin monitoreo asociado</option>{state.mirfeMonitoring.map(x=><option key={x.id} value={x.id}>{x.date} · {state.houses.find(h=>h.id===x.houseId)?.name||'Sin nave'}</option>)}</select></Field>
    </div></section>

    <section className="form-section"><h4>2. Ubicación y contexto del cultivo</h4><div className="form-grid four">
     <Field label="Sede"><select required value={form.siteId} onChange={e=>setForm({...form,siteId:e.target.value,houseId:'',bedId:''})}><option value="">Selecciona</option>{state.sites.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
     <Field label="Nave"><select required value={form.houseId} onChange={e=>setForm({...form,houseId:e.target.value,bedId:''})}><option value="">Selecciona</option>{state.houses.filter(x=>x.siteId===form.siteId).map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
     <Field label="Cama o bloque"><select value={form.bedId} onChange={e=>setForm({...form,bedId:e.target.value})}><option value="">Toda la nave</option>{beds.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
     <Field label="Genética"><select value={form.geneticId} onChange={e=>setForm({...form,geneticId:e.target.value})}><option value="">Selecciona</option>{state.genetics.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
     <Field label="Etapa"><input value={form.stage} onChange={e=>setForm({...form,stage:e.target.value})}/></Field>
     <Field label="Semana"><input type="number" min="1" value={form.week} onChange={e=>setForm({...form,week:Number(e.target.value)})}/></Field>
     <Field label="Categoría"><select value={form.category} onChange={e=>setForm({...form,category:e.target.value})}>{mirfeCategories.map(x=><option key={x}>{x}</option>)}</select></Field>
    </div></section>

    <section className="form-section"><h4>3. Diagnóstico y meta</h4><div className="form-grid four">
     <Field label="Motivo o diagnóstico" className="full"><input required value={form.reason} onChange={e=>setForm({...form,reason:e.target.value})}/></Field>
     <Field label="Variable disparadora"><input value={form.triggerVariable} onChange={e=>setForm({...form,triggerVariable:e.target.value})}/></Field>
     <Field label="Valor observado"><input type="number" step=".01" value={form.observedValue} onChange={e=>setForm({...form,observedValue:Number(e.target.value)})}/></Field>
     <Field label="Meta esperada"><input type="number" step=".01" value={form.targetValue} onChange={e=>setForm({...form,targetValue:Number(e.target.value)})}/></Field>
     <Field label="Objetivo agronómico" className="full"><textarea value={form.objective} onChange={e=>setForm({...form,objective:e.target.value})}/></Field>
    </div></section>

    <section className="form-section"><h4>4. Formulación y aplicación</h4><div className="form-grid four">
     <Field label="Producto o insumo"><select required value={form.productId} onChange={e=>setForm({...form,productId:e.target.value})}><option value="">Selecciona</option>{products.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
     <Field label="Dosis"><input required type="number" min="0" step=".01" value={form.dose} onChange={e=>setForm({...form,dose:Number(e.target.value)})}/></Field>
     <Field label="Unidad de dosis"><select value={form.doseUnit} onChange={e=>setForm({...form,doseUnit:e.target.value})}><option>mL/L</option><option>g/L</option><option>mL/100 L</option><option>g/100 L</option></select></Field>
     <Field label="Volumen preparado (L)"><input required type="number" min="0" step=".1" value={form.volumePrepared} onChange={e=>setForm({...form,volumePrepared:Number(e.target.value)})}/></Field>
     <Field label="Vía de aplicación"><select value={form.route} onChange={e=>setForm({...form,route:e.target.value})}><option>Riego</option><option>Foliar</option><option value="Drench">Aplicación al sustrato</option><option>Inyección</option><option>Otra</option></select></Field>
     <div className="calculated-field"><span>Cantidad calculada</span><strong>{quantity.toFixed(2)} {quantityUnit}</strong></div>
    </div></section>

    <section className="form-section"><h4>5. Control, responsabilidad y seguimiento</h4><div className="form-grid four">
     <Field label="EC antes"><input type="number" step=".01" value={form.ecBefore} onChange={e=>setForm({...form,ecBefore:Number(e.target.value)})}/></Field>
     <Field label="pH antes"><input type="number" step=".01" value={form.phBefore} onChange={e=>setForm({...form,phBefore:Number(e.target.value)})}/></Field>
     <Field label="Responsable"><input value={form.responsible} onChange={e=>setForm({...form,responsible:e.target.value})}/></Field>
     <Field label="Estado de la orden"><select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>{mirfeStatuses.map(x=><option key={x}>{x}</option>)}</select></Field>
     <Field label="Próxima revisión"><input type="date" value={form.nextReview} onChange={e=>setForm({...form,nextReview:e.target.value})}/></Field>
     <Field label="Observaciones" className="full"><textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></Field>
    </div></section>

    <FormActions><button type="button" className="button secondary" onClick={()=>{setForm(initialForm(state));setMsg('')}}>Limpiar</button><button className="button primary">Crear orden MIRFE</button></FormActions>
   </form>
  </Card>

  <Card title="Órdenes y refuerzos"><div className="table-scroll"><table><thead><tr><th>Fecha</th><th>Ubicación</th><th>Genética</th><th>Categoría</th><th>Motivo</th><th>Producto</th><th>Cantidad</th><th>Vía</th><th>Estado</th><th>Próxima revisión</th></tr></thead><tbody>
   {[...state.mirfeReinforcements].reverse().map(x=><tr key={x.id}><td>{x.date}</td><td>{state.sites.find(s=>s.id===x.siteId)?.name||'—'} · {state.houses.find(h=>h.id===x.houseId)?.name||'—'}</td><td>{state.genetics.find(g=>g.id===x.geneticId)?.name||'—'}</td><td>{x.category}</td><td>{x.reason||'—'}</td><td>{state.products.find(p=>p.id===x.productId)?.name||'—'}</td><td>{Number(x.quantityApplied||0).toFixed(2)} {String(x.doseUnit||'').startsWith('mL')?'mL':'g'}</td><td>{x.route}</td><td>{x.status}</td><td>{x.nextReview||'—'}</td></tr>)}
  </tbody></table></div></Card>
 </>
}
