import { useState } from 'react'
import Card from '../components/Card'
import Field from '../components/Field'
import PageHeader from '../components/PageHeader'
import { calculateVpd, deltaEc } from '../domain/mirfe'
import { useStore } from '../services/store'

const empty={siteId:'',houseId:'',bedId:'',geneticId:'',stage:'Vegetativo fuerte',week:1,date:new Date().toISOString().slice(0,10),temp:24,humidity:65,ppfd:0,volumeApplied:0,drainPercent:0,ecInput:0,ecDrain:0,phInput:0,phDrain:0,n:0,p:0,k:0,ca:0,mg:0,s:0,diagnosis:''}

export default function MirfeMonitoringPage(){
 const {state,update}=useStore()
 const [form,setForm]=useState({...empty,siteId:state.sites[0]?.id||'',houseId:state.houses[0]?.id||'',geneticId:state.genetics[0]?.id||''})
 const beds=state.beds.filter(x=>x.houseId===form.houseId)
 function save(e){
   e.preventDefault()
   const record={id:crypto.randomUUID(),...form,vpd:calculateVpd(form.temp,form.humidity),deltaEc:deltaEc(form.ecInput,form.ecDrain),createdAt:new Date().toISOString()}
   update(s=>({...s,mirfeMonitoring:[...s.mirfeMonitoring,record]}))
 }
 return <>
  <PageHeader title="Monitoreo integral MIRFE" subtitle="Registra el contexto, variables ambientales, riego, drenaje, solución nutritiva y diagnóstico en bloques ordenados."/>
  <Card title="Nuevo monitoreo">
   <form className="stacked-form" onSubmit={save}>
    <section className="form-section"><h4>1. Contexto del cultivo</h4><div className="form-grid">
     <Field label="Sede"><select value={form.siteId} onChange={e=>setForm({...form,siteId:e.target.value})}>{state.sites.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
     <Field label="Nave"><select value={form.houseId} onChange={e=>setForm({...form,houseId:e.target.value,bedId:''})}>{state.houses.filter(h=>h.siteId===form.siteId).map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
     <Field label="Cama / bloque"><select value={form.bedId} onChange={e=>setForm({...form,bedId:e.target.value})}><option value="">Toda la nave</option>{beds.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
     <Field label="Genética"><select value={form.geneticId} onChange={e=>setForm({...form,geneticId:e.target.value})}>{state.genetics.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
     <Field label="Etapa"><select value={form.stage} onChange={e=>setForm({...form,stage:e.target.value})}>{['Clones/enraizamiento','Vegetativo temprano','Vegetativo fuerte','Madres','Floración inicial','Floración media','Floración final'].map(x=><option key={x}>{x}</option>)}</select></Field>
     <Field label="Semana"><input type="number" value={form.week} onChange={e=>setForm({...form,week:Number(e.target.value)})}/></Field>
     <Field label="Fecha"><input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></Field>
    </div></section>

    <section className="form-section"><h4>2. Ambiente e iluminación</h4><div className="form-grid">
     <Field label="Temperatura °C"><input type="number" step=".1" value={form.temp} onChange={e=>setForm({...form,temp:Number(e.target.value)})}/></Field>
     <Field label="Humedad relativa %"><input type="number" step=".1" value={form.humidity} onChange={e=>setForm({...form,humidity:Number(e.target.value)})}/></Field>
     <Field label="PPFD"><input type="number" value={form.ppfd} onChange={e=>setForm({...form,ppfd:Number(e.target.value)})}/></Field>
     <div className="calculated-field"><span>VPD calculado</span><strong>{calculateVpd(form.temp,form.humidity).toFixed(2)} kPa</strong></div>
    </div></section>

    <section className="form-section"><h4>3. Riego, drenaje y solución</h4><div className="form-grid">
     <Field label="Volumen aplicado L"><input type="number" step=".1" value={form.volumeApplied} onChange={e=>setForm({...form,volumeApplied:Number(e.target.value)})}/></Field>
     <Field label="Drenaje %"><input type="number" step=".1" value={form.drainPercent} onChange={e=>setForm({...form,drainPercent:Number(e.target.value)})}/></Field>
     <Field label="EC entrada"><input type="number" step=".01" value={form.ecInput} onChange={e=>setForm({...form,ecInput:Number(e.target.value)})}/></Field>
     <Field label="EC drenaje"><input type="number" step=".01" value={form.ecDrain} onChange={e=>setForm({...form,ecDrain:Number(e.target.value)})}/></Field>
     <Field label="pH entrada"><input type="number" step=".01" value={form.phInput} onChange={e=>setForm({...form,phInput:Number(e.target.value)})}/></Field>
     <Field label="pH drenaje"><input type="number" step=".01" value={form.phDrain} onChange={e=>setForm({...form,phDrain:Number(e.target.value)})}/></Field>
     <div className="calculated-field"><span>ΔEC calculado</span><strong className={Math.abs(deltaEc(form.ecInput,form.ecDrain))>=.5?'warn':'ok'}>{deltaEc(form.ecInput,form.ecDrain).toFixed(2)}</strong></div>
    </div></section>

    <section className="form-section"><h4>4. Nutrición observada / analizada</h4><div className="form-grid nutrient-grid">
     {['n','p','k','ca','mg','s'].map(key=><Field key={key} label={`${key.toUpperCase()} ppm`}><input type="number" value={form[key]} onChange={e=>setForm({...form,[key]:Number(e.target.value)})}/></Field>)}
    </div></section>

    <section className="form-section"><h4>5. Diagnóstico y decisión</h4><div className="form-grid one">
     <Field label="Diagnóstico / acción sugerida"><textarea value={form.diagnosis} onChange={e=>setForm({...form,diagnosis:e.target.value})}/></Field>
    </div></section>
    <div className="form-actions"><button className="button primary">Guardar monitoreo</button></div>
   </form>
  </Card>
  <Card title="Registros recientes"><div className="table-scroll"><table><thead><tr><th>Fecha</th><th>Nave</th><th>Genética</th><th>Etapa</th><th>VPD</th><th>Drenaje</th><th>EC entrada</th><th>EC drenaje</th><th>ΔEC</th><th>Diagnóstico</th></tr></thead><tbody>
   {[...state.mirfeMonitoring].reverse().map(x=><tr key={x.id}><td>{x.date}</td><td>{state.houses.find(h=>h.id===x.houseId)?.name}</td><td>{state.genetics.find(g=>g.id===x.geneticId)?.name}</td><td>{x.stage}</td><td>{Number(x.vpd).toFixed(2)}</td><td>{x.drainPercent}%</td><td>{x.ecInput}</td><td>{x.ecDrain}</td><td className={Math.abs(x.deltaEc)>=.5?'warn':'ok'}>{Number(x.deltaEc).toFixed(2)}</td><td>{x.diagnosis||'—'}</td></tr>)}
  </tbody></table></div></Card>
 </>
}
