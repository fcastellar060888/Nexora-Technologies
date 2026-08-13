import{bankOccupancy}from'../domain/propagationAllocation.js'

export default function UnifiedMapObjectMetrics({state,item}){
 if(item.type==='house'){
  const beds=state.beds.filter(bed=>bed.houseId===item.id&&bed.active!==false)
  const plants=state.plantPositions.filter(plant=>beds.some(bed=>bed.id===plant.bedId)&&plant.active!==false)
  return <small>{beds.length} camas · {plants.length} plantas</small>
 }
 const bank=state.propagationBanks.find(value=>value.id===item.id)
 const metrics=bankOccupancy(bank,state.propagationUnits)
 return <small>{(bank?.trays||[]).reduce((sum,tray)=>sum+Number(tray.quantity||0),0)} bandejas · {metrics.occupied}/{metrics.capacity} esquejes</small>
}
