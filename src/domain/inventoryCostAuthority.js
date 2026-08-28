const text=value=>String(value??'').trim()
const finiteNonNegative=(value,label)=>{const number=Number(value);if(!Number.isFinite(number)||number<0)throw new Error(`${label} debe ser un número finito no negativo.`);return number}
const money=value=>Math.round((Number(value)+Number.EPSILON)*1000000)/1000000

export function inventoryMovementCost(movement){
 if(!movement?.id)throw new Error('El movimiento de inventario debe tener identidad para respaldar un costo.')
 const quantity=Math.abs(Number(movement.quantity))
 if(!Number.isFinite(quantity)||quantity<=0)throw new Error('La cantidad del movimiento debe ser finita y mayor que cero para respaldar un costo.')
 const unitCost=finiteNonNegative(movement.unitCost,'El costo unitario congelado')
 return money(quantity*unitCost)
}

export function movementBackedCostEntry(movement,entry={}){
 const amount=inventoryMovementCost(movement)
 const organizationId=text(movement.organizationId)
 if(!organizationId)throw new Error('El movimiento debe pertenecer a una organización para respaldar un costo.')
 if(entry.organizationId&&text(entry.organizationId)!==organizationId)throw new Error('El CostEntry no puede cruzar organizaciones respecto del movimiento.')
 return Object.freeze({...entry,organizationId,amount,inventoryMovementId:String(movement.id),inventoryMovementIds:[String(movement.id)]})
}

export function movementsBackedCostEntry(movements,entry={}){
 if(!Array.isArray(movements)||movements.length===0)throw new Error('El CostEntry agregado requiere al menos un movimiento de inventario.')
 const ids=new Set(),organizations=new Set()
 let amount=0
 for(const movement of movements){
  const id=text(movement?.id)
  if(!id||ids.has(id))throw new Error('Los movimientos que respaldan un costo deben tener identidades únicas.')
  ids.add(id)
  const organizationId=text(movement?.organizationId)
  if(!organizationId)throw new Error('Todo movimiento que respalda un costo debe pertenecer a una organización.')
  organizations.add(organizationId)
  amount+=inventoryMovementCost(movement)
 }
 if(organizations.size!==1)throw new Error('Un CostEntry no puede agregar movimientos de organizaciones distintas.')
 const organizationId=[...organizations][0]
 if(entry.organizationId&&text(entry.organizationId)!==organizationId)throw new Error('El CostEntry no puede cruzar organizaciones respecto de sus movimientos.')
 const inventoryMovementIds=[...ids]
 return Object.freeze({...entry,organizationId,amount:money(amount),inventoryMovementIds})
}

export function assertMovementBackedCostEntry(entry,movements){
 const expected=movementsBackedCostEntry(movements,{organizationId:entry?.organizationId})
 const actualIds=Array.isArray(entry?.inventoryMovementIds)?entry.inventoryMovementIds.map(String):entry?.inventoryMovementId?[String(entry.inventoryMovementId)]:[]
 if(actualIds.length!==expected.inventoryMovementIds.length||actualIds.some((id,index)=>id!==expected.inventoryMovementIds[index]))throw new Error('El CostEntry contradice los movimientos de inventario que declara como evidencia.')
 if(money(entry?.amount)!==expected.amount)throw new Error('El importe del CostEntry contradice el costo congelado en el kardex.')
 return expected
}
