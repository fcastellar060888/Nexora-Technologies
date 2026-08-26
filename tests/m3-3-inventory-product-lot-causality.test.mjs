import test from'node:test'
import assert from'node:assert/strict'
import{assertInventoryProductTechnicalAuthority,inventoryLotUnitFromProduct,assertInventoryLotProductCausality}from'../src/domain/inventoryProductCausality.js'

test('MIPE executable product requires inventory unit compatible with dose unit',()=>{
 assert.equal(assertInventoryProductTechnicalAuthority({category:'MIPE',unit:'mL',doseUnit:'mL/L'}).unit,'mL')
 assert.throws(()=>assertInventoryProductTechnicalAuthority({category:'MIPE',unit:'L',doseUnit:'mL/L'}),/unidad de inventario debe ser mL/)
 assert.throws(()=>assertInventoryProductTechnicalAuthority({category:'Biológico',unit:'kg',doseUnit:'g\/100 L'}),/unidad de inventario debe ser g/)
})

test('lot unit is derived from Product and hostile override fails closed',()=>{
 const product={category:'MIPE',unit:'mL',doseUnit:'mL/L'}
 assert.equal(inventoryLotUnitFromProduct(product),'mL')
 assert.equal(inventoryLotUnitFromProduct(product,'mL'),'mL')
 assert.throws(()=>inventoryLotUnitFromProduct(product,'g'),/contradice la unidad técnica/)
})

test('Product remains technical authority when a persisted Lot contradicts its unit',()=>{
 const product={category:'MIRFE',unit:'kg',doseUnit:'g/L'}
 assert.equal(assertInventoryLotProductCausality(product,{unit:'kg'}),'kg')
 assert.throws(()=>assertInventoryLotProductCausality(product,{unit:'g'}),/contradice la unidad técnica/)
 assert.throws(()=>assertInventoryLotProductCausality(product,{}),/no congela la unidad técnica/)
})
