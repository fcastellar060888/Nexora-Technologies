import Card from '../components/Card'
import PageHeader from '../components/PageHeader'
import { useStore } from '../services/store'

export default function PreparationsPage(){
 const {state,update}=useStore()
 function create(f){
  const tankGroups=Object.groupBy ? Object.groupBy(f.items,x=>x.tank) : f.items.reduce((a,x)=>((a[x.tank]=a[x.tank]||[]).push(x),a),{})
  const prep={id:crypto.randomUUID(),formulationId:f.id,date:new Date().toISOString().slice(0,10),siteId:f.siteId,volumeL:f.volumeL,tanks:tankGroups,status:'Pendiente'}
  update(s=>({...s,tankPreparations:[...s.tankPreparations,prep]}))
 }
 return <>
  <PageHeader title="Preparaciones por tanque" subtitle="Convierte una formulación en cargas y listas separadas para Tanque A, B o C."/>
  <Card title="Formulaciones disponibles">{state.formulations.map(f=><div className="house-list-card" key={f.id}><div><strong>{state.sites.find(s=>s.id===f.siteId)?.name} · {f.stage}</strong><small>{f.volumeL} L · {f.status}</small></div><button className="button primary" onClick={()=>create(f)}>Crear preparación</button></div>)}</Card>
  <Card title="Preparaciones">{state.tankPreparations.map(p=><div className="preparation-card" key={p.id}><h4>{state.sites.find(s=>s.id===p.siteId)?.name} · {p.volumeL} L</h4>{Object.entries(p.tanks||{}).map(([tank,items])=><div key={tank}><strong>Tanque {tank}</strong><ul>{items.map(i=><li key={i.productId}>{state.nutrientProducts.find(x=>x.id===i.productId)?.name}: {i.grams} g</li>)}</ul></div>)}</div>)}</Card>
 </>
}
