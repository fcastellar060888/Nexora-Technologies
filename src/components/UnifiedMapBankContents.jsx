import{bankTrayPositions}from'../domain/propagationAllocation.js'

export default function UnifiedMapBankContents({state,bankId,layer,selectPlant}){
 const bank=state.propagationBanks.find(value=>value.id===bankId)
 if(!bank)return null
 const positions=bankTrayPositions(bank),groups=[]
 for(const position of positions){
  const key=`${position.trayId}:${position.trayIndex}`
  let group=groups.find(item=>item.key===key)
  if(!group){
   const tray=(bank.trays||[]).find(item=>item.id===position.trayId)||{}
   group={key,tray,index:position.trayIndex,positions:[]}
   groups.push(group)
  }
  group.positions.push(position)
 }
 return <div className="unified-tray-list">{groups.map(group=>{
  const units=state.propagationUnits.filter(unit=>(unit.bankId===bank.id||unit.propagationBankId===bank.id)&&unit.trayId===group.tray.id&&Number(unit.trayIndex)===group.index&&!['Muerto','Descartado'].includes(unit.status))
  return <article className="unified-tray" key={group.key}>
   <header><strong>{group.tray.label||'Bandeja'} {group.index}</strong><span>{units.length}/{group.positions.length}</span></header>
   <div className="unified-tray-grid">{group.positions.map(position=>{
    const unit=units.find(value=>Number(value.traySlot)===position.traySlot)
    const batch=unit&&state.propagationBatches.find(value=>value.id===unit.batchId)
    return <button key={position.traySlot} type="button" className={`unified-cutting-cell ${unit?'occupied':'empty'}`} title={unit?`${unit.code} · ${unit.status}`:`Posición ${position.traySlot} libre`} onClick={event=>{event.stopPropagation();if(unit)selectPlant({kind:'cutting',unit,batch,bank,tray:{...group.tray,index:group.index},slot:position.traySlot})}}>{unit?(layer==='Genética'?state.genetics.find(genetic=>genetic.id===batch?.geneticId)?.name?.slice(0,2)||'E':layer==='Fase'?batch?.phase?.slice(0,2)||'E':position.traySlot):''}</button>
   })}</div>
  </article>
 })}{!groups.length&&<div className="inline-empty">Sin bandejas configuradas</div>}</div>
}
