const text=value=>String(value??'').trim()
const EXECUTABLE_MIPE=new Set(['MIPE','Biológico','Adyuvante'])
const INVENTORY_UNITS=new Set(['mL','L','g','kg','unidad'])

export function expectedInventoryUnit(doseUnit){
 const value=text(doseUnit)
 if(value.startsWith('mL'))return'mL'
 if(value.startsWith('g'))return'g'
 return''
}

export function assertInventoryProductTechnicalAuthority(product){
 if(!product||typeof product!=='object')throw new Error('El producto de inventario es obligatorio.')
 const unit=text(product.unit),category=text(product.category),doseUnit=text(product.doseUnit)
 if(!INVENTORY_UNITS.has(unit))throw new Error('La unidad de inventario del producto no es válida.')
 if(EXECUTABLE_MIPE.has(category)){
  const expected=expectedInventoryUnit(doseUnit)
  if(!expected||unit!==expected)throw new Error(`La unidad de inventario debe ser ${expected||'compatible'} para ${doseUnit||'la dosis configurada'}.`)
 }
 return Object.freeze({unit,category,doseUnit})
}

export function inventoryLotUnitFromProduct(product,inputUnit=''){
 const technical=assertInventoryProductTechnicalAuthority(product),requested=text(inputUnit)
 if(requested&&requested!==technical.unit)throw new Error('La unidad del lote contradice la unidad técnica del producto.')
 return technical.unit
}

export function assertInventoryLotProductCausality(product,lot){
 const expected=inventoryLotUnitFromProduct(product)
 const actual=text(lot?.unit)
 if(!actual)throw new Error('El lote no congela la unidad técnica del producto.')
 if(actual!==expected)throw new Error('La unidad del lote contradice la unidad técnica del producto.')
 return expected
}
