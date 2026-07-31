import { useState } from 'react'
import Card from '../components/Card'
import Field from '../components/Field'
import PageHeader from '../components/PageHeader'
import { mirfeStatuses } from '../domain/mirfe'
import { useStore } from '../services/store'

export default function MirfeHistoryPage(){
 const {state,update}=useStore()
 const [editing,setEditing]=useState(null)
 function save(e){e.preventDefault();update(s=>({...s,mirfeReinforcements:s.mirfeReinforcements.map(x=>x.id===editing.id?editing:x)}));setEditing(null)}
 return <>
  <PageHeader title="Seguimiento e historial MIRFE" subtitle="Documenta el resultado 24–72 h, EC/pH posterior, eficacia y próxima decisión."/>
  <Card title="Historial"><div className="table-scroll"><table><thead><tr><th>Fecha</th><th>Nave</th><th>Genética</th><th>Motivo</th><th>Estado</th><th>Resultado</th><th>EC antes/después</th><th>pH antes/después</th><th></th></tr></thead><tbody>
   {[...state.mirfeReinforcements].reverse().map(x=><tr key={x.id}><td>{x.date}</td><td>{state.houses.find(h=>h.id===x.houseId)?.name}</td><td>{state.genetics.find(g=>g.id===x.geneticId)?.name}</td><td>{x.reason}</td><td>{x.status}</td><td>{x.result||'Pendiente'}</td><td>{x.ecBefore} / {x.ecAfter||'—'}</td><td>{x.phBefore} / {x.phAfter||'—'}</td><td><button className="button secondary" onClick={()=>setEditing({...x})}>Registrar seguimiento</button></td></tr>)}
  </tbody></table></div></Card>
  {editing&&<Card title="Actualizar seguimiento"><form className="form-grid" onSubmit={save}>
   <Field label="Estado"><select value={editing.status} onChange={e=>setEditing({...editing,status:e.target.value})}>{mirfeStatuses.map(x=><option key={x}>{x}</option>)}</select></Field>
   <Field label="EC después"><input type="number" step=".01" value={editing.ecAfter||0} onChange={e=>setEditing({...editing,ecAfter:Number(e.target.value)})}/></Field>
   <Field label="pH después"><input type="number" step=".01" value={editing.phAfter||0} onChange={e=>setEditing({...editing,phAfter:Number(e.target.value)})}/></Field>
   <Field label="Resultado 24–72 h"><textarea value={editing.result||''} onChange={e=>setEditing({...editing,result:e.target.value})}/></Field>
   <Field label="Próxima revisión"><input type="date" value={editing.nextReview||''} onChange={e=>setEditing({...editing,nextReview:e.target.value})}/></Field>
   <Field label="Observaciones finales"><textarea value={editing.notes||''} onChange={e=>setEditing({...editing,notes:e.target.value})}/></Field>
   <div className="form-actions"><button className="button primary">Guardar seguimiento</button></div>
  </form></Card>}
 </>
}
