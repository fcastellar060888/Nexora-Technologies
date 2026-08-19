import{useState}from'react'
import Card from'../components/Card'
import Field from'../components/Field'
import PageHeader from'../components/PageHeader'
import{useStore}from'../services/store'
import{createCurrency,financialViewForActiveOrganization,updateCurrencyRate}from'../domain/finance.js'

export default function CurrenciesPage(){
 const{state,update}=useStore(),view=financialViewForActiveOrganization(state)
 const[form,setForm]=useState({code:'',name:'',symbol:'',rateToBase:1,active:true,organizationId:view.organizationId})
 function save(e){
  e.preventDefault()
  try{
   update(s=>createCurrency(s,{...form,organizationId:form.organizationId}),{module:'Configuración',action:'Moneda creada',detail:form.code.trim().toUpperCase()})
   setForm({code:'',name:'',symbol:'',rateToBase:1,active:true,organizationId:view.organizationId})
  }catch(error){alert(error.message)}
 }
 function rate(code,value){
  try{update(s=>updateCurrencyRate(s,{code,rateToBase:Number(value),organizationId:view.organizationId}),{module:'Configuración',action:'Tasa actualizada',detail:code})}
  catch(error){alert(error.message)}
 }
 return <>
  <PageHeader title="Monedas" subtitle="Las tasas son tenant-aware; cada venta conserva además su propia tasa histórica congelada."/>
  <Card title="Agregar moneda"><form className="form-grid" onSubmit={save}>
   <Field label="Código"><input value={form.code} onChange={e=>setForm({...form,code:e.target.value})}/></Field>
   <Field label="Nombre"><input value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></Field>
   <Field label="Símbolo"><input value={form.symbol} onChange={e=>setForm({...form,symbol:e.target.value})}/></Field>
   <Field label="Tasa a moneda base"><input type="number" min="0.0001" step="0.0001" value={form.rateToBase} onChange={e=>setForm({...form,rateToBase:Number(e.target.value)})}/></Field>
   <button className="button primary">Agregar</button>
  </form></Card>
  <Card title="Monedas habilitadas"><div className="table-scroll"><table><thead><tr><th>Código</th><th>Nombre</th><th>Símbolo</th><th>Tasa a base</th></tr></thead><tbody>{view.currencies.map(x=><tr key={`${x.organizationId}:${x.code}`}><td>{x.code}</td><td>{x.name}</td><td>{x.symbol}</td><td><input type="number" min="0.0001" step="0.0001" value={x.rateToBase} onChange={e=>rate(x.code,e.target.value)}/></td></tr>)}</tbody></table></div></Card>
 </>
}
