const activeUnit=unit=>!['Muerto','Descartado'].includes(unit.status)

export function bankTrayPositions(bank){
 const positions=[]
 for(const tray of bank?.trays||[]){
  const quantity=Math.max(0,Number(tray.quantity)||0)
  const cells=Math.max(0,Number(tray.cellsPerTray??tray.cells)||0)
  for(let trayIndex=1;trayIndex<=quantity;trayIndex+=1){
   for(let traySlot=1;traySlot<=cells;traySlot+=1){
    positions.push({bankId:bank.id,trayId:tray.id,trayIndex,traySlot})
   }
  }
 }
 return positions
}

export function occupiedPositionKeys(units=[],bankId){
 return new Set(units.filter(unit=>unit.bankId===bankId&&activeUnit(unit)&&unit.trayId&&unit.trayIndex&&unit.traySlot).map(unit=>`${unit.trayId}:${unit.trayIndex}:${unit.traySlot}`))
}

export function availableBankPositions(bank,units=[]){
 const occupied=occupiedPositionKeys(units,bank?.id)
 return bankTrayPositions(bank).filter(position=>!occupied.has(`${position.trayId}:${position.trayIndex}:${position.traySlot}`))
}

export function allocateUnitsToBank(units,bank,existingUnits=[]){
 if(!bank?.id)throw new Error('Selecciona un banco de propagación válido.')
 const positions=availableBankPositions(bank,existingUnits)
 if(units.length>positions.length)throw new Error(`El banco ${bank.name||''} solo tiene ${positions.length} posiciones libres.`)
 return units.map((unit,index)=>({...unit,...positions[index]}))
}

export function bankOccupancy(bank,units=[]){
 const capacity=bankTrayPositions(bank).length
 const occupied=units.filter(unit=>unit.bankId===bank?.id&&activeUnit(unit)).length
 return{capacity,occupied,available:Math.max(0,capacity-occupied),percent:capacity?occupied/capacity*100:0}
}
