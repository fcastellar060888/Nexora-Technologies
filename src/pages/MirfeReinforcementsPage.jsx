import{useMemo,useState} from'react'
import Card from'../components/Card'
import Field from'../components/Field'
import PageHeader from'../components/PageHeader'
import StateMessage from'../components/StateMessage'
import{FormActions,ValidationMessage}from'../components/forms/FormKit.jsx'
import{mirfeCategories,quantityFromDose}from'../domain/mirfe'
import{IRRIGATION_MIRFE_OPERATIONS,useIrrigationMirfeCommandStore}from'../services/irrigationMirfeCommandStore'

const initialForm=state=>({monitoringId:'',programId:'',siteId:state.sites[0]?.id||'',houseId:state.houses.find(x=>x.siteId===state.sites[0]?.id)?.id||'',bedId:'',geneticId:state.genetics[0]?.id||'',stage:'Floración media',week:1,category:'Nutrición',reason:'',triggerVariable:'',observedValue:0,targetValue:0,productId:'',objective:'',dose:0,doseUnit:'mL/L',volumePrepared:0,route:'Riego',ecBefore:0,phBefore:0,responsible:'',nextReview:'',notes:''})

export default function MirfeReinforcementsPage(){
 const{state,execute}=useIrrigationMirfeCommandStore()
 const[form,setForm]=useState(()=>initialForm(state))
 const[msg,setMsg]=useState('')
 const houses=state.houses.filter(x=>x.siteId===form.siteId),beds=state.beds.filter(x=>x.houseId===form.houseId)
 const products=useMemo(()=>state.products.filter(x=>['MIRFE','Fertilizante','Adyuvante','Corrector pH'].includes(x.category)),[state.products])
 const quantity=quantityFromDose(form.dose,form.doseUnit,form.volumePrepared),quantityUnit=form.doseUnit.startsWith('mL')?'mL':'g'
 const missing=[]
 if(!state.sites.length)missing.push('una sede')
 if(!state.houses.length)missing.push('una nave')
 if(!state.genetics.length)missing.push('una genética')
 if(!products.length)missing.push('un producto MIRFE, fertilizante, adyuvante o corrector de pH')
 const canCreate=!missing.length&&Boolean(form.siteId&&form.houseId&&form.geneticId&&form.productId&&form.reason.trim()&&form.objective.trim()&&Number(form.dose)>0&&Number(form.volumePrepared)>0)

 async function save(e){
  e.preventDefault();setMsg('')
  if(missing.length)return setMsg(`Configuración incompleta: registra ${missing.join(', ')}.`)
  try{
   await execute({operation:IRRIGATION_MIRFE_OPERATIONS.CREATE_MIRFE_REINFORCEMENT,input:form})
   setMsg(`Orden MIRFE creada en Borrador. Cantidad calculada: ${quantity.toFixed(2)} ${quantityUnit}.`)
   setForm(current=>({...initialForm(state),siteId:current.siteId,houseId:current.houseId,geneticId:current.geneticId,responsible:current.responsible}))
  }catch(error){setMsg(error.message)}
 }

 function selectProgram(value){
  const program=state.mirfePrograms.find(x=>x.id===value)
  setForm(current=>({...current,programId:value,category:program?.category||current.category,geneticId:program?.geneticId==='Todos'?current.geneticId:program?.geneticId||current.geneticId,stage:program?.stage||current.stage,triggerVariable:program?.triggerVariable||'',targetValue:program?.targetValue||0,objective:program?.objective||''}))
 }
 function selectMonitoring(value){
  const monitoring=state.mirfeMonitoring.find(x=>x.id===value)
  setForm(current=>({...current,monitoringId:value,siteId:monitoring?.siteId||current.siteId,houseId:monitoring?.houseId||current.houseId,bedId:monitoring?.bedId||'',geneticId:monitoring?.geneticId||current.geneticId,stage:monitoring?.stage||current.stage,week:monitoring?.week||current.week,observedValue:monitoring?.deltaEc||0,ecBefore:monitoring?.ecDrain||monitoring?.ecInput||0,phBefore:monitoring?.phDrain||monitoring?.phInput||0,reason:monitoring?.diagnosis||current.reason}))
 }

 return <>
  <PageHeader title="Refuerzos y órdenes MIRFE" subtitle="Cada orden nace en Borrador y avanza únicamente mediante el workflow agronómico compartido."/>
  <Card title="Nueva orden de refuerzo">
   <form id="mirfe-reinforcement-new" data-module="Orden de refuerzo MIRFE" data-record-id="new-reinforcement" className="stacked-form" onSubmit={save}>
    {missing.length>0&&<StateMessage type="error" title="Configuración incompleta" message={`Antes de crear una orden registra ${missing.join(', ')}.`}/>} 
    {!state.mirfePrograms.length&&<StateMessage type="info" compact title="Sin programas MIRFE" message="Puedes crear la orden manualmente, pero un programa permite fijar la regla, la meta y el objetivo agronómico como snapshot."/>}
    {!state.mirfeMonitoring.length&&<StateMessage type="info" compact title="Sin monitoreo de origen" message="La orden puede registrarse manualmente, aunque vincular un monitoreo conserva su evidencia inmutable."/>}
    {msg&&<ValidationMessage type={msg.startsWith('Orden')?'success':'error'}>{msg}</ValidationMessage>}

    <section className="form-section"><h4>1. Origen de la decisión</h4><div className="form-grid two">
     <Field label="Programa MIRFE"><select disabled={!state.mirfePrograms.length} value={form.programId} onChange={e=>selectProgram(e.target.value)}><option value="">Sin programa asociado</option>{state.mirfePrograms.filter(x=>x.status==='ACTIVE'||x.active!==false).map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
     <Field label="Monitoreo de origen"><select disabled={!state.mirfeMonitoring.length} value={form.monitoringId} onChange={e=>selectMonitoring(e.target.value)}><option value="">Sin monitoreo asociado</option>{state.mirfeMonitoring.map(x=><option key={x.id} value={x.id}>{x.date} · {state.houses.find(h=>h.id===x.houseId)?.name||'Sin nave'}</option>)}</select></Field>
    </div></section>

    <section className="form-section"><h4>2. Ubicación y contexto del cultivo</h4><div className="form-grid four">
     <Field label="Sede"><select required disabled={!state.sites.length} value={form.siteId} onChange={e=>{const siteId=e.target.value;const houseId=state.houses.find(x=>x.siteId===siteId)?.id||'';setForm({...form,siteId,houseId,bedId:''})}}><option value="">Selecciona</option>{state.sites.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
     <Field label="Nave"><select required disabled={!houses.length} value={form.houseId} onChange={e=>setForm({...form,houseId:e.target.value,bedId:''})}><option value="">Selecciona</option>{houses.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
     <Field label="Cama o bloque"><select disabled={!form.houseId} value={form.bedId} onChange={e=>setForm({...form,bedId:e.target.value})}><option value="">Toda la nave</option>{beds.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
     <Field label="Genética"><select required disabled={!state.genetics.length} value={form.geneticId} onChange={e=>setForm({...form,geneticId:e.target.value})}><option value="">Selecciona</option>{state.genetics.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
     <Field label="Etapa"><input required value={form.stage} onChange={e=>setForm({...form,stage:e.target.value})}/></Field>
     <Field label="Semana"><input type="number" min="1" value={form.week} onChange={e=>setForm({...form,week:Number(e.target.value)})}/></Field>
     <Field label="Categoría"><select value={form.category} onChange={e=>setForm({...form,category:e.target.value})}>{mirfeCategories.map(x=><option key={x}>{x}</option>)}</select></Field>
    </div></section>

    <section className="form-section"><h4>3. Diagnóstico y meta</h4><div className="form-grid four">
     <Field label="Motivo o diagnóstico" className="full"><input required value={form.reason} onChange={e=>setForm({...form,reason:e.target.value})}/></Field>
     <Field label="Variable disparadora"><input value={form.triggerVariable} onChange={e=>setForm({...form,triggerVariable:e.target.value})}/></Field>
     <Field label="Valor observado"><input type="number" step=".01" value={form.observedValue} onChange={e=>setForm({...form,observedValue:Number(e.target.value)})}/></Field>
     <Field label="Meta esperada"><input type="number" step=".01" value={form.targetValue} onChange={e=>setForm({...form,targetValue:Number(e.target.value)})}/></Field>
     <Field label="Objetivo agronómico" className="full"><textarea required value={form.objective} onChange={e=>setForm({...form,objective:e.target.value})}/></Field>
    </div></section>

    <section className="form-section"><h4>4. Formulación y aplicación</h4><div className="form-grid four">
     <Field label="Producto o insumo"><select required disabled={!products.length} value={form.productId} onChange={e=>setForm({...form,productId:e.target.value})}><option value="">Selecciona</option>{products.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
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
     <Field label="Estado inicial"><input value="Borrador" disabled/></Field>
     <Field label="Próxima revisión"><input type="date" value={form.nextReview} onChange={e=>setForm({...form,nextReview:e.target.value})}/></Field>
     <Field label="Observaciones" className="full"><textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></Field>
    </div></section>

    <FormActions><button type="button" className="button secondary" onClick={()=>{setForm(initialForm(state));setMsg('')}}>Limpiar</button><button className="button primary" disabled={!canCreate}>Crear orden MIRFE</button></FormActions>
   </form>
  </Card>

  <Card title="Órdenes y refuerzos">{!state.mirfeReinforcements.length?<StateMessage title="No hay órdenes MIRFE" message="Crea la primera orden para documentar causa, evidencia, formulación y workflow."/>:<div className="table-scroll"><table><thead><tr><th>Fecha</th><th>Ubicación</th><th>Genética</th><th>Categoría</th><th>Motivo</th><th>Producto</th><th>Cantidad</th><th>Estado</th><th>Versión</th><th>Próxima revisión</th></tr></thead><tbody>
   {[...state.mirfeReinforcements].reverse().map(x=><tr key={x.id}><td>{x.date}</td><td>{state.sites.find(s=>s.id===x.siteId)?.name||'—'} · {state.houses.find(h=>h.id===x.houseId)?.name||'—'}</td><td>{state.genetics.find(g=>g.id===x.geneticId)?.name||'—'}</td><td>{x.category}</td><td>{x.reason||'—'}</td><td>{x.productSnapshot?.name||state.products.find(p=>p.id===x.productId)?.name||'—'}</td><td>{Number(x.quantityApplied||0).toFixed(2)} {String(x.doseUnit||'').startsWith('mL')?'mL':'g'}</td><td>{x.workflowQuarantined?'En cuarentena':x.status}</td><td>{x.workflowVersion||'—'}</td><td>{x.nextReview||'—'}</td></tr>)}
  </tbody></table></div>}</Card>
 </>
}
