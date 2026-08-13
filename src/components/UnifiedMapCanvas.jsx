import Card from'./Card'
import HouseContents from'./UnifiedMapHouseContents.jsx'
import BankContents from'./UnifiedMapBankContents.jsx'
import ObjectMetrics from'./UnifiedMapObjectMetrics.jsx'

const objectKey=(type,id)=>`${type}:${id}`

export default function UnifiedMapCanvas({state,siteId,layer,selection,selectionMode,onPlant,onCutting}){
 const houses=state.houses.filter(item=>item.siteId===siteId&&item.active!==false)
 const banks=(state.propagationBanks||[]).filter(item=>item.siteId===siteId&&item.active!==false)
 const objects=[...houses.map(item=>({type:'house',id:item.id,name:item.name})),...banks.map(item=>({type:'bank',id:item.id,name:item.name}))]
 const layout=(item,index)=>state.mapElements.find(entry=>entry.siteId===siteId&&entry.entityType===item.type&&entry.entityId===item.id)||{x:24+(index%2)*540,y:24+Math.floor(index/2)*390,width:510,height:355,rotation:0}
 return <Card title="Plano operativo" subtitle="Las camas y bandejas se muestran dentro de su nave o banco; no se crean ni se mueven desde esta pantalla.">
  <div className="map-legend"><span><i className="legend-house"/>Nave</span><span><i className="legend-bank"/>Banco</span><span><i className="legend-risk"/>Hallazgo abierto</span>{selectionMode&&<span><i className="legend-selected"/>Seleccionada</span>}</div>
  <div className="unified-cultivation-canvas">{objects.map((item,index)=>{const current=layout(item,index);return <section key={objectKey(item.type,item.id)} className={`unified-map-object ${item.type}`} style={{left:current.x,top:current.y,width:current.width,height:current.height,transform:`rotate(${current.rotation||0}deg)`}}><header className="unified-object-header"><div><span>{item.type==='house'?'Nave':'Banco de propagación'}</span><strong>{item.name}</strong></div><ObjectMetrics state={state} item={item}/></header><div className="unified-object-body">{item.type==='house'?<HouseContents state={state} houseId={item.id} layer={layer} selectPlant={onPlant} selection={selection} selectionMode={selectionMode}/>:<BankContents state={state} bankId={item.id} layer={layer} selectPlant={onCutting}/>}</div></section>})}{!objects.length&&<div className="empty-canvas"><strong>No hay infraestructura activa en esta sede</strong><span>Configura naves, camas y bancos desde Infraestructura.</span></div>}</div>
 </Card>
}
