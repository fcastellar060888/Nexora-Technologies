import{useState}from'react'
import Card from'../components/Card'
import Field from'../components/Field'
import PageHeader from'../components/PageHeader'
import{useStore}from'../services/store'
import{createCostEntry,financialMetrics,financialViewForActiveOrganization}from'../domain/finance.js'

export default function CostsPage(){
 const{state,update}=useStore(),view=financialViewForActiveOrganization(state),metrics=financialMetrics(state)
 const firstSite=view.sites[0]
 const[form,setForm]=useState({id:crypto.randomUUID(),organizationId:view.organizationId,siteId:firstSite?.id||'',date:new Date().toISOString().slice(0,10),category:'Fertirriego',description:'',amount:0,batch:''})
 function save(e){
  e.preventDefault()
  try{
   update(s=>createCostEntry(s,form),{module:'Costos',action:'Costo registrado',detail:form.description||form.category})
   setForm({...form,id:crypto.randomUUID(),organizationId:view.organizationId,siteId:view.sites.find(site=>site.id===form.siteId)?.id||firstSite?.id||'',description:'',amount:0,batch:''})
  }catch(error){alert(error.message)}
 }
 return <>
  <PageHeader title="Costos" subtitle="Costos por sede y costo consolidado por gramo empacado desde el ledger productivo canónico."/>
  <div className="kpi-grid">
   <Card className="kpi-card"><span>Costo acumulado</span><strong>${metrics.totalCost.toLocaleString('es-US')}</strong></Card>
   <Card className="kpi-card"><span>Gramos empacados</span><strong>{metrics.packedGrams.toLocaleString('es-US')}</strong></Card>
   <Card className="kpi-card"><span>Costo por gramo</span><strong>${metrics.costPerGram.toLocaleString('es-US',{maximumFractionDigits:2})}</strong></Card>
  </div>
  <Card title="Registrar costo"><form className="form-grid" onSubmit={save}>
   <Field label="Sede"><select value={form.siteId} onChange={e=>setForm({...form,siteId:e.target.value,organizationId:view.organizationId})}><option value="">Seleccionar</option>{view.sites.map(x=><option key={`${x.organizationId}:${x.id}`} value={x.id}>{x.name}</option>)}</select></Field>
   <Field label="Fecha"><input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></Field>
   <Field label="Categoría"><select value={form.category} onChange={e=>setForm({...form,category:e.target.value})}>{['Fertirriego','MIPE','MIRFE','Cosecha','Secado','Manicura','Selección','Empaque','Mano de obra','Otro'].map(x=><option key={x}>{x}</option>)}</select></Field>
   <Field label="Descripción"><input value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></Field>
   <Field label="Valor"><input type="number" min="0" step="0.01" value={form.amount} onChange={e=>setForm({...form,amount:Number(e.target.value)})}/></Field>
   <Field label="Lote / referencia"><input value={form.batch} onChange={e=>setForm({...form,batch:e.target.value})}/></Field>
   <div className="form-actions"><button className="button primary">Guardar costo</button></div>
  </form></Card>
  <Card title="Historial de costos"><div className="table-scroll"><table><thead><tr><th>Fecha</th><th>Sede</th><th>Categoría</th><th>Descripción</th><th>Lote</th><th>Valor</th></tr></thead><tbody>{[...view.costEntries].reverse().map(entry=><tr key={`${entry.organizationId}:${entry.id}`}><td>{entry.date}</td><td>{view.sites.find(site=>site.id===entry.siteId)?.name||entry.siteId||'—'}</td><td>{entry.category}</td><td>{entry.description||'—'}</td><td>{entry.batch||'—'}</td><td>${Number(entry.amount||0).toLocaleString('es-US')}</td></tr>)}</tbody></table></div></Card>
 </>
}
