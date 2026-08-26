const list=value=>Array.isArray(value)?value:[]
const text=value=>String(value??'').trim()
const number=(value,label)=>{const n=Number(value);if(!Number.isFinite(n))throw new Error(`${label} no es numérico.`);return n}

function orderKey(movement){return `${text(movement?.createdAt||movement?.date)}\u0000${text(movement?.id)}`}

export function inventoryLedgerForLot(state,{organizationId,lotId}={}){
 const owner=text(organizationId),id=text(lotId)
 if(!owner)throw new Error('organizationId es obligatorio para proyectar el kardex.')
 if(!id)throw new Error('lotId es obligatorio para proyectar el kardex.')
 const rows=list(state?.inventoryMovements).filter(item=>text(item?.organizationId)===owner&&text(item?.lotId)===id)
 const ids=new Set()
 for(const row of rows){const movementId=text(row?.id);if(!movementId)throw new Error('El movimiento de inventario no tiene identidad estable.');if(ids.has(movementId))throw new Error('El kardex contiene un movimiento duplicado.');ids.add(movementId)}
 return [...rows].sort((a,b)=>orderKey(a).localeCompare(orderKey(b)))
}

export function verifyInventoryLedger(state,{organizationId,lotId}={}){
 const rows=inventoryLedgerForLot(state,{organizationId,lotId})
 let balance=0
 for(const row of rows){
  const before=number(row.balanceBefore,'balanceBefore'),signed=number(row.signedQuantity,'signedQuantity'),after=number(row.balanceAfter,'balanceAfter')
  if(before!==balance)throw new Error(`El kardex del lote ${lotId} rompe continuidad: balanceBefore no coincide con el saldo verificable.`)
  if(after!==before+signed)throw new Error(`El movimiento ${text(row.id)} contiene un balanceAfter inconsistente.`)
  if(after<0)throw new Error(`El movimiento ${text(row.id)} produce existencia negativa.`)
  balance=after
 }
 return Object.freeze({organizationId:text(organizationId),lotId:text(lotId),balance,movementCount:rows.length,lastMovementId:text(rows.at(-1)?.id)})
}

export function assertInventoryLotMatchesLedger(state,lot,{allowLegacyWithoutLedger=false}={}){
 const organizationId=text(lot?.organizationId),lotId=text(lot?.id),rows=inventoryLedgerForLot(state,{organizationId,lotId})
 if(!rows.length&&allowLegacyWithoutLedger)return Object.freeze({organizationId,lotId,balance:Number(lot?.quantity||0),movementCount:0,legacy:true})
 const verification=verifyInventoryLedger(state,{organizationId,lotId})
 if(Number(lot?.quantity||0)!==verification.balance)throw new Error(`El saldo materializado del lote ${lotId} contradice su kardex append-only.`)
 return verification
}
