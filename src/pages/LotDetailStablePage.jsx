import{useState}from'react'
import{useParams}from'react-router-dom'
import Card from'../components/Card'
import Field from'../components/Field'
import PageHeader from'../components/PageHeader'
import RootedCuttingPromotionPanel from'../components/RootedCuttingPromotionPanel.jsx'
import{useStore}from'../services/store'
import{LOT_PHASES,dateOnly,lotTiming,nextPhase,survivalMetrics}from'../domain/lifecycle'
import{advanceProductionLot,phaseOutput}from'../domain/production'

export default function LotDetailStablePage(){
 const{lotId}=useParams(),{state,update}=useStore()
 const lot=state.propagationBatches.find(item=>item.id===lotId)
 const initialPhase=lot?nextPhase(lot.phase):'Vegetativo'
 const[move,setMove]=useState({phase:initialPhase,date:dateOnly(),quantity:lot?.activeQuantity||lot?.quantity||0,discarded:0,outputWeight:'',responsible:'',notes:''})
 if(!lot)return <Card>El lote no existe.</Card>
 const units=state.propagationUnits.filter(item=>item.batchId===lot.id),metrics=survivalMetrics(units),timing=lotTiming(state,lot)
 const mother=state.motherPlants.find(item=>item.id===lot.motherPlantId),grand=state.grandmotherPlants.find(item=>item.id===mother?.grandmotherPlantId),ledger=lot.productionLedger||{}
 const weightRequired=['Cosecha','Secado','Manicura','Selección','Empaque','Finalizado'].includes(move.phase)
 function advance(event){event.preventDefault();try{update(store=>advanceProductionLot(store,{lotId:lot.id,...move}),{module:'Producción',action:`Cambio ${lot.phase} → ${move.phase}`,detail:lot.code});setMove(current=>({...current,phase:nextPhase(current.phase),outputWeight:'',discarded:0}))}catch(error){alert(error.message)}}
 return <>
  <PageHeader title={lot.code} subtitle="Un solo lote desde esquejes hasta producto terminado, con balance de masa por etapa."/>
  <div className="kpi-grid">{[['Fase',lot.phase],['Semana',timing.week],['Día',`${timing.elapsed}/${timing.objective}`],['Restantes',timing.remaining],['Vivos',lot.activeQuantity??metrics.alive],['Cosecha',`${phaseOutput(lot,'Cosecha').toLocaleString('es-US')} g`],['Empaque',`${phaseOutput(lot,'Empaque').toLocaleString('es-US')} g`]].map(([label,value])=><Card className="kpi-card" key={label}><span>{label}</span><strong>{value}</strong></Card>)}</div>
  <div className="content-grid two">
   <Card title="Genealogía"><div className="detail-grid"><div><span>Lote abuelas</span><strong>{grand?.lotCode||'—'}</strong></div><div><span>Lote madres</span><strong>{mother?.lotCode||'—'}</strong></div><div><span>Genética</span><strong>{state.genetics.find(genetic=>genetic.id===lot.geneticId)?.name||'—'}</strong></div><div><span>Fecha de corte</span><strong>{lot.cutDate||'—'}</strong></div></div></Card>
   <Card title="Cambiar fase"><form className="form-grid" onSubmit={advance}><Field label="Nueva fase"><select value={move.phase} onChange={event=>setMove({...move,phase:event.target.value})}>{LOT_PHASES.map(phase=><option key={phase}>{phase}</option>)}</select></Field><Field label="Fecha efectiva"><input type="date" value={move.date} onChange={event=>setMove({...move,date:event.target.value})}/></Field><Field label="Cantidad que avanza"><input type="number" min="0" value={move.quantity} onChange={event=>setMove({...move,quantity:Number(event.target.value)})}/></Field><Field label="Descartes"><input type="number" min="0" value={move.discarded} onChange={event=>setMove({...move,discarded:Number(event.target.value)})}/></Field><Field label={`Peso de salida (g)${weightRequired?' *':''}`}><input type="number" min="0" required={weightRequired} value={move.outputWeight} onChange={event=>setMove({...move,outputWeight:event.target.value})}/></Field><Field label="Responsable"><input value={move.responsible} onChange={event=>setMove({...move,responsible:event.target.value})}/></Field><Field label="Observación"><textarea value={move.notes} onChange={event=>setMove({...move,notes:event.target.value})}/></Field><button className="button primary">Confirmar cambio</button></form></Card>
  </div>
  <RootedCuttingPromotionPanel state={state} update={update} batch={lot}/>
  <Card title="Balance de masa"><div className="table-scroll"><table><thead><tr><th>Etapa</th><th>Entrada</th><th>Salida</th><th>Merma</th><th>Rendimiento</th><th>Fecha</th></tr></thead><tbody>{Object.entries(ledger).map(([phase,item])=><tr key={phase}><td>{phase}</td><td>{Number(item.inputGrams).toLocaleString('es-US')} g</td><td>{Number(item.outputGrams).toLocaleString('es-US')} g</td><td>{Number(item.lossGrams).toLocaleString('es-US')} g</td><td>{item.yieldPct}%</td><td>{item.date||'—'}</td></tr>)}</tbody></table></div></Card>
  <Card title="Línea de tiempo">{state.lotEvents.filter(item=>item.lotId===lot.id).sort((a,b)=>String(b.date).localeCompare(String(a.date))).map(item=><div className="timeline-item" key={item.id}><i/><div><strong>{item.title}</strong><small>{item.date} · {item.responsible||'Sin responsable'} · {item.quantity??''}{item.outputWeight?` · ${Number(item.outputWeight).toLocaleString('es-US')} g · rendimiento ${item.yieldPct}%`:''}</small><p>{item.notes||''}</p></div></div>)}</Card>
 </>
}
