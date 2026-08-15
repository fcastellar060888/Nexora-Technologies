const list=value=>Array.isArray(value)?value:[]
const now=()=>new Date().toISOString()

export function activeBedPositions(state,bedId){
 return list(state?.plantPositions).filter(position=>position?.bedId===bedId&&position?.active!==false&&position?.status!=='Vacía')
}

export function archiveBed(state,bedId,{archivedAt=now()}={}){
 const bed=list(state?.beds).find(item=>item?.id===bedId)
 if(!bed)throw new Error('La cama no existe')
 if(bed.active===false)return state
 const occupied=activeBedPositions(state,bedId)
 if(occupied.length)throw new Error(`La cama tiene ${occupied.length} posición${occupied.length===1?'':'es'} activa${occupied.length===1?'':'s'}`)
 return{...state,beds:list(state.beds).map(item=>item.id===bedId?{...item,active:false,archivedAt}:item)}
}

export function livePropagationUnits(state,bankId){
 return list(state?.propagationUnits).filter(unit=>(unit?.bankId===bankId||unit?.propagationBankId===bankId)&&!['Muerto','Descartado','Promovido','Trasplantado'].includes(unit?.status))
}

export function activePropagationBatches(state,bankId){
 return list(state?.propagationBatches).filter(batch=>(batch?.bankId===bankId||batch?.propagationBankId===bankId)&&batch?.active!==false&&!['Completado','Cerrado','Descartado','Promovido'].includes(batch?.status)&&!['Completado','Cerrado'].includes(batch?.phase))
}

export function archivePropagationBank(state,bankId,{archivedAt=now()}={}){
 const bank=list(state?.propagationBanks).find(item=>item?.id===bankId)
 if(!bank)throw new Error('El banco de propagación no existe')
 if(bank.active===false)return state
 const units=livePropagationUnits(state,bankId)
 if(units.length)throw new Error(`El banco tiene ${units.length} esqueje${units.length===1?'':'s'} activo${units.length===1?'':'s'}`)
 const batches=activePropagationBatches(state,bankId)
 if(batches.length)throw new Error(`El banco tiene ${batches.length} lote${batches.length===1?'':'s'} activo${batches.length===1?'':'s'}`)
 return{...state,propagationBanks:list(state.propagationBanks).map(item=>item.id===bankId?{...item,active:false,archivedAt}:item)}
}

export function assertBankCapacity(bank,units=[]){
 const capacity=list(bank?.trays).reduce((sum,tray)=>sum+Math.max(0,Number(tray?.quantity||0))*Math.max(0,Number(tray?.cellsPerTray||0)),0)
 const occupied=list(units).filter(unit=>(unit?.bankId===bank?.id||unit?.propagationBankId===bank?.id)&&!['Muerto','Descartado','Promovido','Trasplantado'].includes(unit?.status)).length
 if(capacity<occupied)throw new Error(`La capacidad configurada (${capacity}) no puede ser menor que la ocupación activa (${occupied})`)
 return Object.freeze({capacity,occupied,available:Math.max(0,capacity-occupied)})
}
