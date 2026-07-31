import{useState}from'react'
import Card from'../components/Card'
import Field from'../components/Field'
import PageHeader from'../components/PageHeader'
import{useStore}from'../services/store'
import{unitCost}from'../domain/production'

export default function CostsPage(){
 const{state,update}=useStore()
 const[form,setForm]=useState({siteId:state.sites[0]?.id||'',date:new Date().toISOString().slice(0,10),category:'Fertirriego',description:'',amount:0,batch:'',gramsProduced:0})
 function save(e){e.preventDefault();update(s=>({...s,costEntries:[...s.costEntries,{id:crypto.randomUUID(),...form}]}))}
 const total=state.costEntries.reduce((s,x)=>s+Number(x.amount||0),0)
 const grams=state.packingBatches.reduce((s,x)=>s+Number(x.packedOutput||0),0)
 return <>
  <PageHeader title="Costos" subtitle="Costos por sede, categoría, lote y costo consolidado por gramo empacado."/>
  <div className="kpi-grid"><Card className="kpi-card"><span>Costo acumulado</span><strong>${total.toLocaleString('es-US')}</strong></Card><Card className="kpi-card"><span>Gramos empacados</span><strong>{grams.toLocaleString('es-US')}</strong></Card><Card className="kpi-card"><span>Costo por gramo</span><strong>${unitCost(total,grams).toLocaleString('es-US',{maximumFractionDigits:2})}</strong></Card></div>
  <Card title="Registrar costo"><form className="form-grid" onSubmit={save}>
   <Field label="Sede"><select value={form.siteId} onChange={e=>setForm({...form,siteId:e.target.value})}>{state.sites.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
   <Field label="Fecha"><input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></Field>
   <Field label="Categoría"><select value={form.category} onChange={e=>setForm({...form,category:e.target.value})}>{['Fertirriego','MIPE','MIRFE','Cosecha','Secado','Manicura','Selección','Empaque','Mano de obra','Otro'].map(x=><option key={x}>{x}</option>)}</select></Field>
   <Field label="Descripción"><input value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></Field>
   <Field label="Valor"><input type="number" value={form.amount} onChange={e=>setForm({...form,amount:Number(e.target.value)})}/></Field>
   <Field label="Lote"><input value={form.batch} onChange={e=>setForm({...form,batch:e.target.value})}/></Field>
   <div className="form-actions"><button className="button primary">Guardar costo</button></div>
  </form></Card>
 </>
}
