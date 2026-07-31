import{useMemo,useRef,useState}from'react'
import{useNavigate}from'react-router-dom'
import Card from'../components/Card'
import Field from'../components/Field'
import PageHeader from'../components/PageHeader'
import{useStore}from'../services/store'
import{lotTiming}from'../domain/lifecycle'

const clamp=(value,min,max)=>Math.min(max,Math.max(min,Number(value)||0))
const objectKey=(type,id)=>`${type}:${id}`

export default function CultivationMapPage(){
 const{state,update}=useStore()
 const navigate=useNavigate()
 const[siteId,setSiteId]=useState(state.sites[0]?.id||'')
 const[selected,setSelected]=useState(null)
 const[edit,setEdit]=useState(false)
 const[layer,setLayer]=useState('Lote')
 const drag=useRef(null)
 const houses=state.houses.filter(x=>x.siteId===siteId)
 const banks=state.propagationBanks.filter(x=>x.siteId===siteId&&x.active!==false)
 const elements=[...houses.map(x=>({type:'house',id:x.id,name:x.name})),...banks.map(x=>({type:'bank',id:x.id,name:x.name}))]

 function layout(type,id,index){
  return state.mapElements.find(x=>x.siteId===siteId&&x.entityType===type&&x.entityId===id)||{
   x:30+(index%3)*230,y:30+Math.floor(index/3)*170,width:205,height:135,rotation:0
  }
 }
 function persist(type,id,patch,index=0){
  const current=layout(type,id,index)
  update(s=>{
   const found=s.mapElements.find(x=>x.siteId===siteId&&x.entityType===type&&x.entityId===id)
   return{...s,mapElements:found?s.mapElements.map(x=>x.id===found.id?{...x,...patch}:x):[...s.mapElements,{id:crypto.randomUUID(),siteId,entityType:type,entityId:id,...current,...patch}]}
  },{audit:false})
 }
 function startMove(e,item,index){
  if(!edit)return
  const current=layout(item.type,item.id,index)
  drag.current={item,index,startX:e.clientX,startY:e.clientY,x:current.x,y:current.y}
  e.currentTarget.setPointerCapture?.(e.pointerId)
 }
 function move(e){
  if(!drag.current)return
  const d=drag.current
  persist(d.item.type,d.item.id,{x:Math.max(0,d.x+e.clientX-d.startX),y:Math.max(0,d.y+e.clientY-d.startY)},d.index)
 }
 function stopMove(){drag.current=null}
 function addBank(){
  const id=crypto.randomUUID(),number=banks.length+1
  update(s=>({...s,propagationBanks:[...s.propagationBanks,{id,siteId,name:`Banco ${number}`,rows:4,positionsPerRow:25,capacity:100,active:true}]}),{module:'Mapa',action:'Banco creado',detail:`Banco ${number}`})
  setSelected({type:'bank',id})
 }
 function lotsFor(item){
  if(item.type==='bank')return state.propagationBatches.filter(x=>x.siteId===siteId&&x.phase==='Propagación')
  const beds=state.beds.filter(x=>x.houseId===item.id)
  const lotIds=new Set(beds.flatMap(b=>b.lotId?[b.lotId]:[]))
  return state.propagationBatches.filter(x=>lotIds.has(x.id)||x.houseId===item.id)
 }
 function objectSubtitle(item,lots){
  if(item.type==='bank')return`${state.propagationBanks.find(x=>x.id===item.id)?.capacity||0} posiciones`
  const beds=state.beds.filter(x=>x.houseId===item.id),plants=state.plantPositions.filter(p=>beds.some(b=>b.id===p.bedId)&&p.active)
  return`${beds.length} camas · ${plants.length} plantas`
 }
 function visualClass(item,lots){
  if(layer==='MIPE'&&item.type==='house'){
   const bedIds=state.beds.filter(b=>b.houseId===item.id).map(b=>b.id)
   const plantIds=state.plantPositions.filter(p=>bedIds.includes(p.bedId)).map(p=>p.id)
   const severe=state.findings.some(f=>plantIds.includes(f.plantPositionId)&&Number(f.severity)>=3&&!['Resuelto','Falso positivo'].includes(f.status))
   return severe?'risk':''
  }
  if(layer==='Fase'&&lots.some(l=>lotTiming(state,l).remaining<0))return'risk'
  return''
 }
 return <>
  <PageHeader title="Mapa del cultivo" subtitle="Un único plano editable para ubicar naves, bancos, camas, plantas, lotes y alertas."/>
  <Card><div className="form-grid map-toolbar">
   <Field label="Sede"><select value={siteId} onChange={e=>{setSiteId(e.target.value);setSelected(null)}}>{state.sites.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
   <Field label="Capa"><select value={layer} onChange={e=>setLayer(e.target.value)}>{['Lote','Fase','Genética','MIPE'].map(x=><option key={x}>{x}</option>)}</select></Field>
   <div className="field"><span>Editar plano</span><button className={`button ${edit?'warning':'secondary'}`} onClick={()=>setEdit(!edit)}>{edit?'Finalizar movimientos':'Mover elementos'}</button></div>
   <div className="field"><span>Propagación</span><button className="button secondary" onClick={addBank}>Agregar banco</button></div>
  </div></Card>
  <Card title="Plano general" subtitle="Arrastra los elementos con edición activada. Selecciona uno para ajustar tamaño y rotación.">
   <div className="map-legend"><span><i className="legend-house"/>Nave</span><span><i className="legend-bank"/>Banco</span><span><i className="legend-risk"/>Requiere atención</span></div>
   <div className={`cultivation-canvas ${edit?'editing':''}`} onPointerMove={move} onPointerUp={stopMove} onPointerCancel={stopMove}>
    {elements.map((item,index)=>{
     const current=layout(item.type,item.id,index),lots=lotsFor(item),timing=lots[0]?lotTiming(state,lots[0]):null
     return <button key={objectKey(item.type,item.id)} className={`map-object ${item.type} ${visualClass(item,lots)} ${selected?.type===item.type&&selected?.id===item.id?'selected':''}`} style={{left:current.x,top:current.y,width:current.width,height:current.height,transform:`rotate(${current.rotation||0}deg)`}} onPointerDown={e=>startMove(e,item,index)} onClick={()=>setSelected(item)}>
      <strong>{item.name}</strong><small>{objectSubtitle(item,lots)}</small>
      {lots.length?<><span>{lots.length} lote{lots.length===1?'':'s'}</span><b>{lots[0].code} · {layer==='Fase'?`${lots[0].phase} S${timing?.week}`:layer==='Genética'?state.genetics.find(g=>g.id===lots[0].geneticId)?.name||'Sin genética':lots[0].phase}</b></>:<span>Sin lote asignado</span>}
     </button>
    })}
    {!elements.length&&<p className="empty-canvas">Crea naves o bancos de propagación para empezar el plano.</p>}
   </div>
  </Card>
  {selected&&<aside className="map-side-panel"><button className="map-side-close" onClick={()=>setSelected(null)}>Cerrar</button><ObjectSummary state={state} item={selected}/><MapObjectInspector state={state} item={selected} siteId={siteId} elements={elements} layout={layout} persist={persist}/></aside>}
  {selected?.type==='house'&&<HouseInterior state={state} update={update} houseId={selected.id} navigate={navigate}/>} 
  {selected?.type==='bank'&&<BankEditor state={state} update={update} bankId={selected.id}/>} 
 </>
}

function ObjectSummary({state,item}){
 const lots=item.type==='bank'?state.propagationBatches.filter(x=>x.siteId===state.propagationBanks.find(b=>b.id===item.id)?.siteId&&x.phase==='Propagación'):state.propagationBatches.filter(x=>state.beds.some(b=>b.houseId===item.id&&b.lotId===x.id)||x.houseId===item.id)
 return <Card title={item.type==='house'?'Resumen de nave':'Resumen de banco'}><div className="detail-grid"><div><span>Elemento</span><strong>{item.name}</strong></div><div><span>Lotes</span><strong>{lots.length}</strong></div><div><span>Fases</span><strong>{[...new Set(lots.map(x=>x.phase))].join(', ')||'—'}</strong></div><div><span>Semanas</span><strong>{lots.map(x=>`S${lotTiming(state,x).week}`).join(', ')||'—'}</strong></div></div></Card>
}

function MapObjectInspector({state,item,elements,layout,persist}){
 const index=elements.findIndex(x=>x.type===item.type&&x.id===item.id),current=layout(item.type,item.id,index)
 return <Card title="Posición y tamaño" subtitle="Ajuste preciso del elemento seleccionado."><div className="form-grid compact-five">
  <Field label="X"><input type="number" value={Math.round(current.x)} onChange={e=>persist(item.type,item.id,{x:clamp(e.target.value,0,3000)},index)}/></Field>
  <Field label="Y"><input type="number" value={Math.round(current.y)} onChange={e=>persist(item.type,item.id,{y:clamp(e.target.value,0,3000)},index)}/></Field>
  <Field label="Ancho"><input type="number" min="120" value={Math.round(current.width)} onChange={e=>persist(item.type,item.id,{width:clamp(e.target.value,120,900)},index)}/></Field>
  <Field label="Alto"><input type="number" min="90" value={Math.round(current.height)} onChange={e=>persist(item.type,item.id,{height:clamp(e.target.value,90,700)},index)}/></Field>
  <Field label="Rotación"><select value={current.rotation||0} onChange={e=>persist(item.type,item.id,{rotation:Number(e.target.value)},index)}>{[0,90,180,270].map(x=><option key={x} value={x}>{x}°</option>)}</select></Field>
 </div></Card>
}

function HouseInterior({state,update,houseId,navigate}){
 const house=state.houses.find(x=>x.id===houseId),beds=state.beds.filter(x=>x.houseId===houseId).sort((a,b)=>(a.order||0)-(b.order||0))
 const[moving,setMoving]=useState(false),[selectedBed,setSelectedBed]=useState(null),drag=useRef(null)
 function pos(b,index){return b.mapX!=null?{x:b.mapX,y:b.mapY,width:b.mapWidth||280,height:b.mapHeight||125,rotation:b.mapRotation||0}:{x:20+(index%2)*320,y:20+Math.floor(index/2)*155,width:290,height:125,rotation:0}}
 function start(e,b,index){if(!moving)return;const p=pos(b,index);drag.current={b,index,startX:e.clientX,startY:e.clientY,x:p.x,y:p.y};e.currentTarget.setPointerCapture?.(e.pointerId)}
 function move(e){if(!drag.current)return;const d=drag.current;update(s=>({...s,beds:s.beds.map(x=>x.id===d.b.id?{...x,mapX:Math.max(0,d.x+e.clientX-d.startX),mapY:Math.max(0,d.y+e.clientY-d.startY)}:x)}),{audit:false})}
 function setBed(id,patch){update(s=>({...s,beds:s.beds.map(x=>x.id===id?{...x,...patch}:x)}),{module:'Mapa',action:'Cama ajustada',detail:state.beds.find(x=>x.id===id)?.name||id})}
 return <Card title={`Interior · ${house?.name}`} subtitle="Las plantas se muestran con las mismas filas y posiciones configuradas.">
  <div className="actions"><button className={`button ${moving?'warning':'secondary'}`} onClick={()=>setMoving(!moving)}>{moving?'Finalizar camas':'Mover camas'}</button></div>
  <div className="house-interior" onPointerMove={move} onPointerUp={()=>drag.current=null} onPointerCancel={()=>drag.current=null}>
   {beds.map((bed,index)=>{
    const p=pos(bed,index),plants=state.plantPositions.filter(x=>x.bedId===bed.id).sort((a,z)=>a.row-z.row||a.position-z.position),lot=state.propagationBatches.find(x=>x.id===bed.lotId)
    return <button key={bed.id} className={`bed-object ${selectedBed===bed.id?'selected':''}`} style={{left:p.x,top:p.y,width:p.width,height:p.height,transform:`rotate(${p.rotation}deg)`}} onPointerDown={e=>start(e,bed,index)} onClick={()=>setSelectedBed(bed.id)}>
     <div className="bed-object-head"><strong>{bed.name}</strong><small>{bed.rows} filas × {bed.plantsPerRow} · {plants.filter(x=>x.active).length} activas</small>{lot&&<b>{lot.code} · {lot.phase} · S{lotTiming(state,lot).week}</b>}</div>
     <div className="map-plant-scroll"><div className="map-plant-grid" style={{gridTemplateColumns:`repeat(${bed.plantsPerRow},7px)`}}>{plants.map(plant=><i key={plant.id} className={plant.active?'':'empty'} title={`F${plant.row} P${plant.position}`} onDoubleClick={()=>navigate(`/plant/${plant.id}`)}/>)}</div></div>
    </button>
   })}
  </div>
  {selectedBed&&<BedInspector state={state} bed={state.beds.find(x=>x.id===selectedBed)} setBed={setBed}/>} 
 </Card>
}

function BedInspector({state,bed,setBed}){
 if(!bed)return null
 return <div className="bed-inspector"><h4>Configurar {bed.name}</h4><div className="form-grid compact-five">
  <Field label="Lote"><select value={bed.lotId||''} onChange={e=>setBed(bed.id,{lotId:e.target.value})}><option value="">Sin lote</option>{state.propagationBatches.map(x=><option key={x.id} value={x.id}>{x.code} · {x.phase}</option>)}</select></Field>
  <Field label="Orden"><input type="number" value={bed.order||0} onChange={e=>setBed(bed.id,{order:Number(e.target.value)})}/></Field>
  <Field label="Ancho visual"><input type="number" min="180" value={bed.mapWidth||280} onChange={e=>setBed(bed.id,{mapWidth:clamp(e.target.value,180,900)})}/></Field>
  <Field label="Alto visual"><input type="number" min="100" value={bed.mapHeight||125} onChange={e=>setBed(bed.id,{mapHeight:clamp(e.target.value,100,600)})}/></Field>
  <Field label="Rotación"><select value={bed.mapRotation||0} onChange={e=>setBed(bed.id,{mapRotation:Number(e.target.value)})}>{[0,90,180,270].map(x=><option key={x} value={x}>{x}°</option>)}</select></Field>
 </div></div>
}

function BankEditor({state,update,bankId}){
 const bank=state.propagationBanks.find(x=>x.id===bankId)
 if(!bank)return null
 function set(patch){update(s=>({...s,propagationBanks:s.propagationBanks.map(x=>x.id===bankId?{...x,...patch,capacity:Number(patch.rows??x.rows)*Number(patch.positionsPerRow??x.positionsPerRow)}:x)}),{module:'Mapa',action:'Banco actualizado',detail:bank.name})}
 const lots=state.propagationBatches.filter(x=>x.phase==='Propagación'&&x.siteId===bank.siteId)
 return <Card title={`Banco · ${bank.name}`} subtitle={`${lots.length} lotes de propagación disponibles en la sede.`}><div className="form-grid">
  <Field label="Nombre"><input value={bank.name} onChange={e=>set({name:e.target.value})}/></Field>
  <Field label="Filas"><input type="number" min="1" value={bank.rows} onChange={e=>set({rows:Number(e.target.value)})}/></Field>
  <Field label="Posiciones por fila"><input type="number" min="1" value={bank.positionsPerRow} onChange={e=>set({positionsPerRow:Number(e.target.value)})}/></Field>
  <Field label="Capacidad"><input readOnly value={bank.capacity}/></Field>
  <Field label="Lote asignado"><select value={bank.lotId||''} onChange={e=>set({lotId:e.target.value})}><option value="">Sin lote</option>{lots.map(x=><option key={x.id} value={x.id}>{x.code} · Semana {lotTiming(state,x).week}</option>)}</select></Field>
 </div><div className="bank-grid-scroll"><div className="bank-grid" style={{gridTemplateColumns:`repeat(${bank.positionsPerRow},8px)`}}>{Array.from({length:bank.capacity},(_,i)=><i key={i}/>)}</div></div></Card>
}
