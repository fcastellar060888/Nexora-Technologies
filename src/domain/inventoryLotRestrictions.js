const text=value=>String(value??'').trim()
const RESTRICTED_TYPES=new Set(['Salida','Consumo'])
const DISPOSAL_TYPES=new Set(['Baja','Vencimiento'])

function operationalDate(value){
 const raw=text(value)
 if(!/^\d{4}-\d{2}-\d{2}$/.test(raw))throw new Error('La fecha operacional de inventario debe usar formato YYYY-MM-DD.')
 const parsed=new Date(`${raw}T00:00:00.000Z`)
 if(Number.isNaN(parsed.getTime())||parsed.toISOString().slice(0,10)!==raw)throw new Error('La fecha operacional de inventario no es válida.')
 return raw
}

function expiryDate(value){
 const raw=text(value)
 if(!raw)return''
 if(!/^\d{4}-\d{2}-\d{2}$/.test(raw))throw new Error('La fecha de vencimiento del lote no es válida.')
 const parsed=new Date(`${raw}T00:00:00.000Z`)
 if(Number.isNaN(parsed.getTime())||parsed.toISOString().slice(0,10)!==raw)throw new Error('La fecha de vencimiento del lote no es válida.')
 return raw
}

export function assertInventoryLotMovementAllowed(lot,{type,date}={}){
 const movementType=text(type),onDate=operationalDate(date),expires=expiryDate(lot?.expiryDate)
 if(!expires)return{operationalDate:onDate,expiryDate:''}
 if(RESTRICTED_TYPES.has(movementType)&&onDate>expires)throw new Error(`El lote venció el ${expires} y no puede usarse para ${movementType.toLowerCase()}.`)
 return{operationalDate:onDate,expiryDate:expires,isExpired:onDate>expires,isDisposal:DISPOSAL_TYPES.has(movementType)}
}
