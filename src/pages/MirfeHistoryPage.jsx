import { useMemo,useState } from 'react'
import Card from '../components/Card'
import Field from '../components/Field'
import PageHeader from '../components/PageHeader'
import StateMessage from '../components/StateMessage'
import { mirfeStatuses } from '../domain/mirfe'
import { useStore } from '../services/store'

const phaseOf=record=>{
 if(String(record.result||'').trim())return 'Verificada'
 if(/ejecut|aplic|complet/i.test(String(record.status||'')))return 'Ejecutada'
 return 'Pendiente'
}

export default function MirfeHistoryPage(){
 const {state,update}=useStore()
 const [editing,setEditing]=useState(null)
 const [filters,setFilters]=useState({phase:'Todas',status:'Todos',houseId:'Todos'})
 const rows=useMemo(()=>[...state.mirfeReinforcements].reverse().filter(record=>{
  const phase=phaseOf(record)
  return(filters.phase==='Todas'||phase===filters.phase)
   &&(filters.status==='Todos'||record.status===filters.status)
   &&(filters.houseId==='Todos'||record.houseId===filters.houseId)
 }),[state.mirfeReinforcements,filters])
 const counts=useMemo(()=>state.mirfeReinforcements.reduce((summary,record)=>({...summary,[phaseOf(record)]:summary[phaseOf(record)]+1}),{Pendiente:0,Ejecutada:0,Verificada:0}),[state.mirfeReinforcements])
 function save(e){e.preventDefault();update(s=>({...s,mirfeReinforcements:s.mirfeReinforcements.map(x=>x.id===editing.id?{...editing,updatedAt:new Date().toISOString()}:x)}),{module:'MIRFE',action:'Actualizar seguimiento',detail:editing.id});setEditing(null)}
 return <>
  <PageHeader title="Seguimiento e historial MIRFE" subtitle="Documenta el resultado 24–72 h, EC/pH posterior, eficacia y próxima decisión."/>
  <Card title="Filtros"><div className="form-grid three">
   <Field label="Fase"><select value={filters.phase} onChange={e=>setFilters({...filters,phase:e.target.value})}><option>Todas</option><option>Pendiente</option><option>Ejecutada</option><option>Verificada</option></select></Field>
   <Field label="Estado"><select value={filters.status} onChange={e=>setFilters({...filters,status:e.target.value})}><option>Todos</option>{mirfeStatuses.map(x=><option key={x}>{x}</option>)}</select></Field>
   <Field label="Nave"><select value={filters.houseId} onChange={e=>setFilters({...filters,houseId:e.target.value})}><option value="Todos">Todas</option>{state.houses.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
  </div></Card>
  <div className="summary-strip">
   <div><span>Pendientes</span><strong>{counts.Pendiente}</strong></div>
   <div><span>Ejecutadas por verificar</span><strong className="warn">{counts.Ejecutada}</strong></div>
   <div><span>Verificadas</span><strong>{counts.Verificada}</strong></div>
   <div><span>Visibles</span><strong>{rows.length}</strong></div>
  </div>
  <Card title="Historial">{!state.mirfeReinforcements.length?<StateMessage title="No hay órdenes MIRFE para seguir" message="Crea una orden de refuerzo para iniciar el historial de ejecución, verificación y respuesta agronómica."/>:!rows.length?<StateMessage type="info" title="Sin coincidencias" message="No hay órdenes que coincidan con los filtros actuales. Cambia la fase, el estado o la nave."/>:<div className="table-scroll"><table><thead><tr><th>Fecha</th><th>Nave</th><th>Genética</th><th>Motivo</th><th>Fase</th><th>Estado</th><th>Resultado</th><th>EC antes/después</th><th>pH antes/después</th><th></th></tr></thead><tbody>
   {rows.map(x=>{const phase=phaseOf(x);return <tr key={x.id}><td>{x.date}</td><td>{state.houses.find(h=>h.id===x.houseId)?.name||'—'}</td><td>{state.genetics.find(g=>g.id===x.geneticId)?.name||'—'}</td><td>{x.reason||'—'}</td><td><span className={`tag ${phase==='Verificada'?'success':''}`}>{phase}</span></td><td>{x.status}</td><td>{x.result||'Pendiente de verificación'}</td><td>{x.ecBefore} / {x.ecAfter||'—'}</td><td>{x.phBefore} / {x.phAfter||'—'}</td><td><button className="button secondary" onClick={()=>setEditing({...x})}>{phase==='Verificada'?'Actualizar seguimiento':'Registrar seguimiento'}</button></td></tr>})}
  </tbody></table></div>}</Card>
  {editing&&<Card title="Actualizar seguimiento"><form className="form-grid" onSubmit={save}>
   <Field label="Estado"><select value={editing.status} onChange={e=>setEditing({...editing,status:e.target.value})}>{mirfeStatuses.map(x=><option key={x}>{x}</option>)}</select></Field>
   <Field label="EC después"><input type="number" step=".01" value={editing.ecAfter||0} onChange={e=>setEditing({...editing,ecAfter:Number(e.target.value)})}/></Field>
   <Field label="pH después"><input type="number" step=".01" value={editing.phAfter||0} onChange={e=>setEditing({...editing,phAfter:Number(e.target.value)})}/></Field>
   <Field label="Resultado 24–72 h"><textarea value={editing.result||''} onChange={e=>setEditing({...editing,result:e.target.value})}/></Field>
   <Field label="Próxima revisión"><input type="date" value={editing.nextReview||''} onChange={e=>setEditing({...editing,nextReview:e.target.value})}/></Field>
   <Field label="Observaciones finales"><textarea value={editing.notes||''} onChange={e=>setEditing({...editing,notes:e.target.value})}/></Field>
   <div className="form-actions"><button type="button" className="button secondary" onClick={()=>setEditing(null)}>Cancelar</button><button className="button primary">Guardar seguimiento</button></div>
  </form></Card>}
 </>
}
