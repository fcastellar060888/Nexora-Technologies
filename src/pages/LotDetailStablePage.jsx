import{useEffect,useState}from'react'
import{useParams}from'react-router-dom'
import Card from'../components/Card'
import Field from'../components/Field'
import PageHeader from'../components/PageHeader'
import RootedCuttingPromotionPanel from'../components/RootedCuttingPromotionPanel.jsx'
import{useStore}from'../services/store'
import{LOT_PHASES,dateOnly,lotTiming,nextPhase,survivalMetrics}from'../domain/lifecycle'
import{advanceProductionLot,phaseOutput}from'../domain/production'
import{canonicalPostharvestLotDetail}from'../domain/postharvestDetail.js'

const POSTHARVEST_PHASES=new Set(['Cosecha','Secado','Manicura','Selección','Empaque','Finalizado'])
const commandFor=(organizationId,lot)=>({organizationId,siteId:lot?.siteId||'',eventId:crypto.randomUUID(),phase:lot&&lot.phase!=='Finalizado'?nextPhase(lot.phase):'',date:dateOnly(),quantity:lot?.activeQuantity??lot?.quantity??0,discarded:0,inputWeight:'',outputWeight:'',responsible:'',notes:''})

export default function LotDetailStablePage(){
 const{lotId}=useParams(),{state,update}=useStore()
 let detail=null,detailError=''
 try{detail=canonicalPostharvestLotDetail(state,lotId)}catch(error){detailError=error.message}
 const lot=detail?.lot||null
 const[move,setMove]=useState(()=>commandFor(detail?.organizationId||'',lot))
 useEffect(()=>{if(lot)setMove(commandFor(detail.organizationId,lot))},[detail?.organizationId,lot?.id,lot?.phase])
 if(!lot)return <Card>{detailError||'El lote no existe dentro de la empresa activa.'}</Card>
 const units=detail.units,metrics=survivalMetrics(units),timing=lotTiming(state,lot),mother=detail.mother,grand=detail.grandmother,genetic=detail.genetic,ledger=lot.productionLedger||{},terminal=lot.phase==='Finalizado'
 const weightRequired=POSTHARVEST_PHASES.has(move.phase),harvestInputRequired=move.phase==='Cosecha'
 function advance(event){event.preventDefault();try{update(store=>advanceProductionLot(store,{lotId:lot.id,...move}),{module:'Producción',action:`Cambio ${lot.phase} → ${move.phase}`,detail:lot.code});setMove(current=>({...current,eventId:crypto.randomUUID(),inputWeight:'',outputWeight:'',discarded:0}))}catch(error){alert(error.message)}}
 return <>
  <PageHeader title={lot.code||lot.id} subtitle="Un solo lote desde esquejes hasta producto terminado, con balance de masa y tenancy por etapa."/>
  <div className="kpi-grid">{[['Fase',lot.phase],['Semana',timing.week],['Día',`${timing.elapsed}/${timing.objective}`],['Restantes',timing.remaining],['Vivos',lot.activeQuantity??metrics.alive],['Cosecha',`${phaseOutput(lot,'Cosecha').toLocaleString('es-US')} g`],['Empaque',`${phaseOutput(lot,'Empaque').toLocaleString('es-US')} g`]].map(([label,value])=><Card className="kpi-card" key={label}><span>{label}</span><strong>{value}</strong></Card>)}</div>
  <div className="content-grid two">
   <Card title="Genealogía"><div className="detail-grid"><div><span>Lote abuelas</span><strong>{grand?.lotCode||'—'}</strong></div><div><span>Lote madres</span><strong>{mother?.lotCode||'—'}</strong></div><div><span>Genética</span><strong>{genetic?.name||'—'}</strong></div><div><span>Fecha de corte</span><strong>{lot.cutDate||'—'}</strong></div></div></Card>
   <Card title="Cambiar fase">{terminal?<p className="auth-status">El lote está Finalizado. La fase terminal no admite nuevas transiciones.</p>:<form className="form-grid" onSubmit={advance}><Field label="Nueva fase"><input readOnly value={move.phase}/></Field><Field label="Fecha efectiva"><input type="date" value={move.date} onChange={event=>setMove({...move,date:event.target.value})}/></Field><Field label="Cantidad que avanza"><input type="number" min="0" max={lot.activeQuantity??lot.quantity??undefined} value={move.quantity} onChange={event=>setMove({...move,quantity:Number(event.target.value)})}/></Field><Field label="Descartes"><input type="number" min="0" max={move.quantity} value={move.discarded} onChange={event=>setMove({...move,discarded:Number(event.target.value)})}/></Field>{harvestInputRequired&&<Field label="Peso húmedo cosechado (g) *"><input type="number" min="0.01" step=".01" required value={move.inputWeight} onChange={event=>setMove({...move,inputWeight:event.target.value})}/></Field>}<Field label={`Peso de salida (g)${weightRequired?' *':''}`}><input type="number" min="0" required={weightRequired} value={move.outputWeight} onChange={event=>setMove({...move,outputWeight:event.target.value})}/></Field><Field label="Responsable"><input value={move.responsible} onChange={event=>setMove({...move,responsible:event.target.value})}/></Field><Field label="Observación"><textarea value={move.notes} onChange={event=>setMove({...move,notes:event.target.value})}/></Field><button className="button primary">Confirmar cambio canónico</button></form>}</Card>
  </div>
  {LOT_PHASES.indexOf(lot.phase)<LOT_PHASES.indexOf('Cosecha')&&<RootedCuttingPromotionPanel state={state} update={update} batch={lot}/>} 
  <Card title="Balance de masa"><div className="table-scroll"><table><thead><tr><th>Etapa</th><th>Entrada</th><th>Salida</th><th>Merma</th><th>Rendimiento</th><th>Fecha</th></tr></thead><tbody>{Object.entries(ledger).map(([phase,item])=><tr key={phase}><td>{phase}</td><td>{Number(item.inputGrams).toLocaleString('es-US')} g</td><td>{Number(item.outputGrams).toLocaleString('es-US')} g</td><td>{Number(item.lossGrams).toLocaleString('es-US')} g</td><td>{item.yieldPct}%</td><td>{item.date||'—'}</td></tr>)}</tbody></table></div></Card>
  <Card title="Línea de tiempo">{[...detail.events].sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))).map(item=><div className="timeline-item" key={`${item.organizationId}:${item.id}`}><i/><div><strong>{item.title}</strong><small>{item.date} · {item.responsible||'Sin responsable'} · {item.quantity??''}{item.outputWeight?` · ${Number(item.outputWeight).toLocaleString('es-US')} g · rendimiento ${item.yieldPct}%`:''}</small><p>{item.notes||''}</p></div></div>)}</Card>
 </>
}
