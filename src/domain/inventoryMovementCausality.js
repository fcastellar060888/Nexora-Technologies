const text=value=>String(value??'').trim()
const finiteNonNegative=(value,label)=>{const number=Number(value??0);if(!Number.isFinite(number)||number<0)throw new Error(`${label} debe ser un número finito no negativo.`);return number}

export function inventoryMovementSnapshot(product,lot,{sourceType='Manual',sourceId=''}={}){
 const unit=text(lot?.unit||product?.unit)
 if(!unit)throw new Error('El movimiento no puede congelar una unidad técnica vacía.')
 if(text(lot?.unit)&&text(product?.unit)&&text(lot.unit)!==text(product.unit))throw new Error('El movimiento no puede nacer de Product/Lot con unidades contradictorias.')
 const origin=text(sourceType)
 if(!origin)throw new Error('sourceType es obligatorio para todo movimiento de inventario.')
 const originId=text(sourceId)
 if(origin!=='Manual'&&!originId)throw new Error('sourceId es obligatorio para movimientos con origen operativo.')
 return Object.freeze({unit,unitCost:finiteNonNegative(product?.cost,'El costo unitario'),sourceType:origin,sourceId:originId})
}

export function assertInventoryMovementCausality(product,lot,movement){
 const snapshot=inventoryMovementSnapshot(product,lot,{sourceType:movement?.sourceType,sourceId:movement?.sourceId})
 if(text(movement?.unit)!==snapshot.unit)throw new Error('El movimiento contradice la unidad técnica congelada.')
 if(Number(movement?.unitCost)!==snapshot.unitCost)throw new Error('El movimiento contradice el costo unitario congelado.')
 return snapshot
}
