import test from'node:test'
import assert from'node:assert/strict'
import{createInventoryLot,transactInventory}from'../src/domain/inventory.js'
import{assertInventoryProductTechnicalAuthority,inventoryLotUnitFromProduct,assertInventoryLotProductCausality}from'../src/domain/inventoryProductCausality.js'
import{INVENTORY_OPERATIONS,executeInventoryCommand}from'../src/services/inventoryCommand.js'

const base=()=>({currentContext:{companyId:'org-a',siteId:'site-a'},companies:[{id:'org-a'}],users:[{id:'u',active:true,activeSession:true,remote:true}],roles:[{id:'r',permissions:['manage_inventory']}],memberships:[{id:'m',userId:'u',companyId:'org-a',roleId:'r',siteIds:['site-a'],status:'active'}],sites:[{id:'site-a',organizationId:'org-a',companyId:'org-a'}],products:[],inventoryLots:[],inventoryMovements:[],inventoryCommandReceipts:[]})
const depsFor=holder=>({publishEvent:async event=>{holder.events.push(event);return event},commit:recipe=>{holder.state=recipe(holder.state)}})

test('F006 MIPE executable product requires inventory unit compatible with dose unit',()=>{
 assert.equal(assertInventoryProductTechnicalAuthority({category:'MIPE',unit:'mL',doseUnit:'mL/L'}).unit,'mL')
 assert.throws(()=>assertInventoryProductTechnicalAuthority({category:'MIPE',unit:'L',doseUnit:'mL/L'}),/unidad de inventario debe ser mL/)
 assert.throws(()=>assertInventoryProductTechnicalAuthority({category:'Biológico',unit:'kg',doseUnit:'g\/100 L'}),/unidad de inventario debe ser g/)
})

test('F006 lot unit is derived from Product and hostile override fails closed',()=>{
 const product={category:'MIPE',unit:'mL',doseUnit:'mL/L'}
 assert.equal(inventoryLotUnitFromProduct(product),'mL')
 assert.equal(inventoryLotUnitFromProduct(product,'mL'),'mL')
 assert.throws(()=>inventoryLotUnitFromProduct(product,'g'),/contradice la unidad técnica/)
})

test('F006 Product remains technical authority when a persisted Lot contradicts its unit',()=>{
 const product={category:'MIRFE',unit:'kg',doseUnit:'g/L'}
 assert.equal(assertInventoryLotProductCausality(product,{unit:'kg'}),'kg')
 assert.throws(()=>assertInventoryLotProductCausality(product,{unit:'g'}),/contradice la unidad técnica/)
 assert.throws(()=>assertInventoryLotProductCausality(product,{}),/no congela la unidad técnica/)
})

test('F006 CREATE_PRODUCT rejects incompatible technical unit before requested/commit effects',async()=>{
 const h={state:base(),events:[]}
 await assert.rejects(()=>executeInventoryCommand(h.state,{operation:INVENTORY_OPERATIONS.CREATE_PRODUCT,entityId:'p-bad',input:{name:'Bio',category:'MIPE',unit:'L',doseUnit:'mL/L'},commandId:'c-bad'},depsFor(h)),/unidad de inventario debe ser mL/i)
 assert.equal(h.state.products.length,0);assert.equal(h.state.inventoryCommandReceipts.length,0);assert.equal(h.events.length,0)
})

test('F006 CREATE_PRODUCT + CREATE_LOT freeze Product unit and reject hostile lot unit',async()=>{
 const h={state:base(),events:[]}
 await executeInventoryCommand(h.state,{operation:INVENTORY_OPERATIONS.CREATE_PRODUCT,entityId:'p1',input:{name:'Bio',category:'MIPE',unit:'mL',doseUnit:'mL/L'},commandId:'cp'},depsFor(h))
 await executeInventoryCommand(h.state,{operation:INVENTORY_OPERATIONS.CREATE_LOT,entityId:'l1',input:{productId:'p1',siteId:'site-a',lotNumber:'L1',quantity:2},commandId:'cl'},depsFor(h))
 assert.equal(h.state.inventoryLots[0].unit,'mL')
 await assert.rejects(()=>executeInventoryCommand(h.state,{operation:INVENTORY_OPERATIONS.CREATE_LOT,entityId:'l2',input:{productId:'p1',siteId:'site-a',lotNumber:'L2',unit:'g'},commandId:'cl2'},depsFor(h)),/contradice la unidad técnica/i)
 assert.equal(h.state.inventoryLots.length,1)
})

test('F006 movement fails closed when persisted Lot unit contradicts Product',()=>{
 const state=base();state.products=[{id:'p1',organizationId:'org-a',category:'MIPE',unit:'mL',doseUnit:'mL/L'}];state.inventoryLots=[{id:'l1',organizationId:'org-a',productId:'p1',siteId:'site-a',unit:'g',lotNumber:'L1',quantity:0}]
 assert.throws(()=>transactInventory(state,{id:'m1',lotId:'l1',type:'Entrada',quantity:1}),/contradice la unidad técnica/i)
})

test('F006 direct lot authority also freezes Product unit outside UI',()=>{
 const state=base();state.products=[{id:'p1',organizationId:'org-a',category:'General',unit:'kg'}]
 const next=createInventoryLot(state,{id:'l1',productId:'p1',siteId:'site-a',lotNumber:'L1'})
 assert.equal(next.inventoryLots[0].unit,'kg')
 assert.throws(()=>createInventoryLot(state,{id:'l2',productId:'p1',siteId:'site-a',lotNumber:'L2',unit:'g'}),/contradice la unidad técnica/i)
})
